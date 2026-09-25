/**
 * SMTP transport.
 *
 * This is the only place in the backend that speaks SMTP. It replaces the
 * previous `nodemailer` dependency with a small client built on `node:net` and
 * `node:tls`, and it is deliberately the thinnest layer that can carry
 * Brevo's SMTP relay:
 *
 *     EHLO -> STARTTLS (mandatory) -> EHLO -> AUTH -> MAIL FROM -> RCPT TO -> DATA -> QUIT
 *
 * Design decisions worth knowing before changing anything here:
 *
 * 1. **Encryption is fail-closed.** On a submission port (anything other than
 *    465) the client refuses to continue if the server does not advertise
 *    STARTTLS, and it aborts if the upgrade is refused. Credentials are never
 *    sent over an unencrypted socket. Certificate verification is left at the
 *    TLS default — this file never sets `rejectUnauthorized: false`. The
 *    optional `ca` field adds an extra trust anchor (for a private relay with
 *    an internal CA); it only ever *adds* trust, it never removes it.
 * 2. **One connection per message.** There is no pooled/persistent connection,
 *    so there is nothing to keep alive or clean up on a host that idles
 *    instances out, and one failed send cannot poison the next one. For
 *    transactional mail volumes that is the right trade.
 * 3. **The body is base64.** That keeps every line inside the 998-octet limit
 *    and means HTML full of quoted-printable hazards (bare dots, trailing
 *    spaces, 8-bit characters) travels intact. Subjects and display names are
 *    RFC 2047 encoded when they are not plain ASCII.
 * 4. **Errors are typed and carry a code.** `SmtpError.code` mirrors Node's
 *    system-error convention (`EAUTH`, `ERECIPIENTREJECTED`, `ETIMEDOUT`,
 *    `CERT_HAS_EXPIRED`, ...) so the existing error middleware can label it
 *    without this layer knowing anything about Express.
 * 5. **Nothing here logs.** Credentials, message bodies and recipient addresses
 *    are handled by `services/mail.service.ts`, which logs only safe metadata.
 */
import { randomUUID } from "node:crypto";
import { connect as connectTcp, isIP, type Socket } from "node:net";
import { hostname } from "node:os";
import { connect as connectTls } from "node:tls";

export interface SmtpConfig {
  host: string;
  /** Submission port. 587 (STARTTLS) is the default; 465 switches to implicit TLS. */
  port: number;
  user: string;
  password: string;
  /** Socket inactivity timeout. Defaults to 15s. */
  timeoutMs?: number;
  /**
   * Extra trust anchor(s) for a relay signed by a private CA. Never a way to
   * skip verification — it is passed straight to `tls.connect({ ca })`.
   */
  ca?: string | Buffer | (string | Buffer)[];
}

export interface SmtpAddress {
  name: string;
  address: string;
}

export interface SmtpMessage {
  from: SmtpAddress;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SmtpResult {
  /** Reply code for the accepted message (250 on success). */
  code: number;
  /** The server's final response line, for logging. */
  response: string;
}

export interface SmtpConnectionInfo {
  capabilities: string[];
  /** True once the session is TLS-protected (implicit TLS or STARTTLS). */
  secure: boolean;
}

export class SmtpError extends Error {
  /** Node-style error code: EAUTH, ERECIPIENTREJECTED, ETIMEDOUT, ECONNREFUSED... */
  readonly code: string;
  /** SMTP command that failed, when the failure came from the server. */
  readonly command: string | undefined;
  /** Numeric SMTP reply code, when there was one. */
  readonly responseCode: number | undefined;
  readonly cause: unknown;

  constructor(
    message: string,
    options: { code: string; command?: string; responseCode?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "SmtpError";
    this.code = options.code;
    this.command = options.command;
    this.responseCode = options.responseCode;
    this.cause = options.cause;
  }
}

/** Port 465 is implicit TLS (SMTPS); every other port is upgraded via STARTTLS. */
const IMPLICIT_TLS_PORT = 465;
const DEFAULT_TIMEOUT_MS = 15_000;
/** Base64 wraps at 76 columns, comfortably inside SMTP's 998-octet line limit. */
const BASE64_LINE_LENGTH = 76;
/** RFC 2047 encoded words must stay under 75 characters, so chunk the source. */
const ENCODED_WORD_CHUNK = 12;
const AUTH_OK = 235;

interface SmtpReply {
  code: number;
  lines: string[];
}

/**
 * Turns a byte stream into complete SMTP reply lines.
 *
 * A socket can deliver a reply in fragments and can deliver several replies in
 * one chunk, so replies are parsed from a line queue rather than from raw data
 * events. Socket failures and timeouts are captured so the next read rejects
 * instead of hanging.
 */
class LineReader {
  private buffer = "";
  private queue: string[] = [];
  private failure: SmtpError | null = null;
  private wake: (() => void) | null = null;
  private socket: Socket;
  private readonly timeoutMs: number;
  private readonly onData = (chunk: string): void => this.push(chunk);
  private readonly onError = (error: Error): void => this.fail(this.mapSocketError(error));
  private readonly onClose = (): void =>
    this.fail(
      new SmtpError("The SMTP server closed the connection before it finished replying.", {
        code: "ECONNRESET",
      }),
    );
  private readonly onTimeout = (): void =>
    this.fail(
      new SmtpError(`No SMTP response within ${this.timeoutMs} ms.`, { code: "ETIMEDOUT" }),
    );

  constructor(socket: Socket, timeoutMs: number) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    socket.setEncoding("utf8");
    socket.setTimeout(timeoutMs);
    socket.on("data", this.onData);
    socket.on("error", this.onError);
    socket.on("close", this.onClose);
    socket.on("timeout", this.onTimeout);
  }

  private mapSocketError(error: Error): SmtpError {
    return toSmtpError(error, "SMTP connection error");
  }

  private push(chunk: string): void {
    this.buffer += chunk;
    let index = this.buffer.indexOf("\n");
    while (index !== -1) {
      this.queue.push(this.buffer.slice(0, index).replace(/\r$/, ""));
      this.buffer = this.buffer.slice(index + 1);
      index = this.buffer.indexOf("\n");
    }
    this.wake?.();
  }

  private fail(error: SmtpError): void {
    this.failure ??= error;
    this.wake?.();
  }

  private async nextLine(): Promise<string> {
    for (;;) {
      const line = this.queue.shift();
      if (line !== undefined) return line;
      if (this.failure !== null) throw this.failure;
      // The executor runs synchronously, so `wake` is always assigned before any
      // data/error callback can fire — a fast failure cannot be missed here.
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
      this.wake = null;
    }
  }

  /** Reads one complete reply, following `250-...` continuation lines. */
  async readReply(): Promise<SmtpReply> {
    const lines: string[] = [];
    for (;;) {
      const line = await this.nextLine();
      const match = /^(\d{3})([ -])?/.exec(line);
      if (match === null) continue;
      lines.push(line);
      if (match[2] === "-") continue;
      return { code: Number(match[1]), lines };
    }
  }

  async command(text: string): Promise<SmtpReply> {
    this.socket.write(`${text}\r\n`);
    return await this.readReply();
  }

  /** Detaches from the socket without closing it (used for the TLS upgrade). */
  dispose(): void {
    this.socket.off("data", this.onData);
    this.socket.off("error", this.onError);
    this.socket.off("close", this.onClose);
    this.socket.off("timeout", this.onTimeout);
    this.socket.setTimeout(0);
    // The same socket is handed to tls.connect, whose handshake can still emit
    // `error`; keep a handler attached so Node never sees it as unhandled.
    this.socket.on("error", () => undefined);
  }
}

function clientName(): string {
  return hostname() || "localhost";
}

/**
 * Wraps anything a socket or TLS handshake throws in an `SmtpError`.
 *
 * Node's network and TLS failures already carry a useful `code`
 * (ECONNREFUSED, ETIMEDOUT, UNABLE_TO_VERIFY_LEAF_SIGNATURE,
 * CERT_HAS_EXPIRED, ...). Keeping it on a single error type means callers only
 * ever have to know about `SmtpError`.
 */
function toSmtpError(error: unknown, context: string): SmtpError {
  if (error instanceof SmtpError) return error;
  const code = (error as NodeJS.ErrnoException | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  return new SmtpError(`${context}: ${message}`, {
    code: typeof code === "string" && code.length > 0 ? code : "ESOCKET",
    cause: error,
  });
}

/**
 * SNI name for a host, or `undefined` for an IP literal.
 *
 * RFC 6066 forbids an IP address in the SNI extension (Node warns about it and
 * ignores the value), so an IP host is left for the certificate check alone.
 */
function serverName(host: string): string | undefined {
  return isIP(host) === 0 ? host : undefined;
}

function serverFailure(command: string, reply: SmtpReply, config: SmtpConfig): SmtpError {
  const detail = reply.lines.join(" | ");
  const code =
    reply.code === 530 || reply.code === 534 || reply.code === 535 || reply.code === 538
      ? "EAUTH"
      : command.startsWith("AUTH")
        ? "EAUTH"
        : command === "STARTTLS"
          ? "EENCRYPTIONREQUIRED"
          : command.startsWith("MAIL FROM")
            ? "ESENDERREJECTED"
            : command.startsWith("RCPT TO")
              ? "ERECIPIENTREJECTED"
              : command === "DATA"
                ? "EMESSAGEREJECTED"
                : "ESMTP";
  // Never includes the credentials that were in flight.
  return new SmtpError(
    `SMTP ${command} was rejected by ${config.host}:${config.port} with ${reply.code} ${detail}`,
    { code, command, responseCode: reply.code },
  );
}

async function openSocket(config: SmtpConfig, timeoutMs: number): Promise<Socket> {
  const secure = config.port === IMPLICIT_TLS_PORT;
  return await new Promise<Socket>((resolve, reject) => {
    const base = {
      host: config.host,
      port: config.port,
      ...(config.ca !== undefined && { ca: config.ca }),
    };
    const socket = secure
      ? connectTls({ ...base, servername: serverName(config.host) }, () => resolve(socket))
      : connectTcp(base, () => resolve(socket));
    socket.setTimeout(timeoutMs, () => {
      socket.destroy(
        new SmtpError(`Timed out connecting to ${config.host}:${config.port}.`, {
          code: "ETIMEDOUT",
        }),
      );
    });
    socket.once("error", (error: Error) =>
      reject(toSmtpError(error, `Cannot reach ${config.host}:${config.port}`)),
    );
  });
}

async function upgradeToTls(socket: Socket, config: SmtpConfig, timeoutMs: number): Promise<Socket> {
  return await new Promise<Socket>((resolve, reject) => {
    // `servername` matters for the SNI and hostname check on a shared relay;
    // `ca` is only ever additive (see SmtpConfig).
    const secured = connectTls(
      {
        socket,
        servername: serverName(config.host),
        ...(config.ca !== undefined && { ca: config.ca }),
      },
      () => resolve(secured),
    );
    secured.setTimeout(timeoutMs);
    secured.once("error", (error: Error) =>
      reject(toSmtpError(error, `TLS handshake with ${config.host} failed`)),
    );
  });
}

async function ehlo(reader: LineReader, config: SmtpConfig): Promise<string[]> {
  const reply = await reader.command(`EHLO ${clientName()}`);
  if (reply.code !== 250) throw serverFailure("EHLO", reply, config);
  // The first line is the greeting ("250-relay.example.com"); the rest are
  // capabilities such as "STARTTLS" and "AUTH LOGIN PLAIN".
  return reply.lines
    .slice(1)
    .map((line) => line.slice(4).trim().toUpperCase())
    .filter((line) => line.length > 0);
}

function authMechanisms(capabilities: string[]): string[] {
  return capabilities
    .filter((line) => line === "AUTH" || line.startsWith("AUTH ") || line.startsWith("AUTH="))
    .flatMap((line) => line.replace(/^AUTH[= ]?/, "").split(/\s+/))
    .map((mechanism) => mechanism.trim())
    .filter((mechanism) => mechanism.length > 0);
}

async function authenticate(
  reader: LineReader,
  capabilities: string[],
  config: SmtpConfig,
): Promise<void> {
  const mechanisms = authMechanisms(capabilities);
  if (mechanisms.length === 0) {
    throw new SmtpError(
      `SMTP server ${config.host}:${config.port} does not advertise AUTH; refusing to send unauthenticated mail.`,
      { code: "EAUTH", command: "AUTH" },
    );
  }

  if (mechanisms.includes("PLAIN") && !mechanisms.includes("LOGIN")) {
    const token = Buffer.from(`\0${config.user}\0${config.password}`, "utf8").toString("base64");
    const reply = await reader.command(`AUTH PLAIN ${token}`);
    if (reply.code !== AUTH_OK) throw serverFailure("AUTH", reply, config);
    return;
  }

  // Brevo's relay advertises both; LOGIN is the more widely supported of the two
  // and keeps the credentials out of the same line as the command verb.
  const start = await reader.command("AUTH LOGIN");
  if (start.code !== 334) throw serverFailure("AUTH", start, config);
  const user = await reader.command(Buffer.from(config.user, "utf8").toString("base64"));
  if (user.code !== 334) throw serverFailure("AUTH", user, config);
  const password = await reader.command(Buffer.from(config.password, "utf8").toString("base64"));
  if (password.code !== AUTH_OK) throw serverFailure("AUTH", password, config);
}

interface SmtpSession {
  reader: LineReader;
  capabilities: string[];
  secure: boolean;
}

/**
 * Opens an authenticated session, hands it to `run`, then clears it down.
 *
 * The TLS upgrade happens here rather than in the callers so that "encrypted
 * before credentials" is a property of the transport instead of a rule every
 * caller has to remember.
 */
async function withConnection<T>(
  config: SmtpConfig,
  run: (session: SmtpSession) => Promise<T>,
): Promise<T> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const secureByPort = config.port === IMPLICIT_TLS_PORT;
  let socket = await openSocket(config, timeoutMs);
  let reader = new LineReader(socket, timeoutMs);
  let secure = secureByPort;
  try {
    const greeting = await reader.readReply();
    if (greeting.code !== 220) throw serverFailure("CONNECT", greeting, config);

    let capabilities = await ehlo(reader, config);

    if (!secureByPort) {
      if (!capabilities.includes("STARTTLS")) {
        throw new SmtpError(
          `SMTP server ${config.host}:${config.port} does not offer STARTTLS; refusing to send credentials over an unencrypted connection.`,
          { code: "EENCRYPTIONREQUIRED", command: "STARTTLS" },
        );
      }
      const ready = await reader.command("STARTTLS");
      if (ready.code !== 220) throw serverFailure("STARTTLS", ready, config);

      reader.dispose();
      socket = await upgradeToTls(socket, config, timeoutMs);
      reader = new LineReader(socket, timeoutMs);
      // RFC 3207: the session state is reset, so EHLO (and the capability list)
      // has to be repeated after the upgrade.
      capabilities = await ehlo(reader, config);
      secure = true;
    }

    await authenticate(reader, capabilities, config);

    const result = await run({ reader, capabilities, secure });

    try {
      await reader.command("QUIT");
    } catch {
      // A relay may close the connection immediately after accepting the
      // message; that is not a delivery failure.
    }
    return result;
  } finally {
    reader.dispose();
    socket.destroy();
  }
}

/** Boot-time credential probe: connect, upgrade, authenticate, NOOP. */
export async function verifySmtpConnection(config: SmtpConfig): Promise<SmtpConnectionInfo> {
  return await withConnection(config, async ({ reader, capabilities, secure }) => {
    const reply = await reader.command("NOOP");
    if (reply.code !== 250) throw serverFailure("NOOP", reply, config);
    return { capabilities, secure };
  });
}

/** Sends one HTML message, throwing `SmtpError` when the relay refuses it. */
export async function sendSmtpMail(config: SmtpConfig, message: SmtpMessage): Promise<SmtpResult> {
  const payload = buildMimeMessage(message);
  return await withConnection(config, async ({ reader }) => {
    // The envelope sender is the bare address; the display name belongs in the
    // message header. Both are validated as header-safe by buildMimeMessage.
    const sender = await reader.command(`MAIL FROM:<${message.from.address}>`);
    if (sender.code !== 250) throw serverFailure("MAIL FROM", sender, config);

    const recipient = await reader.command(`RCPT TO:<${message.to}>`);
    if (recipient.code !== 250 && recipient.code !== 251) {
      throw serverFailure("RCPT TO", recipient, config);
    }

    const ready = await reader.command("DATA");
    if (ready.code !== 354) throw serverFailure("DATA", ready, config);

    // `command()` appends CRLF, so this terminates the body with the required
    // <CRLF>.<CRLF> sequence and then reads the acceptance reply.
    const accepted = await reader.command(`${dotStuff(payload)}\r\n.`);
    if (accepted.code !== 250) throw serverFailure("DATA", accepted, config);

    return {
      code: accepted.code,
      response: accepted.lines[accepted.lines.length - 1] ?? "",
    };
  });
}

/** RFC 5322 date, e.g. "Wed, 24 Sep 2026 13:05:00 +0000". */
function rfc5322Date(date: Date): string {
  return date.toUTCString().replace("GMT", "+0000");
}

/** Header values must be single-line; a CR/LF here would inject extra headers. */
function assertHeaderSafe(value: string, field: string): void {
  if (/[\r\n]/.test(value)) {
    throw new SmtpError(
      `Refusing to send the message: ${field} contains a line break, which would allow header injection.`,
      { code: "EINVALIDADDRESS" },
    );
  }
}

/** Non-ASCII becomes one or more RFC 2047 encoded words. */
function encodeWords(value: string): string {
  const characters = [...value];
  const words: string[] = [];
  // Chunked by character (not byte) so a multi-byte character is never split
  // across two encoded words.
  for (let index = 0; index < characters.length; index += ENCODED_WORD_CHUNK) {
    const chunk = characters.slice(index, index + ENCODED_WORD_CHUNK).join("");
    words.push(`=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`);
  }
  return words.join("\r\n ");
}

function isPlainAscii(value: string): boolean {
  return /^[\x20-\x7e]*$/.test(value);
}

/**
 * Encodes an unstructured header value such as `Subject`. ASCII is left alone —
 * a subject is not a structured phrase, so quoting it would show up as literal
 * quotation marks in the recipient's mail client — and anything else becomes
 * RFC 2047 encoded words.
 */
export function encodeUnstructuredHeader(value: string): string {
  if (isPlainAscii(value)) return value;
  return encodeWords(value);
}

/**
 * Encodes a display-name phrase for a structured address header (`From`). Here
 * quoting is correct: a name containing spaces or specials has to be a
 * quoted-string, with backslashes and quotes escaped.
 */
export function encodePhrase(value: string): string {
  if (!isPlainAscii(value)) return encodeWords(value);
  if (!/[()<>@,;:\\".[\]\s]/.test(value)) return value;
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/** Escapes a leading "." so the body terminator cannot appear inside the data. */
function dotStuff(value: string): string {
  return value.replace(/(^|\r\n)\./g, "$1..");
}

function base64Body(html: string): string {
  const encoded = Buffer.from(html, "utf8").toString("base64");
  const lines: string[] = [];
  for (let index = 0; index < encoded.length; index += BASE64_LINE_LENGTH) {
    lines.push(encoded.slice(index, index + BASE64_LINE_LENGTH));
  }
  return lines.join("\r\n");
}

/**
 * Builds the RFC 5322 message: headers, a blank line, then the base64 HTML body.
 * Exported because it is the part of the transport that is worth testing on its
 * own (address formatting, subject encoding, injection guards).
 */
export function buildMimeMessage(message: SmtpMessage): string {
  assertHeaderSafe(message.to, "the recipient address");
  assertHeaderSafe(message.from.address, "the sender address");
  assertHeaderSafe(message.subject, "the subject");
  if (message.replyTo !== undefined) assertHeaderSafe(message.replyTo, "the reply-to address");

  const domain = message.from.address.slice(message.from.address.lastIndexOf("@") + 1);
  const headers = [
    `Date: ${rfc5322Date(new Date())}`,
    `From: ${encodePhrase(message.from.name)} <${message.from.address}>`,
    `To: <${message.to}>`,
    ...(message.replyTo !== undefined ? [`Reply-To: <${message.replyTo}>`] : []),
    `Subject: ${encodeUnstructuredHeader(message.subject)}`,
    `Message-ID: <${randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
  ];

  return `${headers.join("\r\n")}\r\n\r\n${base64Body(message.html)}`;
}
