import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
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
  handlerNodeMailerError,
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

let transporter: Transporter | null = null;

/**
 * Which credential path this process will authenticate with. `GMAIL_APP_PASSWORD`
 * takes precedence when present; otherwise OAuth2 is built from the client
 * id/secret/refresh-token trio. Worth logging on every verification failure —
 * "mail is broken" and "mail is broken because this deploy fell back to an
 * OAuth2 refresh token that was revoked" look identical from the outside.
 */
/**
 * Domains reserved by RFC 2606 / RFC 6761 that can never receive mail.
 *
 * Sends to these are *accepted* by Gmail's SMTP server and bounced afterwards, so
 * a notification aimed at a test account silently disappears while every log
 * line says "sent" — indistinguishable from a broken mail pipeline. Detecting it
 * here turns that into an explicit warning instead of a mystery.
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

function mailAuthMode(): "app-password" | "oauth2" {
  return env.GMAIL_APP_PASSWORD ? "app-password" : "oauth2";
}

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth:
      mailAuthMode() === "app-password"
        ? {
            user: env.GMAIL_USER_EMAIL,
            // Gmail shows app passwords in space-separated groups.
            pass: env.GMAIL_APP_PASSWORD!.replaceAll(" ", ""),
          }
        : {
            type: "OAuth2",
            user: env.GMAIL_USER_EMAIL,
            clientId: env.GMAIL_CLIENT_ID,
            clientSecret: env.GMAIL_CLIENT_SECRET,
            refreshToken: env.GMAIL_REFRESH_TOKEN,
          },
  });
  return transporter;
}

/**
 * Probes the SMTP credentials. Called once at boot (see `server.ts`) so a bad
 * or expired credential shows up as a startup error instead of silently
 * swallowing every OTP, reminder and contact email — most sends are
 * fire-and-forget, so a broken transporter is otherwise invisible.
 */
export async function verifyMailTransporter(): Promise<boolean> {
  const mode = mailAuthMode();
  try {
    await getTransporter().verify();
    logger.info({ mode }, "Mail transporter verified successfully.");
    return true;
  } catch (error) {
    logger.error(
      { err: error, mode },
      "Mail transporter verification failed — OTP, reminder and contact emails will not be delivered.",
    );
    return false;
  }
}

/**
 * Single send path shared by every template. Failures go through the same
 * `handlerNodeMailerError` contract as before, so a direct caller still gets a
 * proper `AppError` while fire-and-forget callers (see `sendInBackground`) are
 * expected to swallow it.
 */
async function sendMail(
  to: string,
  subject: string,
  html: string,
  options?: { replyTo?: string },
): Promise<void> {
  if (isUndeliverableAddress(to)) {
    logger.warn(
      { to, subject },
      "Skipped email: recipient domain is reserved and cannot receive mail (RFC 2606). Sign in with a real address to receive notifications.",
    );
    return;
  }

  try {
    await getTransporter().sendMail({
      from: env.GMAIL_USER_EMAIL,
      to,
      subject,
      html,
      // Spread conditionally: `exactOptionalPropertyTypes` rejects passing an
      // explicit `undefined` for nodemailer's optional `replyTo`.
      ...(options?.replyTo !== undefined && { replyTo: options.replyTo }),
    });
  } catch (error) {
    handlerNodeMailerError(error);
  }
}

/**
 * Runs a notification send without letting a mail failure fail the primary
 * action that triggered it (e.g. cancelling an interview must still succeed if
 * the confirmation email bounces).
 *
 * `label` names the mail so a failure is traceable: the rejection is logged with
 * the message it belongs to instead of being discarded. A `handlerNodeMailerError`
 * rejection is already logged inside `sendMail`, but a callback that throws
 * *before* reaching the transporter (a failed lookup, a bad template argument)
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
  await sendMail(email, subject, getEmailTemplate(otp, email, subject));
};

/** One-time welcome mail, sent right after the registration OTP is verified. */
export const sendWelcomeMail = async (email: string, firstName?: string): Promise<void> => {
  await sendMail(email, "Welcome to SyntheView AI", getWelcomeEmailTemplate(email, firstName));
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
  );
};

/**
 * Public contact form → team inbox. The team address is the app's own inbox
 * (`GMAIL_USER_EMAIL`) and `replyTo` is the visitor, so support can answer
 * without copying an address out of the body.
 */
export const sendContactMessageMail = async (
  details: ContactMessageDetails,
): Promise<void> => {
  await sendMail(
    env.GMAIL_USER_EMAIL,
    `New contact form message: ${details.subject}`,
    getContactMessageTemplate(details),
    { replyTo: details.email },
  );
};

/** Confirmation to the visitor; sent in the background so a bounce cannot fail
 * a submission the team already received. */
export const sendContactAcknowledgementMail = async (
  email: string,
  details: ContactAcknowledgementDetails,
): Promise<void> => {
  await sendMail(
    email,
    "We received your message",
    getContactAcknowledgementTemplate(email, details),
  );
};
