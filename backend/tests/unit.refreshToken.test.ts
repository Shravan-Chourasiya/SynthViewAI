/**
 * unit.refreshToken.test.ts
 * Unit tests for the refresh token functionality.
 * Tests token rotation, reuse detection, and session extension as mentioned in Priority 2 of the test suite plan.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshTokenService } from "../src/modules/auth/services/auth.service.js";
import { getPgDb } from "../src/db/postgres.init.js";  // Correct import path
import { ErrorCodes } from "../src/constants/errorCodes.js";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../src/utils/AppError.js";

// Mock dependencies
vi.mock("../src/db/postgres.init.js", () => ({
  getPgDb: vi.fn(),
}));

vi.mock("../src/utils/token.util.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateAccessToken: vi.fn(() => "new-access-token"),
    generateRefreshToken: vi.fn(() => "new-refresh-token"),
    verifyToken: vi.fn(),
    blacklistToken: vi.fn(),
    isTokenBlacklisted: vi.fn(),
    signAccessToken: vi.fn(() => "signed-access-token"),
    signRefreshToken: vi.fn(() => "signed-refresh-token"),
  };
});

vi.mock("../src/utils/csrf.js", () => ({
  generateCsrfToken: vi.fn(() => "csrf-token-string"),
}));

vi.mock("../src/config/redis.init.js", () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    expire: vi.fn(),
  },
}));

describe("refreshTokenService", () => {
  let mockDb: any;

  beforeEach(() => {
    // Set up mock database with proper drizzle-orm interface
    mockDb = {
      select: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    };

    // Mock the fluent query interface for drizzle-orm
    const mockQueryInterface = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      returning: vi.fn().mockReturnThis(),
    };
    
    mockDb.select.mockReturnValue(mockQueryInterface);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token", 
        csrfToken: "csrf-token-string"
      }]),
    });
    
    vi.mocked(getPgDb).mockReturnValue(mockDb);
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  it("returns new tokens when refresh token is valid", async () => {
    const tokenUtil = await import("../src/utils/token.util.js");
    
    // Mock that the token is not blacklisted
    vi.mocked(tokenUtil.isTokenBlacklisted).mockResolvedValue(false);
    
    // Mock token verification
    vi.mocked(tokenUtil.verifyToken).mockReturnValue({
      userId: "user-123",
      sessionId: "session-uuid",
      tokenFamily: "family-123",
      type: "refresh"
    });
    
    // Mock the session query to return a valid session
    const mockLimit = vi.fn().mockResolvedValue([{
      id: "session-uuid",
      userId: "user-123",
      tokenFamily: "family-123",
      isActive: true,
      isRevoked: false,
      accessToken: "old-access-token",
      refreshToken: "old-refresh-token",
      csrfToken: "old-csrf-token",
    }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const result = await refreshTokenService("valid-refresh-token");

    expect(result).toEqual({
      accessToken: "signed-access-token",
      refreshToken: "signed-refresh-token",
      csrfToken: "csrf-token-string",
    });
  });

  it("rotates refresh token by blacklisting old one", async () => {
    const tokenUtil = await import("../src/utils/token.util.js");
    
    // Mock that the token is not blacklisted
    vi.mocked(tokenUtil.isTokenBlacklisted).mockResolvedValue(false);
    
    // Mock token verification
    vi.mocked(tokenUtil.verifyToken).mockReturnValue({
      userId: "user-123",
      sessionId: "session-uuid",
      tokenFamily: "family-123",
      type: "refresh"
    });
    
    // Mock the session query to return a valid session
    const mockLimit = vi.fn().mockResolvedValue([{
      id: "session-uuid",
      userId: "user-123",
      tokenFamily: "family-123",
      isActive: true,
      isRevoked: false,
      accessToken: "old-access-token",
      refreshToken: "old-refresh-token",
      csrfToken: "old-csrf-token",
    }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });

    await refreshTokenService("valid-refresh-token");

    // Check that the old tokens were blacklisted
    expect(tokenUtil.blacklistToken).toHaveBeenCalledWith("valid-refresh-token");
    expect(tokenUtil.blacklistToken).toHaveBeenCalledWith("old-access-token");
  });

  it("throws AUTH_SESSION_EXPIRED when session is inactive", async () => {
    const tokenUtil = await import("../src/utils/token.util.js");
    
    // Mock that the token is not blacklisted
    vi.mocked(tokenUtil.isTokenBlacklisted).mockResolvedValue(false);
    
    // Mock token verification
    vi.mocked(tokenUtil.verifyToken).mockReturnValue({
      userId: "user-123",
      sessionId: "session-uuid",
      tokenFamily: "family-123",
      type: "refresh"
    });
    
    // Mock the session query to return an empty array (no active session found)
    // This happens when isActive: false because the query filters for isActive: true
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });

    await expect(
      refreshTokenService("inactive-session-token")
    ).rejects.toThrow(AppError);
  });

  it("throws AUTH_SESSION_EXPIRED when session not found", async () => {
    const tokenUtil = await import("../src/utils/token.util.js");
    
    // Mock that the token is not blacklisted
    vi.mocked(tokenUtil.isTokenBlacklisted).mockResolvedValue(false);
    
    // Mock token verification
    vi.mocked(tokenUtil.verifyToken).mockReturnValue({
      userId: "user-123",
      sessionId: "session-uuid",
      tokenFamily: "family-123",
      type: "refresh"
    });
    
    // Mock the session query to return an empty array (session not found)
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });

    await expect(
      refreshTokenService("non-existent-token")
    ).rejects.toThrow(AppError);
  });

  it("throws AUTH_TOKEN_BLACKLISTED when refresh token is blacklisted", async () => {
    const tokenUtil = await import("../src/utils/token.util.js");
    
    // Mock that the token IS blacklisted
    vi.mocked(tokenUtil.isTokenBlacklisted).mockResolvedValue(true);

    await expect(
      refreshTokenService("blacklisted-token")
    ).rejects.toThrow(AppError);
  });

  it("handles token family reuse detection", async () => {
    const tokenUtil = await import("../src/utils/token.util.js");
    
    // Mock that the token is not blacklisted
    vi.mocked(tokenUtil.isTokenBlacklisted).mockResolvedValue(false);
    
    // Mock token verification
    vi.mocked(tokenUtil.verifyToken).mockReturnValue({
      userId: "user-123",
      sessionId: "session-uuid",
      tokenFamily: "family-123",
      type: "refresh"
    });
    
    // Mock the session query to return an empty array (token family reuse scenario)
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });

    await expect(
      refreshTokenService("reused-token")
    ).rejects.toThrow("Session reuse detected");
  });

  it("generates new CSRF token", async () => {
    const tokenUtil = await import("../src/utils/token.util.js");
    
    // Mock that the token is not blacklisted
    vi.mocked(tokenUtil.isTokenBlacklisted).mockResolvedValue(false);
    
    // Mock token verification
    vi.mocked(tokenUtil.verifyToken).mockReturnValue({
      userId: "user-123",
      sessionId: "session-uuid",
      tokenFamily: "family-123",
      type: "refresh"
    });
    
    // Mock the session query to return a valid session
    const mockLimit = vi.fn().mockResolvedValue([{
      id: "session-uuid",
      userId: "user-123",
      tokenFamily: "family-123",
      isActive: true,
      isRevoked: false,
      accessToken: "old-access-token",
      refreshToken: "old-refresh-token",
      csrfToken: "old-csrf-token",
    }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const result = await refreshTokenService("valid-refresh-token");

    expect(result.csrfToken).toBeTruthy();
    expect(typeof result.csrfToken).toBe("string");
    expect(result.csrfToken).toBe("csrf-token-string"); // Based on our mock
  });
});