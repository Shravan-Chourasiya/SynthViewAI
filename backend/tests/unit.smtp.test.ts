/**
 * unit.smtp.test.ts — the SMTP transport, exercised over a real socket.
 *
 * The server below is a small SMTP implementation in the test process: it
 * speaks the protocol on a loopback port, upgrades to TLS when asked, and
 * records every command line and message body it receives. That means these
 * tests assert *what actually goes over the wire* — command order, base64
 * credentials instead of plaintext, the MIME body — without a network
 * dependency and without sending a single real email.
 *
 * The TLS certificate is a self-signed fixture for `localhost` / `127.0.0.1`
 * (`tests/fixtures/localhost-*.pem`, test-only, generated with openssl). It is
 * passed as an extra trust anchor, which is exactly what proves the point: with
 * the anchor, the handshake succeeds; without it, the send is refused, because
 * the client never disables certificate verification.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createServer as createTcpServer, type Server, type Socket } from "node:net";
import { createServer as createTlsServer, TLSSocket } from "node:tls";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SmtpError,
  buildMimeMessage,
  encodePhrase,
  encodeUnstructuredHeader,
  sendSmtpMail,
  verifySmtpConnection,
  type SmtpConfig,
} from "../src/utils/smtp.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const TLS_KEY = readFileSync(join(FIXTURES, "localhost-key.pem"));
const TLS_CERT = readFileSync(join(FIXTURES, "localhost-cert.pem"));

const SMTP_USER = "brevo-smtp-user@example.org";
const SMTP_PASSWORD = "brevo-smtp-key";
const SMTP_USER_BASE64 = Buffer.from(SMTP_USER, "utf8").toString("base64");
const SMTP_PASSWORD_BASE64 = Buffer.from(SMTP_PASSWORD, "utf8").toString("base64");

const MESSAGE = {
  from: { name: "SyntheView AI", address: "no-reply@syntheview.test" },
  to: "candidate@example.org",
  subject: "Your SyntheView OTP",
  html: "<html><body><p>Hello</p><p>OTP: 123456</p></body></html>",
};

interface FakeOptions {
  /** Advertise STARTTLS in EHLO. Default true. */
  offerStartTls?: boolean;
  /** Accept the AUTH LOGIN exchange. Default true. */
  acceptLogin?: boolean;
  /** Reject RCPT TO with a 550. Default false. */
  rejectRecipient?: boolean;
  /** Answer the greeting and then never reply again. */
  silent?: boolean;
  /** Answer the greeting and then close the connection. */
  closeAfterGreeting?: boolean;
  /** TLS from the first byte (port 465 behaviour) instead of STARTTLS. */
  implicitTls?: boolean;
  /** Listen port; 0 picks a free one. */
  port?: number;
}

type AuthStage = "none" | "username" | "password";

/** A minimal SMTP server: enough protocol to test an SMTP client against. */
class FakeSmtpServer {
  /** Every command line received, in order (auth tokens included). */
  readonly commands: string[] = [];
  /** Every DATA payload received, with dot-stuffing removed. */
  readonly messages: string[] = [];
  port = 0;
  private server: Server | null = null;

  async start(options: FakeOptions = {}): Promise<void> {
    this.server = options.implicitTls
      ? createTlsServer({ key: TLS_KEY, cert: TLS_CERT }, (socket) => this.handle(socket, options))
      : createTcpServer((socket) => this.handle(socket, options));

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(options.port ?? 0, "127.0.0.1", () => resolve());
    });

    const address = this.server.address();
    this.port = typeof address === "object" && address !== null ? address.port : 0;
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (server === null) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private handle(initial: Socket, options: FakeOptions): void {
    let active: Socket = initial;
    let buffer = "";
    let inData = false;
    let dataLines: string[] = [];
    let authStage: AuthStage = "none";
    let secured = options.implicitTls === true;

    const write = (line: string): void => {
      active.write(`${line}\r\n`);
    };

    const attach = (socket: Socket): void => {
      socket.setEncoding("utf8");
      socket.on("data", onData);
      socket.on("error", () => undefined);
    };

    const upgrade = (): void => {
      // Hand the plaintext socket to a TLS layer and keep reading through it.
      initial.off("data", onData);
      buffer = "";
      const tlsSocket = new TLSSocket(initial, { isServer: true, key: TLS_KEY, cert: TLS_CERT });
      active = tlsSocket;
      secured = true;
      attach(tlsSocket);
    };

    const ehlo = (): void => {
      const lines = ["250-fake.relay.test greets you"];
      if (options.offerStartTls !== false && !secured) lines.push("250-STARTTLS");
      lines.push("250-AUTH LOGIN PLAIN");
      lines.push("250 SIZE 10485760");
      write(lines.join("\r\n"));
    };

    const drain = (): void => {
      for (;;) {
        const index = buffer.indexOf("\r\n");
        if (index === -1) return;
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);

        if (inData) {
          if (line === ".") {
            inData = false;
            this.messages.push(dataLines.join("\r\n"));
            dataLines = [];
            write("250 2.0.0 Ok: queued as FAKE123");
          } else {
            dataLines.push(line);
          }
          continue;
        }

        this.commands.push(line);
        const verb = (line.split(" ")[0] ?? "").toUpperCase();

        if (authStage === "username") {
          authStage = "password";
          write("334 UGFzc3dvcmQ6"); // "Password:"
          continue;
        }
        if (authStage === "password") {
          authStage = "none";
          write(options.acceptLogin === false ? "535 5.7.8 Authentication failed" : "235 2.7.0 Authentication successful");
          continue;
        }

        switch (verb) {
          case "EHLO":
            ehlo();
            break;
          case "STARTTLS":
            write("220 2.0.0 Ready to start TLS");
            upgrade();
            break;
          case "AUTH":
            if (line.toUpperCase().startsWith("AUTH PLAIN")) {
              write(options.acceptLogin === false ? "535 5.7.8 Authentication failed" : "235 2.7.0 Authentication successful");
            } else if (options.acceptLogin === false) {
              write("535 5.7.8 Authentication failed");
            } else {
              authStage = "username";
              write("334 VXNlcm5hbWU6"); // "Username:"
            }
            break;
          case "MAIL":
            write("250 2.1.0 Ok");
            break;
          case "RCPT":
            write(
              options.rejectRecipient === true
                ? "550 5.1.1 Recipient address rejected: User unknown"
                : "250 2.1.5 Ok",
            );
            break;
          case "DATA":
            inData = true;
            write("354 End data with <CR><LF>.<CR><LF>");
            break;
          case "NOOP":
            write("250 2.0.0 Ok");
            break;
          case "QUIT":
            write("221 2.0.0 Bye");
            active.end();
            return;
          default:
            write("502 5.5.2 Command not implemented");
        }
      }
    };

    const onData = (chunk: string): void => {
      buffer += chunk;
      drain();
    };

    attach(active);
    write("220 fake.relay.test ESMTP ready");

    if (options.closeAfterGreeting === true) {
      active.end();
      return;
    }
    if (options.silent === true) {
      // Connected but mute: the client must time out rather than hang forever.
      active.off("data", onData);
    }
  }
}

const started: FakeSmtpServer[] = [];

async function startServer(options: FakeOptions = {}): Promise<FakeSmtpServer> {
  const server = new FakeSmtpServer();
  await server.start(options);
  started.push(server);
  return server;
}

function configFor(
  server: FakeSmtpServer,
  options: { trustFixture?: boolean; timeoutMs?: number } = {},
): SmtpConfig {
  const config: SmtpConfig = {
    host: "127.0.0.1",
    port: server.port,
    user: SMTP_USER,
    password: SMTP_PASSWORD,
  };
  // The fixture CA is only ever an *extra* trust anchor; omitting it must make
  // the send fail, which is the assertion in the certificate test below.
  if (options.trustFixture !== false) config.ca = TLS_CERT;
  if (options.timeoutMs !== undefined) config.timeoutMs = options.timeoutMs;
  return config;
}

afterEach(async () => {
  while (started.length > 0) {
    await started.pop()?.close();
  }
});

describe("sendSmtpMail", () => {
  it("sends over STARTTLS, authenticating with base64 credentials and never plaintext", async () => {
    const server = await startServer();

    const result = await sendSmtpMail(configFor(server), MESSAGE);

    expect(result.code).toBe(250);
    expect(result.response).toContain("queued");

    const [
      greet,
      startTls,
      greetAgain,
      authLogin,
      userToken,
      passwordToken,
      mailFrom,
      rcptTo,
      data,
      quit,
    ] = server.commands;

    expect(greet?.toUpperCase()).toMatch(/^EHLO /);
    expect(startTls?.toUpperCase()).toBe("STARTTLS");
    // RFC 3207: the capability list has to be re-read after the upgrade.
    expect(greetAgain?.toUpperCase()).toMatch(/^EHLO /);
    expect(authLogin?.toUpperCase()).toBe("AUTH LOGIN");
    expect(userToken).toBe(Buffer.from(SMTP_USER, "utf8").toString("base64"));
    expect(passwordToken).toBe(Buffer.from(SMTP_PASSWORD, "utf8").toString("base64"));
    expect(mailFrom).toBe("MAIL FROM:<no-reply@syntheview.test>");
    expect(rcptTo).toBe("RCPT TO:<candidate@example.org>");
    expect(data).toBe("DATA");
    expect(quit).toBe("QUIT");

    // The credential only ever travels encoded.
    expect(server.commands.join("\n")).not.toContain(SMTP_PASSWORD);
    expect(server.commands.join("\n")).not.toContain(SMTP_USER);
  });

  it("delivers a MIME message the relay can read back", async () => {
    const server = await startServer();

    await sendSmtpMail(configFor(server), MESSAGE);

    expect(server.messages).toHaveLength(1);
    const [raw] = server.messages;
    const [headers, encodedBody] = (raw ?? "").split("\r\n\r\n");

    expect(headers).toContain('From: "SyntheView AI" <no-reply@syntheview.test>');
    expect(headers).toContain("To: <candidate@example.org>");
    expect(headers).toContain("Subject: Your SyntheView OTP");
    expect(headers).toContain("MIME-Version: 1.0");
    expect(headers).toContain("Content-Type: text/html; charset=utf-8");
    expect(headers).toContain("Content-Transfer-Encoding: base64");
    expect(headers).toContain("Message-ID: <");

    expect(Buffer.from((encodedBody ?? "").replace(/\r\n/g, ""), "base64").toString("utf8")).toBe(
      MESSAGE.html,
    );
  });

  it("passes a reply-to through to the headers", async () => {
    const server = await startServer();

    await sendSmtpMail(configFor(server), { ...MESSAGE, replyTo: "visitor@example.net" });

    expect(server.messages[0]).toContain("Reply-To: <visitor@example.net>");
  });

  it("refuses to send when the server does not offer STARTTLS", async () => {
    const server = await startServer({ offerStartTls: false });

    await expect(sendSmtpMail(configFor(server), MESSAGE)).rejects.toMatchObject({
      code: "EENCRYPTIONREQUIRED",
    });
    // No credentials, no recipient, no message ever left the client.
    expect(server.commands.some((line) => line.toUpperCase().startsWith("AUTH"))).toBe(false);
    expect(server.messages).toHaveLength(0);
  });

  it("fails when the certificate is not trusted", async () => {
    const server = await startServer();

    // Same server, same client — only the extra trust anchor is missing.
    await expect(
      sendSmtpMail(configFor(server, { trustFixture: false }), MESSAGE),
    ).rejects.toBeInstanceOf(SmtpError);

    expect(server.messages).toHaveLength(0);
    expect(server.commands.join("\n")).not.toContain(
      Buffer.from(SMTP_PASSWORD, "utf8").toString("base64"),
    );
  });

  it("surfaces rejected credentials as an auth error", async () => {
    const server = await startServer({ acceptLogin: false });

    await expect(sendSmtpMail(configFor(server), MESSAGE)).rejects.toMatchObject({
      code: "EAUTH",
      responseCode: 535,
      command: "AUTH",
    });
    expect(server.messages).toHaveLength(0);
  });

  it("surfaces a rejected recipient as a recipient error", async () => {
    const server = await startServer({ rejectRecipient: true });

    await expect(sendSmtpMail(configFor(server), MESSAGE)).rejects.toMatchObject({
      code: "ERECIPIENTREJECTED",
      responseCode: 550,
    });
    // The body was never handed over.
    expect(server.commands).not.toContain("DATA");
  });

  it("fails when the server closes the connection mid-handshake", async () => {
    const server = await startServer({ closeAfterGreeting: true });

    await expect(sendSmtpMail(configFor(server), MESSAGE)).rejects.toMatchObject({
      code: "ECONNRESET",
    });
  });

  it("times out instead of hanging on a silent server", async () => {
    const server = await startServer({ silent: true });

    await expect(
      sendSmtpMail(configFor(server, { timeoutMs: 300 }), MESSAGE),
    ).rejects.toMatchObject({ code: "ETIMEDOUT" });
  });

  it("uses implicit TLS when the port is 465", async (context) => {
    const server = new FakeSmtpServer();
    try {
      await server.start({ implicitTls: true, port: 465 });
    } catch {
      // Something else on this machine owns 465; the STARTTLS path is covered above.
      context.skip();
      return;
    }
    started.push(server);

    await sendSmtpMail(configFor(server), MESSAGE);

    expect(server.commands[0]?.toUpperCase()).toMatch(/^EHLO /);
    expect(server.commands.some((line) => line.toUpperCase() === "STARTTLS")).toBe(false);
    expect(server.messages).toHaveLength(1);
  });
});

describe("verifySmtpConnection", () => {
  it("reports the session as secure and returns the advertised capabilities", async () => {
    const server = await startServer();

    const info = await verifySmtpConnection(configFor(server));

    expect(info.secure).toBe(true);
    // Post-upgrade capabilities: STARTTLS is no longer advertised once it has
    // been used, which is why the negotiation is asserted from the wire below.
    expect(info.capabilities.some((line) => line.startsWith("AUTH"))).toBe(true);
    expect(info.capabilities.some((line) => line.startsWith("SIZE"))).toBe(true);
    expect(server.commands).toEqual([
      expect.stringMatching(/^EHLO /),
      "STARTTLS",
      expect.stringMatching(/^EHLO /),
      "AUTH LOGIN",
      SMTP_USER_BASE64,
      SMTP_PASSWORD_BASE64,
      "NOOP",
      "QUIT",
    ]);
  });

  it("fails on bad credentials, which is what the boot-time probe reports", async () => {
    const server = await startServer({ acceptLogin: false });

    await expect(verifySmtpConnection(configFor(server))).rejects.toMatchObject({ code: "EAUTH" });
  });
});

describe("buildMimeMessage", () => {
  it("rejects header injection through the recipient, sender, subject and reply-to", () => {
    const injections = [
      { to: "victim@example.org\r\nBcc: attacker@example.org" },
      { from: { name: "Team", address: "no-reply@syntheview.test\r\nBcc: attacker@example.org" } },
      { subject: "Hello\r\nBcc: attacker@example.org" },
      { replyTo: "visitor@example.net\r\nBcc: attacker@example.org" },
    ];

    for (const injection of injections) {
      expect(() => buildMimeMessage({ ...MESSAGE, ...injection })).toThrowError(
        expect.objectContaining({ code: "EINVALIDADDRESS" }),
      );
    }
  });

  it("encodes a non-ASCII subject as RFC 2047 encoded words and leaves ASCII subjects alone", () => {
    const subject = "Réinitialisation de votre mot de passe ✅";
    const headers = buildMimeMessage({ ...MESSAGE, subject }).split("\r\n\r\n")[0] ?? "";
    // Unfold the header block: a long encoded value is split across lines.
    const unfolded = headers.replace(/\r\n[ \t]/g, " ");
    const header = unfolded.split("\r\n").find((line) => line.startsWith("Subject: "));

    expect(header).toContain("=?UTF-8?B?");

    const encodedWords = (header ?? "").match(/=\?UTF-8\?B\?[^?]+\?=/g);
    expect(encodedWords).not.toBeNull();
    const decoded = (encodedWords ?? [])
      .map((word) =>
        Buffer.from(word.replace(/^=\?UTF-8\?B\?/, "").replace(/\?=$/, ""), "base64").toString(
          "utf8",
        ),
      )
      .join("");
    expect(decoded).toBe(subject);

    // A plain ASCII subject is never quoted: `Subject` is unstructured, so
    // quotes would be delivered as literal characters in the subject line.
    expect(buildMimeMessage(MESSAGE)).toContain("Subject: Your SyntheView OTP\r\n");
    expect(buildMimeMessage(MESSAGE)).not.toContain('Subject: "');
  });

  it("keeps every line inside the SMTP limit", () => {
    const longHtml = `<p>${"a".repeat(5000)}</p>`;
    const raw = buildMimeMessage({ ...MESSAGE, html: longHtml });

    for (const line of raw.split("\r\n")) {
      expect(line.length).toBeLessThan(998);
    }
  });
});

describe("header encoding", () => {
  it("leaves a plain phrase untouched", () => {
    expect(encodePhrase("SyntheView")).toBe("SyntheView");
  });

  it("quotes a display name containing header specials", () => {
    expect(encodePhrase("SyntheView AI, Inc.")).toBe('"SyntheView AI, Inc."');
    expect(encodePhrase('Say "hi"')).toBe('"Say \\"hi\\""');
  });

  it("encodes non-ASCII display names", () => {
    expect(encodePhrase("Ünïcode")).toMatch(/^=\?UTF-8\?B\?/);
  });

  it("never quotes an unstructured value", () => {
    expect(encodeUnstructuredHeader("Your SyntheView OTP")).toBe("Your SyntheView OTP");
    expect(encodeUnstructuredHeader("Réinitialisation")).toMatch(/^=\?UTF-8\?B\?/);
  });
});
