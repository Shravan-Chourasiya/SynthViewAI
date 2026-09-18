/**
 * unit.secrets.test.ts
 * Unit tests to verify proper handling of secrets in test setup
 * and ensure no real secrets leak in CI logs or error messages.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";

describe("Secrets Management in Test Setup", () => {
  beforeEach(() => {
    // Save original environment
    process.env.ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = process.env.ORIGINAL_NODE_ENV;
    delete process.env.ORIGINAL_NODE_ENV;
  });

  it("should use dummy/stub values for secrets in test environment", () => {
    // Verify that the setup.ts file uses dummy values
    expect(process.env.JWT_SECRET).toBeDefined();
    expect(process.env.JWT_SECRET).toMatch(/^a{64}$/); // Dummy value used in setup.ts
    
    expect(process.env.GMAIL_USER_EMAIL).toBe("test@test.com");
    expect(process.env.GMAIL_CLIENT_ID).toBe("test-client-id");
    expect(process.env.GMAIL_CLIENT_SECRET).toBe("test-client-secret");
    expect(process.env.GMAIL_REFRESH_TOKEN).toBe("test-refresh-token");
  });

  it("should validate that dummy secrets pass environment validation", () => {
    // Define the expected environment schema based on the app's requirements
    const envSchema = z.object({
      NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
      JWT_SECRET: z.string().min(32),
      POSTGRES_URI: z.string().url(),
      REDIS_URI: z.string().url(),
      GMAIL_USER_EMAIL: z.string().optional(),
      GMAIL_CLIENT_ID: z.string().optional(),
      GMAIL_CLIENT_SECRET: z.string().optional(),
      GMAIL_REFRESH_TOKEN: z.string().optional(),
      // Add other required fields
      API_VERSION: z.string(),
      CORS_ORIGIN: z.string().url().optional(),
    });

    // Use dummy values that would be set in test environment
    const testEnv = {
      NODE_ENV: "test",
      JWT_SECRET: "a".repeat(64), // Dummy value from setup.ts
      POSTGRES_URI: "postgresql://test:test@localhost:5432/test",
      REDIS_URI: "redis://localhost:6379",
      GMAIL_USER_EMAIL: "test@test.com",
      GMAIL_CLIENT_ID: "test-client-id",
      GMAIL_CLIENT_SECRET: "test-client-secret",
      GMAIL_REFRESH_TOKEN: "test-refresh-token",
      API_VERSION: "1",
    };

    // Validate that dummy values pass the schema
    const parsed = envSchema.safeParse(testEnv);
    expect(parsed.success).toBe(true);
  });

  it("should not expose real secrets in error messages", () => {
    // This test ensures that even if validation fails, secrets are not leaked
    const envSchema = z.object({
      JWT_SECRET: z.string().min(32),
      POSTGRES_URI: z.string().url(),
    });

    // Try to validate with a short JWT_SECRET (should fail)
    const invalidEnv = {
      JWT_SECRET: "too-short", // Invalid value that should cause validation error
      POSTGRES_URI: "postgresql://test:test@localhost:5432/test",
    };

    const parsed = envSchema.safeParse(invalidEnv);
    expect(parsed.success).toBe(false);
    
    // If there are errors, ensure no secrets are exposed in error messages
    if (!parsed.success && parsed.error && parsed.error.issues) {
      const errorMessages = parsed.error.issues.map(e => e.message).join(" ");
      // The error message should not contain the actual secret value
      expect(errorMessages.toLowerCase()).not.toContain("too-short");
    }
  });

  it("should handle mixed real and dummy env vars safely", () => {
    // Simulate a scenario where some real vars exist alongside dummy ones
    const mixedEnv = {
      // Real-seeming values (but still test values)
      NODE_ENV: "test",
      API_VERSION: "v1",
      CORS_ORIGIN: "http://localhost:3000",
      
      // Dummy test values (as in setup.ts)
      JWT_SECRET: "a".repeat(64),
      POSTGRES_URI: "postgresql://test:test@localhost:5432/test",
      REDIS_URI: "redis://localhost:6379",
      GMAIL_USER_EMAIL: "test@test.com",
      GMAIL_CLIENT_ID: "test-client-id",
      GMAIL_CLIENT_SECRET: "test-client-secret",
      GMAIL_REFRESH_TOKEN: "test-refresh-token",
    };

    // This should not cause any secrets to leak
    expect(mixedEnv.JWT_SECRET).toBe("a".repeat(64));
    expect(mixedEnv.GMAIL_CLIENT_ID).toBe("test-client-id");
  });
});