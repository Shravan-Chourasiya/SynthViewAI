/**
 * unit.mailService.test.ts — the mail service, with only the transport stubbed.
 *
 * The real templates, the real error mapping and the real sender configuration
 * all run here; only `utils/smtp.ts` is replaced, so nothing can leave the
 * process. That split is deliberate: the SMTP conversation itself is covered
 * against a real socket in `unit.smtp.test.ts`, and this file covers the
 * behaviour around it — which flows exist, what they put in the message, how a
 * failure is reported, and what ends up in the logs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../src/utils/AppError.js";

const mocks = vi.hoisted(() => ({
  sendSmtpMail: vi.fn(),
  verifySmtpConnection: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../src/utils/smtp.js", () => ({
  sendSmtpMail: mocks.sendSmtpMail,
  verifySmtpConnection: mocks.verifySmtpConnection,
}));

vi.mock("../src/utils/logger.js", () => ({ logger: mocks.logger }));

const {
  sendAccountDeletedMail,
  sendAccountSuspendedMail,
  sendContactAcknowledgementMail,
  sendContactMessageMail,
  sendCredentialUpdatedMail,
  sendInBackground,
  sendInterviewCancelledMail,
  sendInterviewReminderMail,
  sendNewLoginAlertMail,
  sendOtpMail,
  sendPausedInterviewReminderMail,
  sendWelcomeMail,
  verifyMailTransporter,
} = await import("../src/services/mail.service.js");

/** The env values stubbed in tests/setup.ts, which is what the service reads. */
const SENDER = { name: "SynthView AI", address: "no-reply@test.com" };
// Deliberately NOT a reserved domain (example.com/.test/.invalid...): mail to
// those is skipped by design, which is asserted separately below.
const RECIPIENT = "candidate@ispmail.dev";
const OTP = "123456";

interface SentMessage {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  from: { name: string; address: string };
}

function sentMessage(index = 0): SentMessage {
  const call = mocks.sendSmtpMail.mock.calls[index];
  if (call === undefined) throw new Error(`no transport call at index ${index}`);
  return call[1] as SentMessage;
}

/** Lets a fire-and-forget task settle before asserting on it. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendSmtpMail.mockResolvedValue({ code: 250, response: "250 2.0.0 Ok: queued" });
  mocks.verifySmtpConnection.mockResolvedValue({ capabilities: ["AUTH LOGIN PLAIN"], secure: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("sendOtpMail", () => {
  it("sends through the configured Brevo relay with the centralized sender", async () => {
    await sendOtpMail(RECIPIENT, OTP);

    expect(mocks.sendSmtpMail).toHaveBeenCalledTimes(1);
    const [config] = mocks.sendSmtpMail.mock.calls[0] as [Record<string, unknown>];

    expect(config).toMatchObject({
      host: "smtp-relay.brevo.com",
      port: 587,
      user: "test-smtp-user@test.com",
      password: "test-smtp-key",
    });

    const message = sentMessage();
    expect(message.from).toEqual(SENDER);
    expect(message.to).toBe(RECIPIENT);
    expect(message.subject).toBe("Your SyntheView OTP");
    expect(message.html).toContain(OTP);
  });

  it("logs the attempt and the success without an OTP, an address or a credential", async () => {
    await sendOtpMail(RECIPIENT, OTP);

    const logged = JSON.stringify([
      mocks.logger.info.mock.calls,
      mocks.logger.warn.mock.calls,
      mocks.logger.error.mock.calls,
    ]);

    expect(logged).toContain("ispmail.dev"); // the recipient domain is safe
    expect(logged).not.toContain(OTP);
    expect(logged).not.toContain(RECIPIENT);
    expect(logged).not.toContain("test-smtp-key");

    const attempt = mocks.logger.info.mock.calls.find(
      ([meta]) => (meta as Record<string, unknown>).mail === "otp",
    );
    expect(attempt?.[0]).toMatchObject({ mail: "otp", domain: "ispmail.dev", provider: "brevo" });
  });

  it("skips a recipient on a reserved domain instead of handing it to the relay", async () => {
    await expect(sendOtpMail("seeded@example.com", OTP)).resolves.toBeUndefined();

    expect(mocks.sendSmtpMail).not.toHaveBeenCalled();
    expect(mocks.logger.warn).toHaveBeenCalled();
  });
});

describe("error handling", () => {
  it("maps a provider rejection to the application's standard error", async () => {
    mocks.sendSmtpMail.mockRejectedValue(
      Object.assign(new Error("535 5.7.8 Authentication failed"), {
        code: "EAUTH",
        responseCode: 535,
      }),
    );

    const error = await sendOtpMail(RECIPIENT, OTP).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      statusCode: 500,
      errorCode: "INTERNAL_SERVER_ERROR",
      isOperational: true,
      // The relay's own words never reach a client.
      message: "Failed to send email. Please try again later.",
    });
    expect(mocks.logger.error).toHaveBeenCalled();
  });

  it("maps an unexpected provider failure the same way", async () => {
    mocks.sendSmtpMail.mockRejectedValue(new Error("socket hang up"));

    await expect(sendOtpMail(RECIPIENT, OTP)).rejects.toBeInstanceOf(AppError);
  });

  it("survives a non-Error rejection", async () => {
    mocks.sendSmtpMail.mockRejectedValue("provider exploded");

    await expect(sendOtpMail(RECIPIENT, OTP)).rejects.toMatchObject({ statusCode: 500 });
  });

  it("keeps a background send from failing its caller and logs the loss", async () => {
    sendInBackground("contact acknowledgement", () => Promise.reject(new Error("bounce")));
    await flush();

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ mail: "contact acknowledgement" }),
      "Background email was not delivered.",
    );
  });
});

describe("verifyMailTransporter", () => {
  it("reports success for a working relay", async () => {
    await expect(verifyMailTransporter()).resolves.toBe(true);
    expect(mocks.verifySmtpConnection).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp-relay.brevo.com", port: 587 }),
    );
  });

  it("reports failure without throwing, so boot is not blocked", async () => {
    mocks.verifySmtpConnection.mockRejectedValue(new Error("invalid login"));

    await expect(verifyMailTransporter()).resolves.toBe(false);
    expect(mocks.logger.error).toHaveBeenCalled();
  });
});

describe("the preserved notification flows", () => {
  const details = { changedAt: new Date("2026-01-01T10:00:00Z") };

  const flows: { name: string; run: () => Promise<void>; subject: string }[] = [
    {
      name: "registration OTP",
      run: () => sendOtpMail(RECIPIENT, OTP),
      subject: "Your SyntheView OTP",
    },
    {
      name: "welcome",
      run: () => sendWelcomeMail(RECIPIENT, "Ada"),
      subject: "Welcome to SyntheView AI",
    },
    {
      name: "new sign-in alert",
      run: () =>
        sendNewLoginAlertMail(RECIPIENT, {
          deviceType: "desktop",
          ipAddress: "203.0.113.7",
          userAgent: "vitest",
          signedInAt: new Date("2026-01-01T10:00:00Z"),
        }),
      subject: "New sign-in to your SyntheView AI account",
    },
    {
      name: "password changed",
      run: () => sendCredentialUpdatedMail(RECIPIENT, { field: "password", ...details }),
      subject: "Your SyntheView AI password was updated",
    },
    {
      name: "email changed",
      run: () =>
        sendCredentialUpdatedMail(RECIPIENT, {
          field: "email",
          newEmail: "new@ispmail.dev",
          ...details,
        }),
      subject: "Your SyntheView AI email was updated",
    },
    {
      name: "account suspended",
      run: () => sendAccountSuspendedMail(RECIPIENT, { reason: "terms", suspendedAt: new Date() }),
      subject: "Your SyntheView AI account has been suspended",
    },
    {
      name: "account deletion scheduled",
      run: () =>
        sendAccountDeletedMail(RECIPIENT, { deletedAt: new Date(), recoveryWindowDays: 30 }),
      subject: "Your SyntheView AI account is scheduled for deletion",
    },
    {
      name: "interview reminder",
      run: () =>
        sendInterviewReminderMail(RECIPIENT, {
          interviewTitle: "Backend Engineer",
          scheduledAt: new Date(),
          leadTimeLabel: "24 hours",
        }),
      subject: "Reminder: your interview starts in 24 hours",
    },
    {
      name: "interview cancelled",
      run: () =>
        sendInterviewCancelledMail(RECIPIENT, {
          interviewTitle: "Backend Engineer",
          cancelledAt: new Date(),
        }),
      subject: "Your interview has been cancelled",
    },
    {
      name: "paused interview reminder",
      run: () =>
        sendPausedInterviewReminderMail(RECIPIENT, {
          interviewTitle: "Backend Engineer",
          pausedSince: new Date(),
        }),
      subject: "You left an interview paused",
    },
    {
      name: "contact acknowledgement",
      run: () => sendContactAcknowledgementMail(RECIPIENT, { name: "Ada", subject: "Pricing" }),
      subject: "We received your message",
    },
  ];

  it.each(flows)("still sends the $name mail", async ({ run, subject }) => {
    await run();

    expect(mocks.sendSmtpMail).toHaveBeenCalledTimes(1);
    expect(sentMessage().subject).toBe(subject);
    expect(sentMessage().html).toContain("SyntheView");
    expect(sentMessage().from).toEqual(SENDER);
  });

  it("sends the contact form to the team inbox and replies to the visitor", async () => {
    await sendContactMessageMail({
      name: "Ada",
      email: "visitor@inbox.dev",
      subject: "Pricing",
      message: "What does it cost?",
      submittedAt: new Date(),
      ipAddress: "203.0.113.7",
      userAgent: "vitest",
    });

    const message = sentMessage();
    expect(message.to).toBe(SENDER.address);
    expect(message.replyTo).toBe("visitor@inbox.dev");
    expect(message.subject).toBe("New contact form message: Pricing");
    expect(message.html).toContain("What does it cost?");
  });
});
