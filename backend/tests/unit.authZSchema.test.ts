/**
 * unit.authZSchema.test.ts
 * Tests for the authentication Zod schemas as mentioned in Priority 2 of the test suite plan.
 */

import { describe, it, expect } from "vitest";
import { 
  loginSchema, 
  registerSchema, 
  forgotPasswordSchema, 
  recoverAccountSchema 
} from "../src/modules/auth/zodschemas/auth.zschema.js";

describe("Authentication Zod Schemas", () => {
  describe("loginSchema", () => {
    it("accepts valid login input", () => {
      const validInput = {
        email: "test@example.com",
        password: "ValidPass123!",
        deviceType: "desktop"
      };

      const result = loginSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("rejects invalid email format", () => {
      const invalidInput = {
        email: "invalid-email",
        password: "ValidPass123!",
        deviceType: "desktop"
      };

      const result = loginSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("rejects weak passwords", () => {
      const invalidInput = {
        email: "test@example.com",
        password: "weak",
        deviceType: "desktop"
      };

      const result = loginSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("requires all fields", () => {
      const partialInput = {
        email: "test@example.com",
        // Missing password and deviceType
      };

      const result = loginSchema.safeParse(partialInput);
      expect(result.success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    it("accepts valid registration input", () => {
      const validInput = {
        email: "test@example.com",
        password: "ValidPass123!",
        firstName: "John",
        lastName: "Doe",
        username: "johndoe"
      };

      const result = registerSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("rejects invalid email format", () => {
      const invalidInput = {
        email: "invalid-email",
        password: "ValidPass123!",
        firstName: "John",
        lastName: "Doe",
        username: "johndoe"
      };

      const result = registerSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("rejects short usernames", () => {
      const invalidInput = {
        email: "test@example.com",
        password: "ValidPass123!",
        firstName: "John",
        lastName: "Doe",
        username: "ab" // Too short
      };

      const result = registerSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("rejects weak passwords", () => {
      const invalidInput = {
        email: "test@example.com",
        password: "weakpass", // Too weak
        firstName: "John",
        lastName: "Doe",
        username: "johndoe"
      };

      const result = registerSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("forgotPasswordSchema", () => {
    it("accepts valid email for password reset", () => {
      const validInput = {
        email: "test@example.com"
      };

      const result = forgotPasswordSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("rejects invalid email format", () => {
      const invalidInput = {
        email: "invalid-email"
      };

      const result = forgotPasswordSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("requires email field", () => {
      const emptyInput = {};

      const result = forgotPasswordSchema.safeParse(emptyInput);
      expect(result.success).toBe(false);
    });
  });

  describe("recoverAccountSchema", () => {
    it("accepts valid recovery input", () => {
      const validInput = {
        resetToken: "valid-token-123",
        newPassword: "NewPass123!"
      };

      const result = recoverAccountSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("rejects weak new password", () => {
      const invalidInput = {
        resetToken: "valid-token-123",
        newPassword: "weak"
      };

      const result = recoverAccountSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("requires both fields", () => {
      const partialInput = {
        resetToken: "valid-token-123"
        // Missing newPassword
      };

      const result = recoverAccountSchema.safeParse(partialInput);
      expect(result.success).toBe(false);
    });
  });
});