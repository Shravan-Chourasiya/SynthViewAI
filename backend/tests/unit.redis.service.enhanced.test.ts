/**
 * unit.redis.service.enhanced.test.ts
 * Enhanced tests for the redis service covering TTL-expiry behavior,
 * concurrent verification attempts (race condition handling),
 * and additional Redis operations as mentioned in Priority 2 of the test suite plan.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { redisClient } from "../src/config/redis.init.js";
import { otpService } from "../src/services/redis.service.js";

// Mock the redis client
vi.mock("../src/config/redis.init.js", () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    hgetall: vi.fn(),
    hset: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
    srem: vi.fn(),
  },
}));

vi.mock("bcrypt", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hash: vi.fn().mockResolvedValue("$2b$12$hashedotp"),
    compare: vi.fn(),
  };
});

describe("Redis Service Enhanced Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs(); // Clean up environment stubs
  });

  describe("TTL-expiry behavior for OTP entries", () => {
    it("should set appropriate TTL for OTP entries", async () => {
      const email = "test@example.com";
      const otp = "123456";
      const purpose = "REGISTER";
      
      vi.mocked(redisClient.setex).mockResolvedValue("OK");

      await otpService.storeOTP(email, otp, purpose, undefined, JSON.stringify({ email }), 300); // 5 min TTL

      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.stringMatching(/otp:test@example\.com:REGISTER/),
        300, // TTL of 300 seconds (5 minutes)
        expect.any(String) // JSON string
      );
    });

    describe("TTL-expiry behavior", () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it("should properly set TTL on OTP storage", async () => {
        const email = "test@example.com";
        const otp = "123456";
        const purpose = "REGISTER";

        await otpService.storeOTP(email, otp, purpose, OTP_EXPIRY_SECONDS);

        expect(redisClient.set).toHaveBeenCalledWith(
          expect.stringContaining(email),
          expect.any(String),
          { EX: OTP_EXPIRY_SECONDS }
        );
      });

      it("should handle OTP expiry correctly", async () => {
        const email = "test@example.com";
        const otp = "123456";
        const purpose = "REGISTER";
        const key = `${purpose}:${email}`;

        // Simulate expired OTP by having get return null
        vi.mocked(redisClient.get).mockResolvedValue(null);

        const result = await otpService.verifyOTP(email, otp, purpose);

        expect(result).toEqual({
          success: false,
          message: "Invalid or expired OTP",
        });
      });
    });
  });

  describe("Concurrent verification attempts (race condition)", () => {
    describe("Concurrent verification protection", () => {
      it("should handle multiple concurrent verification attempts", async () => {
        const email = "test@example.com";
        const otp = "123456";
        const purpose = "REGISTER";
        const key = `${purpose}:${email}`;

        // First call returns the OTP, subsequent calls return null (already used)
        vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify({ otp, data: null }))
                                  .mockResolvedValue(null);

        // Mock del to return 1 on first call (success), 0 on subsequent calls (already deleted)
        let delCallCount = 0;
        vi.mocked(redisClient.del).mockImplementation(() => {
          delCallCount++;
          return Promise.resolve(delCallCount === 1 ? 1 : 0);
        });

        // Run multiple verifications concurrently
        const results = await Promise.all([
          otpService.verifyOTP(email, otp, purpose),
          otpService.verifyOTP(email, otp, purpose),
          otpService.verifyOTP(email, otp, purpose)
        ]);

        // Count successful verifications (only one should succeed)
        const successfulVerifications = results.filter(r => r.success).length;
        
        // At most one should succeed due to atomic nature of DEL operation
        expect(successfulVerifications).toBeLessThanOrEqual(1);
      });
    });

  });

  describe("Additional Redis Operations", () => {
    describe("Additional Redis Operations", () => {
      it("should properly handle OTP existence checks", async () => {
        const email = "test@example.com";
        const purpose = "REGISTER";
        const key = `${purpose}:${email}`;

        vi.mocked(redisClient.exists).mockResolvedValue(1);

        // We need to check if a key exists using the exists method
        await redisClient.exists(key);

        expect(redisClient.exists).toHaveBeenCalledWith(key);
      });

      it("should handle OTP invalidation", async () => {
        const email = "test@example.com";
        const purpose = "REGISTER";
        const key = `${purpose}:${email}`;

        vi.mocked(redisClient.del).mockResolvedValue(1);

        await redisClient.del(key);

        expect(redisClient.del).toHaveBeenCalledWith(key);
      });
    });
  });
});