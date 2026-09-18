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
  blacklistToken: vi.fn().mockResolvedValue(undefined),
  isTokenBlacklisted: vi.fn(),
  verifyToken: vi.fn(),
  COOKIE_NAMES: { ACCESS: "access_token", REFRESH: "refresh_token", DEVICE_ID: "device_id" },
  COOKIE_OPTIONS: {},
}));

vi.mock("bcrypt", () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { logoutService } from "../src/modules/auth/services/auth.service.js";
import { getPgDb } from "../src/db/postgres.init.js";
import { blacklistToken } from "../src/utils/token.util.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const sessionRecord = { id: "session-uuid", userId: "user-uuid" };
const userRecord = { sessionCount: 3 };

type DbMockOptions = {
  sessionResult?: unknown[];
  userResult?: unknown[];
};

function mockDb({
  sessionResult = [sessionRecord],
  userResult = [userRecord],
}: DbMockOptions = {}) {
  let selectCallCount = 0;

  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };

  const select = vi.fn().mockImplementation(() => {
    selectCallCount++;
    const result = selectCallCount === 1 ? sessionResult : userResult;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(result),
        }),
      }),
    };
  });

  const update = vi.fn().mockReturnValue(updateChain);

  vi.mocked(getPgDb).mockReturnValue({ select, update } as never);
  return { select, update, updateChain };
}

// ── logoutService ─────────────────────────────────────────────────────────────

describe("logoutService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without error on successful logout", async () => {
    mockDb();

    await expect(
      logoutService("session-uuid", "access-token", "refresh-token"),
    ).resolves.toBeUndefined();
  });

  it("blacklists both access and refresh tokens", async () => {
    mockDb();

    await logoutService("session-uuid", "access-token", "refresh-token");

    expect(blacklistToken).toHaveBeenCalledWith("access-token");
    expect(blacklistToken).toHaveBeenCalledWith("refresh-token");
    expect(blacklistToken).toHaveBeenCalledTimes(2);
  });

  it("marks session as inactive and revoked", async () => {
    const { update, updateChain } = mockDb();

    await logoutService("session-uuid", "access-token", "refresh-token");

    expect(update).toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith({ isActive: false, isRevoked: true });
  });

  it("decrements user sessionCount by 1", async () => {
    const { updateChain } = mockDb({ userResult: [{ sessionCount: 3 }] });

    await logoutService("session-uuid", "access-token", "refresh-token");

    expect(updateChain.set).toHaveBeenCalledWith({ sessionCount: 2 });
  });

  it("does not decrement sessionCount below 0", async () => {
    const { updateChain } = mockDb({ userResult: [{ sessionCount: 0 }] });

    await logoutService("session-uuid", "access-token", "refresh-token");

    expect(updateChain.set).toHaveBeenCalledWith({ sessionCount: 0 });
  });

  it("throws RESOURCE_NOT_FOUND when session does not exist", async () => {
    mockDb({ sessionResult: [] });

    await expect(
      logoutService("nonexistent-session", "access-token", "refresh-token"),
    ).rejects.toMatchObject({
      statusCode: StatusCodes.NOT_FOUND,
      errorCode: ErrorCodes.RESOURCE_NOT_FOUND,
    });
  });

  it("does not blacklist tokens when session is not found", async () => {
    mockDb({ sessionResult: [] });

    await expect(
      logoutService("nonexistent-session", "access-token", "refresh-token"),
    ).rejects.toThrow();

    expect(blacklistToken).not.toHaveBeenCalled();
  });

  it("skips sessionCount update when user record is not found", async () => {
    const { update } = mockDb({ userResult: [] });

    await logoutService("session-uuid", "access-token", "refresh-token");

    // update called once for session removal, not a second time for user
    const setCalls = vi.mocked(update).mock.results;
    expect(setCalls.length).toBe(1);
  });
});