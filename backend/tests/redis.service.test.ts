import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Redis client ─────────────────────────────────────────────────────────
// vi.mock is hoisted to top of file, so redisMock must be defined via vi.hoisted()

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn(),
}));

vi.mock("../src/config/redis.init.js", () => ({
  redisClient: redisMock,
}));

// ── Import after mock ─────────────────────────────────────────────────────────

import { otpService } from "../src/services/redis.service.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePendingOTP(
  overrides: Partial<{
    otpHash: string;
    attemptsLeft: number;
    failedAttempts: number;
    expiresAt: number;
    createdAt: number;
    newValue: string;
    userId: string;
  }> = {},
) {
  return JSON.stringify({
    otpHash: overrides.otpHash ?? "$2b$12$hashedotp",
    email: "user@example.com",
    userId: overrides.userId,
    purpose: "registration",
    newValue: overrides.newValue ?? "{}",
    attemptsLeft: overrides.attemptsLeft ?? 5,
    failedAttempts: overrides.failedAttempts ?? 0,
    createdAt: overrides.createdAt ?? Date.now(),
    expiresAt: overrides.expiresAt ?? Date.now() + 600_000,
  });
}

describe("otpService.storeOTP", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores OTP in Redis with correct TTL", async () => {
    redisMock.exists.mockResolvedValue(0);

    await otpService.storeOTP("user@example.com", "123456", "registration");

    expect(redisMock.setex).toHaveBeenCalledWith(
      "otp:user@example.com:registration",
      600,
      expect.any(String),
    );
  });

  it("invalidates existing OTP before storing new one", async () => {
    redisMock.exists.mockResolvedValue(1);

    await otpService.storeOTP("user@example.com", "123456", "registration");

    expect(redisMock.del).toHaveBeenCalledWith("otp:user@example.com:registration");
    expect(redisMock.setex).toHaveBeenCalled();
  });

  it("normalises email to lowercase in key", async () => {
    redisMock.exists.mockResolvedValue(0);

    await otpService.storeOTP("USER@EXAMPLE.COM", "123456", "registration");

    expect(redisMock.setex).toHaveBeenCalledWith(
      "otp:user@example.com:registration",
      expect.any(Number),
      expect.any(String),
    );
  });

  it("stores hashed OTP, not plain text", async () => {
    redisMock.exists.mockResolvedValue(0);

    await otpService.storeOTP("user@example.com", "123456", "registration");

    const stored = JSON.parse(redisMock.setex.mock.calls[0][2]) as { otpHash: string };
    expect(stored.otpHash).not.toBe("123456");
    expect(stored.otpHash).toMatch(/^\$2b\$/);
  });

  it("returns success: true", async () => {
    redisMock.exists.mockResolvedValue(0);
    const result = await otpService.storeOTP("user@example.com", "123456", "registration");
    expect(result.success).toBe(true);
  });
});

describe("otpService.verifyOTP", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns failure when OTP key does not exist in Redis", async () => {
    redisMock.get.mockResolvedValue(null);

    const result = await otpService.verifyOTP("user@example.com", "123456", "registration");

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("returns failure and deletes key for corrupted data", async () => {
    redisMock.get.mockResolvedValue("not-valid-json{{{");

    const result = await otpService.verifyOTP("user@example.com", "123456", "registration");

    expect(result.success).toBe(false);
    expect(result.message).toContain("corrupted");
    expect(redisMock.del).toHaveBeenCalled();
  });

  it("returns rate limit message after 3+ failed attempts within 1 minute", async () => {
    redisMock.get.mockResolvedValue(
      makePendingOTP({ failedAttempts: 3, createdAt: Date.now() - 10_000 }),
    );

    const result = await otpService.verifyOTP("user@example.com", "wrong", "registration");

    expect(result.success).toBe(false);
    expect(result.message.toLowerCase()).toContain("too many");
  });

  it("deletes key and returns failure when attempts exhausted", async () => {
    redisMock.get.mockResolvedValue(makePendingOTP({ attemptsLeft: 0 }));

    const result = await otpService.verifyOTP("user@example.com", "wrong", "registration");

    expect(result.success).toBe(false);
    expect(redisMock.del).toHaveBeenCalled();
  });

  it("decrements attemptsLeft and updates Redis on wrong OTP", async () => {
    const bcrypt = await vi.importActual<typeof import("bcrypt")>("bcrypt");
    const hash = await bcrypt.hash("999999", 1);
    redisMock.get.mockResolvedValue(
      makePendingOTP({ otpHash: hash, attemptsLeft: 5, failedAttempts: 0 }),
    );

    const result = await otpService.verifyOTP("user@example.com", "123456", "registration");

    expect(result.success).toBe(false);
    expect(result.message).toContain("4 attempts remaining");
    expect(redisMock.setex).toHaveBeenCalled();
  });

  it("deletes key on successful verification", async () => {
    const bcrypt = await vi.importActual<typeof import("bcrypt")>("bcrypt");
    const hash = await bcrypt.hash("123456", 1);
    redisMock.get.mockResolvedValue(
      makePendingOTP({ otpHash: hash, newValue: '{"username":"john"}' }),
    );

    const result = await otpService.verifyOTP("user@example.com", "123456", "registration");

    expect(result.success).toBe(true);
    expect(redisMock.del).toHaveBeenCalledWith("otp:user@example.com:registration");
  });

  it("returns newValue on successful verification", async () => {
    const bcrypt = await vi.importActual<typeof import("bcrypt")>("bcrypt");
    const hash = await bcrypt.hash("123456", 1);
    redisMock.get.mockResolvedValue(
      makePendingOTP({ otpHash: hash, newValue: '{"username":"john"}' }),
    );

    const result = await otpService.verifyOTP("user@example.com", "123456", "registration");

    expect(result.newValue).toBe('{"username":"john"}');
  });
});

describe("otpService.otpExists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when key exists", async () => {
    redisMock.exists.mockResolvedValue(1);
    expect(await otpService.otpExists("user@example.com", "registration")).toBe(true);
  });

  it("returns false when key does not exist", async () => {
    redisMock.exists.mockResolvedValue(0);
    expect(await otpService.otpExists("user@example.com", "registration")).toBe(false);
  });
});

describe("otpService.invalidateOTP", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the correct Redis key", async () => {
    await otpService.invalidateOTP("user@example.com", "registration");
    expect(redisMock.del).toHaveBeenCalledWith("otp:user@example.com:registration");
  });
});
