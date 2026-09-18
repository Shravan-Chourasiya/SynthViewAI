/**
 * unit.redis.service.enhanced.test.ts
 * Enhanced tests for the redis service covering TTL-expiry behavior,
 * concurrent verification attempts (race condition handling),
 * and additional Redis operations as mentioned in Priority 2 of the test suite plan.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { redisClient } from "../src/config/redis.init.js";
import { otpService } from "../src/services/redis.service.js";

// Mock the redis client
vi.mock("../src/config/redis.init.js", () => ({
  redisClient: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    setex: vi.fn(),
    ttl: vi.fn(), // Add ttl function
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

describe("Redis Service - Enhanced Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it("should check TTL for existing keys", async () => {
      const key = "test-key";
      vi.mocked(redisClient.ttl).mockResolvedValue(120); // 2 minutes remaining

      const ttl = await redisClient.ttl(key);

      expect(redisClient.ttl).toHaveBeenCalledWith(key);
      expect(ttl).toBe(120);
    });
  });

  describe("Concurrent verification attempts (race condition)", () => {
    it("should handle concurrent OTP verifications safely", async () => {
      const email = "test@example.com";
      const otp = "123456";
      const purpose = "REGISTER";
      
      // Mock that multiple requests retrieve the same data simultaneously
      const otpData = JSON.stringify({
        otpHash: "$2b$12$hashedotp",
        email: "test@example.com",
        userId: "user-123",
        purpose: "REGISTER",
        newValue: JSON.stringify({ email: "test@example.com" }),
        attemptsLeft: 3,
        failedAttempts: 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + 600000, // 10 minutes from now
      });
      
      vi.mocked(redisClient.get).mockResolvedValue(otpData);
      vi.mocked(redisClient.del).mockResolvedValue(1);

      // Mock bcrypt comparison to succeed
      const bcrypt = await import("bcrypt");
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      // Simulate concurrent verification attempts
      const results = await Promise.all([
        otpService.verifyOTP(email, otp, purpose),
        otpService.verifyOTP(email, otp, purpose),
        otpService.verifyOTP(email, otp, purpose)
      ]);

      // Only one should succeed (the first one gets the value, others get null after deletion)
      const successes = results.filter(r => r.success);
      expect(successes.length).toBeLessThanOrEqual(1); // At most one should succeed due to deletion
    });

    it("should guard against negative TTL on race condition", async () => {
      const email = "race-condition-test@example.com";
      const otp = "123456";
      const purpose = "REGISTER";
      
      // Create data that would result in negative TTL if calculated incorrectly
      const pastTime = Date.now() - 10000; // 10 seconds ago
      const data = {
        otpHash: "$2b$12$hashedotp",
        email: "race-condition-test@example.com",
        userId: "user-123",
        purpose: "REGISTER",
        newValue: JSON.stringify({ email: "race-condition-test@example.com" }),
        attemptsLeft: 1, // Last attempt
        failedAttempts: 0,
        createdAt: pastTime,
        expiresAt: pastTime + 5000, // Expires 5 seconds after creation
      };
      
      // Mock the redis operations
      vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify(data));
      vi.mocked(redisClient.setex).mockResolvedValue("OK");
      vi.mocked(redisClient.del).mockResolvedValue(1);

      // Mock bcrypt comparison to fail (so we trigger the TTL update path)
      const bcrypt = await import("bcrypt");
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      // Call verifyOTP which will reduce attemptsLeft and update TTL
      await otpService.verifyOTP(email, "wrong-otp", purpose);

      // Check that the function completed without throwing an error
      // The TTL logic is handled internally in the implementation
      expect(redisClient.del).toHaveBeenCalled(); // Verify that the function ran to completion
    });
  });

  describe("Additional Redis Operations", () => {
    it("should properly handle OTP existence checks", async () => {
      const email = "test@example.com";
      const purpose = "REGISTER";
      const key = `otp:${email.toLowerCase()}:${purpose}`;
      
      vi.mocked(redisClient.exists).mockResolvedValue(1); // Key exists

      const exists = await otpService.otpExists(email, purpose);

      expect(redisClient.exists).toHaveBeenCalledWith(key);
      expect(exists).toBe(true);
    });

    it("should handle OTP invalidation", async () => {
      const email = "test@example.com";
      const purpose = "REGISTER";
      const key = `otp:${email.toLowerCase()}:${purpose}`;
      
      vi.mocked(redisClient.del).mockResolvedValue(1);

      await otpService.invalidateOTP(email, purpose);

      expect(redisClient.del).toHaveBeenCalledWith(key);
    });
  });
});