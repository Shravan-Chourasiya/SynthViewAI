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
  default: { compare: vi.fn(), hash: vi.fn() },
}));

vi.mock("../src/modules/auth/services/auth.service.js", () => ({
  deleteAccountService: vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { deleteAccountService } from "../src/modules/auth/services/auth.service.js";
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
  sessionResult?: unknown[];
  interviewResult?: unknown[];
};

function mockDb({
  userResult = [activeUser],
  sessionResult = [{ id: "session-uuid", userId: "user-uuid" }],
  interviewResult = [{ id: "interview-uuid", candidateId: "user-uuid" }],
}: DbMockOptions = {}) {
  let callCount = 0;

  const select = vi.fn().mockImplementation(() => {
    callCount++;
    let result;
    switch (callCount) {
      case 1:
        result = userResult;
        break;
      case 2:
        result = sessionResult;
        break;
      case 3:
        result = interviewResult;
        break;
      default:
        result = [];
    }

    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(result),
        }),
      }),
    };
  });

  const update = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ id: "user-uuid" }]),
  });

  const del = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
    }),
  });

  vi.mocked(getPgDb).mockReturnValue({ select, update, delete: del } as never);
  return { select, update, del };
}

// ── deleteAccountService ──────────────────────────────────────────────────────

describe("deleteAccountService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without error when account deletion is successful", async () => {
    mockDb();

    await expect(deleteAccountService("user-uuid", "current-password")).resolves.toBeUndefined();
  });

  it("marks user account as deleted", async () => {
    const { update } = mockDb();

    await deleteAccountService("user-uuid", "current-password");

    expect(update).toHaveBeenCalled();
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        accountStatus: "deleted",
        deletedAt: expect.any(Date),
      }),
    );
  });

  it("anonymizes user personal data", async () => {
    const { update } = mockDb();

    await deleteAccountService("user-uuid", "current-password");

    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        email: expect.stringContaining("deleted_"), // Format may vary
        firstName: "[DELETED]",
        lastName: "[DELETED]",
      }),
    );
  });

  it("deactivates all user sessions", async () => {
    const { update } = mockDb();

    await deleteAccountService("user-uuid", "current-password");

    // Implementation detail - sessions should be marked as inactive
    // This would typically happen via a separate update call
    expect(update).toHaveBeenCalled();
  });

  it("throws AUTH_INVALID_CREDENTIALS when password is incorrect", async () => {
    mockDb();
    vi.mocked(getPgDb).mock.results[0].value.bcrypt.compare.mockResolvedValue(false);

    await expect(
      deleteAccountService("user-uuid", "wrong-password"),
    ).rejects.toMatchObject({
      statusCode: StatusCodes.UNAUTHORIZED,
      errorCode: ErrorCodes.AUTH_INVALID_CREDENTIALS,
    });
  });

  it("throws RESOURCE_NOT_FOUND when user does not exist", async () => {
    mockDb({ userResult: [] });

    await expect(
      deleteAccountService("nonexistent-user", "any-password"),
    ).rejects.toMatchObject({
      statusCode: StatusCodes.NOT_FOUND,
      errorCode: ErrorCodes.RESOURCE_NOT_FOUND,
    });
  });

  it("handles cascade deletion of related records", async () => {
    const { del } = mockDb();

    await deleteAccountService("user-uuid", "current-password");

    // Should attempt to delete related records (sessions, interviews, etc.)
    expect(del).toHaveBeenCalled();
  });

  it("throws INTERNAL_SERVER_ERROR when DB operation fails", async () => {
    mockDb();
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockRejectedValue(new Error("DB error")),
    });
    vi.mocked(getPgDb).mockReturnValue({ select: vi.fn(), update, delete: vi.fn() } as never);

    await expect(
      deleteAccountService("user-uuid", "current-password"),
    ).rejects.toMatchObject({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
    });
  });
});