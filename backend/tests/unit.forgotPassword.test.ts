/**
 * unit.forgotPassword.test.ts — the password-reset OTP flow.
 *
 * The mail service is the only thing stubbed (plus the database and Redis), so
 * these tests exercise the real service code: which OTP purpose is stored, that
 * the OTP is emailed, and that an unknown or inactive account stays silent.
 *
 * The account-lookup is deliberately vague in production — it must not reveal
 * whether an address exists — so the silent paths are asserted as carefully as
 * the sending one.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatusCodes } from "http-status-codes";

import { OTP_PURPOSE } from "../src/constants/auth.constants.js";
import { AppError } from "../src/utils/AppError.js";
import { ErrorCodes } from "../src/constants/errorCodes.js";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  storeOTP: vi.fn(),
  sendOtpMail: vi.fn(),
}));

vi.mock("../src/db/postgres.init.js", () => ({
  getPgDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
  }),
}));

vi.mock("../src/services/redis.service.js", () => ({
  otpService: { storeOTP: mocks.storeOTP },
}));

// Every export the auth service imports has to exist on the mock, because the
// factory replaces the whole module.
vi.mock("../src/services/mail.service.js", () => ({
  sendOtpMail: mocks.sendOtpMail,
  sendWelcomeMail: vi.fn(),
  sendNewLoginAlertMail: vi.fn(),
  sendCredentialUpdatedMail: vi.fn(),
  sendAccountDeletedMail: vi.fn(),
  sendInBackground: vi.fn(),
  verifyMailTransporter: vi.fn(),
}));

const { forgotPasswordService } = await import("../src/modules/auth/services/auth.service.js");

const EMAIL = "candidate@ispmail.dev";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.limit.mockResolvedValue([{ id: "user-1", accountStatus: "active" }]);
  mocks.storeOTP.mockResolvedValue({ success: true });
  mocks.sendOtpMail.mockResolvedValue(undefined);
});

describe("forgotPasswordService", () => {
  it("stores a reset OTP and emails it to an active account", async () => {
    await expect(forgotPasswordService({ email: EMAIL })).resolves.toBeUndefined();

    expect(mocks.storeOTP).toHaveBeenCalledTimes(1);
    expect(mocks.storeOTP).toHaveBeenCalledWith(
      EMAIL,
      expect.stringMatching(/^\d{6}$/),
      OTP_PURPOSE.FORGOT_PASSWORD,
      "user-1",
    );

    // The OTP in the mail is the same one that was stored.
    const storedOtp = mocks.storeOTP.mock.calls[0]?.[1] as string;
    expect(mocks.sendOtpMail).toHaveBeenCalledWith(EMAIL, storedOtp);
  });

  it("does nothing for an address that has no account", async () => {
    mocks.limit.mockResolvedValue([]);

    await expect(forgotPasswordService({ email: EMAIL })).resolves.toBeUndefined();

    expect(mocks.storeOTP).not.toHaveBeenCalled();
    expect(mocks.sendOtpMail).not.toHaveBeenCalled();
  });

  it("does nothing for an account that is not active", async () => {
    mocks.limit.mockResolvedValue([{ id: "user-1", accountStatus: "disabled" }]);

    await expect(forgotPasswordService({ email: EMAIL })).resolves.toBeUndefined();

    expect(mocks.storeOTP).not.toHaveBeenCalled();
    expect(mocks.sendOtpMail).not.toHaveBeenCalled();
  });

  it("surfaces a delivery failure instead of pretending the mail was sent", async () => {
    mocks.sendOtpMail.mockRejectedValue(
      new AppError(
        "Failed to send email. Please try again later.",
        StatusCodes.INTERNAL_SERVER_ERROR,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        { isOperational: true },
      ),
    );

    await expect(forgotPasswordService({ email: EMAIL })).rejects.toMatchObject({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
    });
  });

  it("surfaces a database failure", async () => {
    mocks.limit.mockRejectedValue(new Error("Database error"));

    await expect(forgotPasswordService({ email: EMAIL })).rejects.toThrow("Database error");
  });
});
