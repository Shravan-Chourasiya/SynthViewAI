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

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("new-hashed-password"),
  },
}));


// ── Imports after mocks ───────────────────────────────────────────────────────

import { recoverAccountService } from "../src/modules/auth/services/auth.service.js";
import { AppError } from "../src/utils/AppError.js";
import { verifyToken } from "../src/utils/token.util.js";
import { getPgDb } from "../src/db/postgres.init.js";
import bcrypt from "bcrypt";

// ── Helpers ───────────────────────────────────────────────────────────────────

const userWithResetToken = {
  id: "user-uuid",
  email: "user@example.com",
  password: "old-hashed-password",
  resetToken: "valid-reset-token",
  resetTokenExpiry: new Date(Date.now() + 1000 * 60 * 10), // 10 minutes from now
};

type DbMockOptions = {
  userResult?: unknown[];
};

function mockDb({ userResult = [userWithResetToken] }: DbMockOptions = {}) {
  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(userResult),
      }),
    }),
  });

  const update = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ id: "user-uuid" }]),
  });

  vi.mocked(getPgDb).mockReturnValue({ select, update } as never);
  return { select, update };
}

// ── recoverAccountService ─────────────────────────────────────────────────────

describe("recoverAccountService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without error when valid token and new password provided", async () => {
    mockDb();

    await expect(
      recoverAccountService("valid-reset-token", "NewPass123!"),
    ).resolves.toBeUndefined();
  });

  it("hashes and saves the new password", async () => {
    const { update } = mockDb();

    await recoverAccountService("valid-reset-token", "NewPass123!");

    expect(bcrypt.hash).toHaveBeenCalledWith("NewPass123!", expect.any(Number));
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        password: "new-hashed-password",
        resetToken: null,
        resetTokenExpiry: null,
      }),
    );
  });

  it("clears reset token and expiry after successful recovery", async () => {
    const { update } = mockDb();

    await recoverAccountService("valid-reset-token", "NewPass123!");

    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        resetToken: null,
        resetTokenExpiry: null,
      }),
    );
  });

  it("throws AUTH_TOKEN_EXPIRED when reset token is not found", async () => {
    mockDb({ userResult: [] });

    await expect(
      recoverAccountService("invalid-reset-token", "NewPass123!"),
    ).rejects.toMatchObject({
      statusCode: StatusCodes.UNAUTHORIZED,
      errorCode: ErrorCodes.AUTH_TOKEN_EXPIRED,
    });
  });

  it("throws AUTH_TOKEN_EXPIRED when reset token is expired", async () => {
    mockDb({
      userResult: [
        {
          ...userWithResetToken,
          resetTokenExpiry: new Date(Date.now() - 1000 * 60), // 1 minute ago
        },
      ],
    });

    await expect(
      recoverAccountService("expired-reset-token", "NewPass123!"),
    ).rejects.toMatchObject({
      statusCode: StatusCodes.UNAUTHORIZED,
      errorCode: ErrorCodes.AUTH_TOKEN_EXPIRED,
    });
  });

  it("throws VALIDATION_FAILED when new password does not meet requirements", async () => {
    mockDb();

    await expect(
      recoverAccountService("valid-reset-token", "weak"), // Too short, no caps/numbers
    ).rejects.toMatchObject({
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      errorCode: ErrorCodes.VALIDATION_FAILED,
    });
  });

  it("throws INTERNAL_SERVER_ERROR when DB update fails", async () => {
    mockDb();
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockRejectedValue(new Error("DB error")),
    });
    vi.mocked(getPgDb).mockReturnValue({ select: vi.fn(), update } as never);

    await expect(
      recoverAccountService("valid-reset-token", "NewPass123!"),
    ).rejects.toMatchObject({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
    });
  });
});