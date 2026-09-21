import { StatusCodes } from "http-status-codes";
import { AppError } from "./appError.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { logger } from "./logger.js";

export const getRandomOtp = (length = 6): string => {
  const max = 10;
  const limit = 256 - (256 % max);
  const result: string[] = [];
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (result.length === length) break;
      if (b < limit) result.push((b % max).toString());
    }
  }
  return result.join("");
};

// ── Shared email layout ───────────────────────────────────────────────────────
// Every transactional mail renders through one layout so the notification
// templates added alongside the OTP template share consistent header/footer and
// styling instead of seven unrelated one-off HTML strings.

interface EmailLayoutInput {
  subject: string;
  heading: string;
  intro?: string;
  bodyHtml: string;
  footnote?: string;
}

/** Escapes user-supplied values before they are interpolated into email HTML. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Renders a compact two-column "label → value" block used by several templates. */
function detailRows(rows: [string, string][]): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:6px 0;color:#6b7280;width:150px;vertical-align:top;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#1f2430;">${escapeHtml(value)}</td>` +
        `</tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.6;border-collapse:collapse;">${cells}</table>`;
}

/** Formats a timestamp for display in a mail body (UTC, unambiguous). */
function formatWhen(value: Date): string {
  return value.toUTCString();
}

/** Returns `fallback` when the supplied name is missing or blank. */
function displayName(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function renderEmailLayout({
  subject,
  heading,
  intro,
  bodyHtml,
  footnote,
}: EmailLayoutInput): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2430;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e6ea;">
            <tr>
              <td style="background:#111827;padding:20px 28px;color:#ffffff;font-size:16px;font-weight:bold;">SyntheView AI</td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${escapeHtml(heading)}</h1>
                ${intro ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">${intro}</p>` : ""}
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e3e6ea;font-size:12px;line-height:1.6;color:#6b7280;">
                ${escapeHtml(footnote ?? "You are receiving this email because of activity on your SyntheView AI account.")}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const getEmailTemplate = (otp: string, emailto: string, subject: string): string => {
  return renderEmailLayout({
    subject,
    heading: subject,
    intro: `Hello <strong>${escapeHtml(emailto)}</strong>,`,
    bodyHtml:
      `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Your one-time password (OTP) is:</p>` +
      `<p style="margin:0 0 16px;font-size:22px;font-weight:bold;letter-spacing:3px;">${escapeHtml(otp)}</p>` +
      `<p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563;">This OTP is valid for a limited time. Do not share it with anyone.</p>`,
  });
};

// ── Notification templates ────────────────────────────────────────────────────

export const getWelcomeEmailTemplate = (emailto: string, firstName?: string): string => {
  const name = displayName(firstName, emailto);
  return renderEmailLayout({
    subject: "Welcome to SyntheView AI",
    heading: `Welcome aboard, ${name}!`,
    intro: "Your email is verified and your account is ready.",
    bodyHtml:
      `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">SyntheView AI runs adaptive mock interviews that adjust to how you answer, then gives you a scored report with per-question feedback.</p>` +
      `<p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563;">Start your first interview from the dashboard whenever you're ready.</p>`,
    footnote: "This is a one-time welcome email — we won't send it again.",
  });
};

export interface LoginAlertDetails {
  deviceType: string;
  ipAddress: string;
  userAgent: string;
  signedInAt: Date;
}

export const getNewLoginAlertTemplate = (emailto: string, details: LoginAlertDetails): string => {
  return renderEmailLayout({
    subject: "New sign-in to your SyntheView AI account",
    heading: "New sign-in detected",
    intro: `Hello ${emailto}, we noticed a sign-in from a device we haven't seen on your account before.`,
    bodyHtml:
      detailRows([
        ["Device", details.deviceType],
        ["IP address", details.ipAddress],
        ["Browser", details.userAgent],
        ["Time", formatWhen(details.signedInAt)],
      ]) +
      `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">If this was you, no action is needed. If you don't recognise it, change your password immediately and review your active sessions.</p>`,
    footnote:
      "You're seeing this because a new device signed in — we skip this email for devices you already use.",
  });
};

export interface CredentialUpdateDetails {
  field: "password" | "email";
  changedAt: Date;
  /** Present when `field` is "email": the new address on the account. */
  newEmail?: string;
}

export const getCredentialUpdatedTemplate = (
  emailto: string,
  details: CredentialUpdateDetails,
): string => {
  const label = details.field === "password" ? "password" : "email address";
  const rows: [string, string][] = [["What changed", `Your ${label}`]];
  if (details.field === "email" && details.newEmail) {
    rows.push(["New email", details.newEmail]);
  }
  rows.push(["Time", formatWhen(details.changedAt)]);

  return renderEmailLayout({
    subject: `Your SyntheView AI ${label} was updated`,
    heading: `Your ${label} was updated`,
    intro: `Hello ${emailto}, this is a confirmation that a security-related change was just made.`,
    bodyHtml:
      detailRows(rows) +
      `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">If you didn't make this change, reset your password and secure your account right away.</p>`,
  });
};

export interface AccountSuspendedDetails {
  reason: string;
  suspendedAt: Date;
}

export const getAccountSuspendedTemplate = (
  emailto: string,
  details: AccountSuspendedDetails,
): string => {
  return renderEmailLayout({
    subject: "Your SyntheView AI account has been suspended",
    heading: "Your account has been suspended",
    intro: `Hello ${emailto}, access to your account has been suspended by an administrator.`,
    bodyHtml:
      detailRows([
        ["Reason", details.reason],
        ["Time", formatWhen(details.suspendedAt)],
      ]) +
      `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">While suspended you can't start new interviews. If you believe this is a mistake, reply to this email to appeal the decision.</p>`,
  });
};

export interface AccountDeletedDetails {
  deletedAt: Date;
  recoveryWindowDays: number;
}

export const getAccountDeletedTemplate = (
  emailto: string,
  details: AccountDeletedDetails,
): string => {
  return renderEmailLayout({
    subject: "Your SyntheView AI account is scheduled for deletion",
    heading: "Account deletion scheduled",
    intro: `Hello ${emailto}, your account has been deactivated and is scheduled for permanent deletion.`,
    bodyHtml:
      detailRows([
        ["Requested", formatWhen(details.deletedAt)],
        ["Recovery window", `${details.recoveryWindowDays} day(s)`],
      ]) +
      `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">Changed your mind? Use “Recover account” on the sign-in screen before the recovery window ends to restore your data.</p>`,
  });
};

export interface InterviewReminderDetails {
  /** Human-readable role/company description shown to the candidate. */
  interviewTitle: string;
  scheduledAt: Date;
  /** e.g. "24 hours" or "1 hour" — the lead time this reminder represents. */
  leadTimeLabel: string;
}

export const getInterviewReminderTemplate = (
  emailto: string,
  details: InterviewReminderDetails,
): string => {
  return renderEmailLayout({
    subject: `Reminder: your interview starts in ${details.leadTimeLabel}`,
    heading: `Your interview starts in ${details.leadTimeLabel}`,
    intro: `Hello ${emailto}, this is a reminder for your upcoming SyntheView AI interview.`,
    bodyHtml:
      detailRows([
        ["Interview", details.interviewTitle],
        ["Scheduled for", formatWhen(details.scheduledAt)],
      ]) +
      `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">Open the dashboard a few minutes early to run the device check before you begin.</p>`,
  });
};

export interface InterviewCancelledDetails {
  interviewTitle: string;
  cancelledAt: Date;
}

export const getInterviewCancelledTemplate = (
  emailto: string,
  details: InterviewCancelledDetails,
): string => {
  return renderEmailLayout({
    subject: "Your interview has been cancelled",
    heading: "Interview cancelled",
    intro: `Hello ${emailto}, your interview has been cancelled and the session has been closed.`,
    bodyHtml:
      detailRows([
        ["Interview", details.interviewTitle],
        ["Cancelled", formatWhen(details.cancelledAt)],
      ]) +
      `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">You can start a new adaptive interview from your dashboard at any time.</p>`,
  });
};

export interface PausedInterviewReminderDetails {
  interviewTitle: string;
  pausedSince: Date;
}

export const getPausedInterviewReminderTemplate = (
  emailto: string,
  details: PausedInterviewReminderDetails,
): string => {
  return renderEmailLayout({
    subject: "You left an interview paused",
    heading: "Pick up where you left off",
    intro: `Hello ${emailto}, you paused an interview more than 24 hours ago.`,
    bodyHtml:
      detailRows([
        ["Interview", details.interviewTitle],
        ["Paused since", formatWhen(details.pausedSince)],
      ]) +
      `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">Your progress is saved. Resume it from the dashboard before it goes stale, or start a fresh session if you'd prefer.</p>`,
  });
};

export const handlerNodeMailerError = (error: unknown): never => {
  // Pino serializes Error instances under the conventional `err` key. This
  // preserves the provider error/message for diagnostics without exposing it
  // in the HTTP response.
  logger.error({ err: error }, "Nodemailer error occurred");
  throw new AppError(
    "Failed to send email. Please try again later.",
    StatusCodes.INTERNAL_SERVER_ERROR,
    ErrorCodes.INTERNAL_SERVER_ERROR,
    { isOperational: true },
  );
};
