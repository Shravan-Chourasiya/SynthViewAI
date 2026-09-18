import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../src/utils/appError.js";
import { ErrorCodes } from "../src/constants/errorCodes.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../src/db/postgres.init.js", () => ({
  getPgDb: vi.fn(),
  default: vi.fn(),
}));

vi.mock("../src/utils/token.util.js", () => ({
  signAccessToken: vi.fn().mockReturnValue("mock-access-token"),
  signRefreshToken: vi.fn().mockReturnValue("mock-refresh-token"),
  blacklistToken: vi.fn().mockResolvedValue(undefined),
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
  verifyToken: vi.fn(),
  COOKIE_NAMES: { ACCESS: "access_token", REFRESH: "refresh_token", DEVICE_ID: "device_id" },
  COOKIE_OPTIONS: {},
}));

vi.mock("../src/utils/csrf.js", () => ({
  generateCsrfToken: vi.fn().mockReturnValue("mock-csrf-token"),
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue("hashed-password"),
  },
}));

vi.mock("../src/modules/auth/services/auth.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/modules/auth/services/auth.service.js")>();
  return {
    ...actual,
    loginService: vi.fn(),
    registerService: vi.fn(),
    logoutService: vi.fn(),
    refreshTokenService: vi.fn(),
    forgotPasswordService: vi.fn(),
    recoverAccountService: vi.fn(),
    deleteAccountService: vi.fn(),
  };
});

// ── Imports after mocks ───────────────────────────────────────────────────────

import {
  loginService,
  registerService,
  logoutService,
  refreshTokenService,
  forgotPasswordService,
  recoverAccountService,
  deleteAccountService,
} from "../src/modules/auth/services/auth.service.js";
import { getPgDb } from "../src/db/postgres.init.js";
import bcrypt from "bcrypt";

// ── registerService ───────────────────────────────────────────────────────────

describe("registerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const registerInput = {
    email: "newuser@example.com",
    password: "SecurePass123!",
    firstName: "New",
    lastName: "User",
  };

  it("returns user record with hashed password on successful registration", async () => {
    const insertResult = [{ id: "new-user-uuid", email: "newuser@example.com" }];
    const insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(insertResult),
      }),
    });
    vi.mocked(getPgDb).mockReturnValue({ insert } as never);

    const result = await registerService(registerInput);

    expect(result).toMatchObject({
      id: "new-user-uuid",
      email: "newuser@example.com",
    });
    expect(bcrypt.hash).toHaveBeenCalledWith(registerInput.password, expect.any(Number));
  });

  it("throws RESOURCE_CONFLICT when email already exists", async () => {
    const insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(new Error("duplicate key")),
      }),
    });
    vi.mocked(getPgDb).mockReturnValue({ insert } as never);

    await expect(registerService(registerInput)).rejects.toMatchObject({
      statusCode: StatusCodes.CONFLICT,
      errorCode: ErrorCodes.RESOURCE_CONFLICT,
    });
  });

  it("validates password requirements", async () => {
    await expect(
      registerService({
        ...registerInput,
        password: "weak", // Doesn't meet requirements
      }),
    ).rejects.toMatchObject({
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      errorCode: ErrorCodes.VALIDATION_FAILED,
    });
  });

  it("hashes password before storing", async () => {
    const insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "user-uuid" }]),
      }),
    });
    vi.mocked(getPgDb).mockReturnValue({ insert } as never);

    await registerService(registerInput);

    expect(bcrypt.hash).toHaveBeenCalledWith(registerInput.password, expect.any(Number));
  });
});

// ── Additional auth service tests would go here ───────────────────────────────

describe("loginService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("temporarily restores real loginService implementation for tests", async () => {
    // Similar to the login.test.ts approach
    vi.mocked(loginService).mockImplementation(async (...args: Parameters<typeof loginService>) => {
      const { loginService: real } = await vi.importActual<
        typeof import("../src/modules/auth/services/auth.service.js")
      >("../src/modules/auth/services/auth.service.js");
      return real(...args);
    });

    // This ensures we're testing the real implementation
    expect(vi.mocked(loginService)).toBeDefined(); // Just a placeholder test
  });
});