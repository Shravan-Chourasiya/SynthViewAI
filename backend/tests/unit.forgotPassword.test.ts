import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { ErrorCodes } from "../src/constants/errorCodes.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../src/db/postgres.init.js", () => ({
  getPgDb: vi.fn(),
  default: vi.fn(),
}));

vi.mock("../src/utils/token.util.js", () => ({
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  blacklistToken: vi.fn(),
  isTokenBlacklisted: vi.fn(),
  verifyToken: vi.fn(),
  COOKIE_NAMES: { ACCESS: "access_token", REFRESH: "refresh_token", DEVICE_ID: "device_id" },
  COOKIE_OPTIONS: {},
}));

vi.mock("../src/services/nodemailer.service.js", () => ({
  emailService: {
    sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("bcrypt", () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}));

vi.mock("../src/modules/auth/services/auth.service.js", () => ({
  forgotPasswordService: vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { forgotPasswordService } from "../src/modules/auth/services/auth.service.js";
import { getPgDb } from "../src/db/postgres.init.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const activeUser = {
  id: "user-uuid",
  email: "user@example.com",
  password: "hashed-password",
  isVerified: true,
  accountStatus: "active",
};

type DbMockOptions = {
  userResult?: unknown[];
};

function mockDb({ userResult = [activeUser] }: DbMockOptions = {}) {
  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(userResult),
      }),
    }),
  });

  const update = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ resetToken: "mock-reset-token" }]),
  });

  vi.mocked(getPgDb).mockReturnValue({ select, update } as never);
  return { select, update };
}

// ── forgotPasswordService ─────────────────────────────────────────────────────

describe("forgotPasswordService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without error when email exists and email is sent", async () => {
    mockDb();

    await expect(forgotPasswordService("user@example.com")).resolves.toBeUndefined();
  });

  it("generates and stores password reset token", async () => {
    const { update } = mockDb();

    await forgotPasswordService("user@example.com");

    expect(update).toHaveBeenCalled();
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        resetToken: expect.any(String),
      }),
    );
  });

  it("sends password reset email with the generated token", async () => {
    mockDb();

    await forgotPasswordService("user@example.com");

    expect(vi.mocked(getPgDb).mock.results[0].value.emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.any(String), // reset token
    );
  });

  it("does not throw when email does not exist (silent failure for security)", async () => {
    mockDb({ userResult: [] });

    await expect(forgotPasswordService("nonexistent@example.com")).resolves.toBeUndefined();
  });

  it("does not send email when user not found", async () => {
    mockDb({ userResult: [] });

    await forgotPasswordService("nonexistent@example.com");

    expect(vi.mocked(getPgDb).mock.results[0].value.emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("throws INTERNAL_SERVER_ERROR when email sending fails", async () => {
    mockDb();
    vi.mocked(getPgDb).mock.results[0].value.emailService.sendPasswordResetEmail.mockResolvedValue({
      success: false,
      error: "SMTP error",
    });

    await expect(forgotPasswordService("user@example.com")).rejects.toMatchObject({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
    });
  });

  it("throws INTERNAL_SERVER_ERROR when DB update fails", async () => {
    mockDb();
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockRejectedValue(new Error("DB error")),
    });
    vi.mocked(getPgDb).mockReturnValue({ select: vi.fn(), update } as never);

    await expect(forgotPasswordService("user@example.com")).rejects.toMatchObject({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
    });
  });
});