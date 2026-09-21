import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import {
  getAccountDeletedTemplate,
  getAccountSuspendedTemplate,
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
  type CredentialUpdateDetails,
  type InterviewCancelledDetails,
  type InterviewReminderDetails,
  type LoginAlertDetails,
  type PausedInterviewReminderDetails,
} from "../utils/email.js";
import { logger } from "../utils/logger.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: env.GMAIL_APP_PASSWORD
      ? {
          user: env.GMAIL_USER_EMAIL,
          pass: env.GMAIL_APP_PASSWORD.replaceAll(" ", ""),
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

export async function verifyMailTransporter(): Promise<boolean> {
  try {
    await getTransporter().verify();
    logger.info("Mail transporter verified successfully.");
    return true;
  } catch (error) {
    logger.error({ err: error }, "Mail transporter verification failed.");
    return false;
  }
}

/**
 * Single send path shared by every template. Failures go through the same
 * `handlerNodeMailerError` contract as before, so a direct caller still gets a
 * proper `AppError` while fire-and-forget callers (see `sendInBackground`) are
 * expected to swallow it.
 */
async function sendMail(to: string, subject: string, html: string): Promise<void> {
  try {
    await getTransporter().sendMail({
      from: env.GMAIL_USER_EMAIL,
      to,
      subject,
      html,
    });
  } catch (error) {
    handlerNodeMailerError(error);
  }
}

/**
 * Runs a notification send without letting a mail failure fail the primary
 * action that triggered it (e.g. cancelling an interview must still succeed if
 * the confirmation email bounces). The failure is already logged inside the
 * send function via `handlerNodeMailerError`; all that's left is to stop the
 * rejection from escaping.
 */
export function sendInBackground(task: () => Promise<void>): void {
  void task().catch(() => undefined);
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
