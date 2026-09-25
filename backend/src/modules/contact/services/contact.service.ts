import { logger } from "../../../utils/logger.js";
import {
  sendContactAcknowledgementMail,
  sendContactMessageMail,
  sendInBackground,
} from "../../../services/mail.service.js";
import type { ContactSubmission } from "../zodschemas/contact.zschema.js";

export interface ContactRequestContext {
  ipAddress: string;
  userAgent: string;
}

/**
 * Replaces control characters with a space. `keepLineBreaks` lets a message keep
 * its intentional paragraph breaks while everything else is flattened.
 *
 * The name, email and subject end up in mail *headers*, where an unescaped
 * newline (or any other control character) would let a visitor append their own
 * headers — e.g. a second `To:` — so this runs before anything reaches the mail
 * transport. Done with a character scan rather than a regex so the intent is
 * explicit and eslint's `no-control-regex` stays happy.
 */
function stripControlCharacters(value: string, keepLineBreaks = false): string {
  let result = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const isControl = code < 0x20 || code === 0x7f;
    if (!isControl) {
      result += char;
    } else if (keepLineBreaks && (char === "\n" || char === "\r")) {
      result += char;
    } else {
      result += " ";
    }
  }
  return result;
}

/** Single-line field: no control characters, no runs of whitespace. */
function normalizeLine(value: string): string {
  return stripControlCharacters(value).replace(/\s+/g, " ").trim();
}

/** Multi-line field: keeps line breaks, normalises them, and trims runaway blanks. */
function normalizeMessage(value: string): string {
  return stripControlCharacters(value, true)
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Delivers a contact-form submission to the team inbox and acknowledges it to
 * the visitor. Nothing is persisted — the mailbox is the system of record for
 * this channel, which is what "contact us" means for a solo/small team.
 */
export async function submitContactMessage(
  input: ContactSubmission,
  context: ContactRequestContext,
): Promise<{ delivered: true }> {
  const details = {
    name: normalizeLine(input.name),
    email: normalizeLine(input.email).toLowerCase(),
    subject: normalizeLine(input.subject),
    message: normalizeMessage(input.message),
    submittedAt: new Date(),
    ipAddress: normalizeLine(context.ipAddress) || "unknown",
    userAgent: normalizeLine(context.userAgent).slice(0, 200) || "unknown",
  };

  // Awaited deliberately: if the team notification fails, the visitor sees an
  // error and can retry, instead of being told "sent" when nobody was notified.
  await sendContactMessageMail(details);

  // The acknowledgement is a courtesy — a bounce must not fail a submission the
  // team already received.
  sendInBackground("contact acknowledgement", () =>
    sendContactAcknowledgementMail(details.email, {
      name: details.name,
      subject: details.subject,
    }),
  );

  logger.info(
    { subject: details.subject, ipAddress: details.ipAddress },
    "Contact form submission delivered to the team inbox.",
  );

  return { delivered: true };
}
