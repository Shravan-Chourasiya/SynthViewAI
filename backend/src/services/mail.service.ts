/**
 * Mail service — the only module that sends email.
 *
 * The transport behind it is `utils/smtp.ts` (Brevo's SMTP relay). This file is
 * the boundary the rest of the backend knows: controllers and business services
 * call `sendOtpMail`, `sendPasswordReset…`, `sendInterviewReminderMail` and so
 * on, and none of them can tell whether the transport underneath is Brevo,
 * another relay, or a stub in a test. Keeping that boundary is why the module
 * rename that swapped the transport did not touch a single caller.
 *
 * Two rules apply to everything here:
 *
 * 1. **No secrets, no OTPs, no full addresses in the logs.** Log lines carry the
 *    mail kind, the recipient's *domain* and the relay's reply code only.
 * 2. **A failure is loud but safe.** Sends throw the standard `AppError` via
 *    `handleMailError` (logged in full server-side, generic message to the
 *    client), while fire-and-forget callers wrap them in `sendInBackground` so a
 *    bounce cannot fail the action that triggered the mail.
 */
import { env } from "../config/env.js";
import { sendSmtpMail, verifySmtpConnection, type SmtpConfig } from "../utils/smtp.js";
import {
  getAccountDeletedTemplate,
  getAccountSuspendedTemplate,
  getContactAcknowledgementTemplate,
  getContactMessageTemplate,
  getCredentialUpdatedTemplate,
  getEmailTemplate,
  getInterviewCancelledTemplate,
  getInterviewReminderTemplate,
  getNewLoginAlertTemplate,
  getPausedInterviewReminderTemplate,
  getWelcomeEmailTemplate,
  handleMailError,
  type AccountDeletedDetails,
  type AccountSuspendedDetails,
  type ContactAcknowledgementDetails,
  type ContactMessageDetails,
  type CredentialUpdateDetails,
  type InterviewCancelledDetails,
  type InterviewReminderDetails,
  type LoginAlertDetails,
  type PausedInterviewReminderDetails,
} from "../utils/email.js";
import { logger } from "../utils/logger.js";

/**
 * The one place the sender identity is defined. Brevo requires the sending
 * address (or its whole domain) to be a verified sender on the account, so
 * every mail shares it rather than scattering addresses through the codebase.
 */
const SENDER = { name: env.EMAIL_FROM_NAME, address: env.EMAIL_FROM } as const;

/** Identifies a mail in the logs without recording its contents or recipient. */
type MailKind =
  | "otp"
  | "welcome"
  | "login-alert"
  | "credential-updated"
  | "account-suspended"
  | "account-deleted"
  | "interview-reminder"
  | "interview-cancelled"
  | "interview-paused"
  | "contact-message"
  | "contact-acknowledgement";

function smtpConfig(): SmtpConfig {
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
  };
}

/**
 * Domains reserved by RFC 2606 / RFC 6761 that can never receive mail.
 *
 * A relay *accepts* mail for these and bounces it afterwards, so a notification
 * aimed at a seeded or test account silently disappears while every log line
 * says "sent" — indistinguishable from a broken mail pipeline. Detecting it here
 * turns that into an explicit warning instead of a mystery.
 */
const RESERVED_MAIL_DOMAINS_EXACT = ["example.com", "example.net", "example.org", "localhost"];
const RESERVED_MAIL_DOMAIN_SUFFIXES = [".test", ".invalid", ".localhost", ".example"];

function isUndeliverableAddress(address: string): boolean {
  const atIndex = address.lastIndexOf("@");
  if (atIndex === -1) return true;
  const domain = address.slice(atIndex + 1).toLowerCase().trim();
  if (domain.length === 0) return true;
  return (
    RESERVED_MAIL_DOMAINS_EXACT.includes(domain) ||
    RESERVED_MAIL_DOMAIN_SUFFIXES.some((suffix) => domain.endsWith(suffix))
  );
}

/** The only part of a recipient that is safe to log. */
function recipientDomain(address: string): string {
  const atIndex = address.lastIndexOf("@");
  return atIndex === -1 ? "unknown" : address.slice(atIndex + 1).toLowerCase() || "unknown";
}

/**
 * Probes the SMTP credentials. Called once at boot (see `server.ts`) so a bad or
 * revoked Brevo SMTP key shows up as a startup error instead of silently
 * swallowing every OTP, reminder and contact email — most sends are
 * fire-and-forget, so a broken relay is otherwise invisible.
 */
export async function verifyMailTransporter(): Promise<boolean> {
  const config = smtpConfig();
  try {
    const { capabilities, secure } = await verifySmtpConnection(config);
    logger.info(
      {
        host: config.host,
        port: config.port,
        secure,
        capabilities,
        provider: "brevo",
      },
      "Mail transport verified successfully.",
    );
    return true;
  } catch (error) {
    logger.error(
      { err: error, host: config.host, port: config.port, provider: "brevo" },
      "Mail transport verification failed — OTP, reminder and contact emails will not be delivered.",
    );
    return false;
  }
}

/**
 * Single send path shared by every template. Failures go through the same
 * `handleMailError` contract as before, so a direct caller still gets a proper
 * `AppError` while fire-and-forget callers (see `sendInBackground`) are expected
 * to swallow it.
 */
async function sendMail(
  to: string,
  subject: string,
  html: string,
  options: { kind: MailKind; replyTo?: string },
): Promise<void> {
  if (isUndeliverableAddress(to)) {
    logger.warn(
      { mail: options.kind },
      "Skipped email: recipient domain is reserved and cannot receive mail (RFC 2606). Sign in with a real address to receive notifications.",
    );
    return;
  }

  const domain = recipientDomain(to);
  logger.info({ mail: options.kind, domain, provider: "brevo" }, "Email send attempted");

  try {
    const result = await sendSmtpMail(smtpConfig(), {
      from: SENDER,
      to,
      subject,
      html,
      // Spread conditionally: `exactOptionalPropertyTypes` rejects passing an
      // explicit `undefined` for the optional `replyTo`.
      ...(options.replyTo !== undefined && { replyTo: options.replyTo }),
    });

    logger.info(
      { mail: options.kind, domain, provider: "brevo", responseCode: result.code },
      "Email sent through Brevo SMTP",
    );
  } catch (error) {
    handleMailError(error, { mail: options.kind, domain });
  }
}

/**
 * Runs a notification send without letting a mail failure fail the primary
 * action that triggered it (e.g. cancelling an interview must still succeed if
 * the confirmation email bounces).
 *
 * `label` names the mail so a failure is traceable: the rejection is logged with
 * the message it belongs to instead of being discarded. A `handleMailError`
 * rejection is already logged inside `sendMail`, but a callback that throws
 * *before* reaching the transport (a failed lookup, a bad template argument)
 * used to produce no log line at all — which is how a whole notification silently
 * stops working without anyone noticing.
 */
export function sendInBackground(label: string, task: () => Promise<void>): void {
  void task().catch((error) => {
    logger.warn({ err: error, mail: label }, "Background email was not delivered.");
  });
}

export const sendOtpMail = async (email: string, otp: string): Promise<void> => {
  const subject = "Your SyntheView OTP";
  await sendMail(email, subject, getEmailTemplate(otp, email, subject), { kind: "otp" });
};

/** One-time welcome mail, sent right after the registration OTP is verified. */
export const sendWelcomeMail = async (email: string, firstName?: string): Promise<void> => {
  await sendMail(email, "Welcome to SyntheView AI", getWelcomeEmailTemplate(email, firstName), {
    kind: "welcome",
  });
};

/** First time a given device is seen for this user — not on every login. */
export const sendNewLoginAlertMail = async (
  email: string,
  details: LoginAlertDetails,
): Promise<void> => {
  await sendMail(
    email,
    "New sign-in to your SyntheView AI account",
    getNewLoginAlertTemplate(email, details),
    { kind: "login-alert" },
  );
};

export const sendCredentialUpdatedMail = async (
  email: string,
  details: CredentialUpdateDetails,
): Promise<void> => {
  const label = details.field === "password" ? "password" : "email";
  await sendMail(
    email,
    `Your SyntheView AI ${label} was updated`,
    getCredentialUpdatedTemplate(email, details),
    { kind: "credential-updated" },
  );
};

export const sendAccountSuspendedMail = async (
  email: string,
  details: AccountSuspendedDetails,
): Promise<void> => {
  await sendMail(
    email,
    "Your SyntheView AI account has been suspended",
    getAccountSuspendedTemplate(email, details),
    { kind: "account-suspended" },
  );
};

export const sendAccountDeletedMail = async (
  email: string,
  details: AccountDeletedDetails,
): Promise<void> => {
  await sendMail(
    email,
    "Your SyntheView AI account is scheduled for deletion",
    getAccountDeletedTemplate(email, details),
    { kind: "account-deleted" },
  );
};

export const sendInterviewReminderMail = async (
  email: string,
  details: InterviewReminderDetails,
): Promise<void> => {
  await sendMail(
    email,
    `Reminder: your interview starts in ${details.leadTimeLabel}`,
    getInterviewReminderTemplate(email, details),
    { kind: "interview-reminder" },
  );
};

export const sendInterviewCancelledMail = async (
  email: string,
  details: InterviewCancelledDetails,
): Promise<void> => {
  await sendMail(
    email,
    "Your interview has been cancelled",
    getInterviewCancelledTemplate(email, details),
    { kind: "interview-cancelled" },
  );
};

export const sendPausedInterviewReminderMail = async (
  email: string,
  details: PausedInterviewReminderDetails,
): Promise<void> => {
  await sendMail(
    email,
    "You left an interview paused",
    getPausedInterviewReminderTemplate(email, details),
    { kind: "interview-paused" },
  );
};

/**
 * Public contact form → team inbox. The team address is the app's own verified
 * sender address (`EMAIL_FROM`) and `replyTo` is the visitor, so support can
 * answer without copying an address out of the body.
 */
export const sendContactMessageMail = async (details: ContactMessageDetails): Promise<void> => {
  await sendMail(
    env.EMAIL_FROM,
    `New contact form message: ${details.subject}`,
    getContactMessageTemplate(details),
    { kind: "contact-message", replyTo: details.email },
  );
};

/** Confirmation to the visitor; sent in the background so a bounce cannot fail
 * a submission the team already received. */
export const sendContactAcknowledgementMail = async (
  email: string,
  details: ContactAcknowledgementDetails,
): Promise<void> => {
  await sendMail(email, "We received your message", getContactAcknowledgementTemplate(email, details), {
    kind: "contact-acknowledgement",
  });
};
