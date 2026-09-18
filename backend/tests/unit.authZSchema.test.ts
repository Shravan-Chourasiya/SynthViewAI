import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, forgotPasswordSchema, recoverAccountSchema } from "../src/lib/zod/auth.zschema.js";
import { ZodIssueCode } from "zod";

describe("loginSchema", () => {
  it("accepts valid login input", () => {
    const validInput = {
      email: "user@example.com",
      password: "ValidPass123!",
      deviceType: "desktop",
    };

    const result = loginSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const invalidInput = {
      email: "not-an-email",
      password: "ValidPass123!",
      deviceType: "desktop",
    };

    const result = loginSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].code).toBe(ZodIssueCode.invalid_string);
      expect(result.error.issues[0].validation).toBe("email");
    }
  });

  it("rejects weak passwords", () => {
    const invalidInput = {
      email: "user@example.com",
      password: "weak",
      deviceType: "desktop",
    };

    const result = loginSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].code).toBe(ZodIssueCode.custom);
    }
  });

  it("requires deviceType to be one of allowed values", () => {
    const invalidInput = {
      email: "user@example.com",
      password: "ValidPass123!",
      deviceType: "unknown",
    };

    const result = loginSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].code).toBe(ZodIssueCode.invalid_enum_value);
    }
  });
});

describe("registerSchema", () => {
  it("accepts valid registration input", () => {
    const validInput = {
      email: "newuser@example.com",
      password: "ValidPass123!",
      firstName: "John",
      lastName: "Doe",
    };

    const result = registerSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it("rejects emails that are too long", () => {
    const invalidInput = {
      email: "a".repeat(255) + "@example.com", // Exceeds typical email length limits
      password: "ValidPass123!",
      firstName: "John",
      lastName: "Doe",
    };

    const result = registerSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });

  it("rejects passwords that don't meet complexity requirements", () => {
    const invalidInput = {
      email: "newuser@example.com",
      password: "123", // Too simple
      firstName: "John",
      lastName: "Doe",
    };

    const result = registerSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });

  it("requires firstName and lastName to be present", () => {
    const partialInput = {
      email: "newuser@example.com",
      password: "ValidPass123!",
      // Missing firstName and lastName
    };

    const result = registerSchema.safeParse(partialInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts valid email for password reset request", () => {
    const validInput = { email: "user@example.com" };

    const result = forgotPasswordSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const invalidInput = { email: "not-email" };

    const result = forgotPasswordSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const invalidInput = {};

    const result = forgotPasswordSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });
});

describe("recoverAccountSchema", () => {
  it("accepts valid recovery input", () => {
    const validInput = {
      token: "reset-token-string",
      newPassword: "NewValidPass123!",
    };

    const result = recoverAccountSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it("rejects weak new passwords", () => {
    const invalidInput = {
      token: "reset-token-string",
      newPassword: "weak",
    };

    const result = recoverAccountSchema.safeParse(invalidInput);

    expect(result.success).toBe(false);
  });

  it("requires both token and newPassword", () => {
    const partialInput = { token: "reset-token-string" }; // Missing newPassword

    const result = recoverAccountSchema.safeParse(partialInput);

    expect(result.success).toBe(false);
  });
});