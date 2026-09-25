import { describe, it, expect } from "vitest";
import envSchema from "../src/config/env.schema.js";

/**
 * A complete, valid environment.
 *
 * Each test starts from this and breaks exactly one value, so "the validator
 * accepted it" cannot be an accident of whatever the surrounding process
 * happened to have set. The email block is the Brevo SMTP relay — every value in
 * it is required, because registration, password reset and email change all
 * depend on mail being deliverable.
 */
const validEnv = (): NodeJS.ProcessEnv => ({
  JWT_SECRET: "a".repeat(64),
  POSTGRES_URI: "postgresql://localhost/test",
  REDIS_URI: "redis://localhost:6379",
  REDIS_HOST: "localhost",
  API_VERSION: "v1",
  NODE_ENV: "test",
  SMTP_HOST: "smtp-relay.brevo.com",
  SMTP_PORT: "587",
  SMTP_USER: "smtp-user@example.org",
  SMTP_PASSWORD: "smtp-key",
  EMAIL_FROM: "no-reply@example.org",
});

describe("Environment Configuration Validation", () => {
  it("should reject environment without required JWT_SECRET", () => {
    const env = validEnv();
    delete env.JWT_SECRET;

    expect(() => envSchema.parse(env)).toThrow();
  });

  it("should reject environment without required POSTGRES_URI", () => {
    const env = validEnv();
    delete env.POSTGRES_URI;

    expect(() => envSchema.parse(env)).toThrow();
  });

  it("should reject environment without required REDIS_URI", () => {
    const env = validEnv();
    delete env.REDIS_URI;

    expect(() => envSchema.parse(env)).toThrow();
  });

  it("should accept minimal valid environment", () => {
    expect(() => envSchema.parse(validEnv())).not.toThrow();
  });

  it("should accept environment with valid defaults", () => {
    const env = validEnv();
    env.NODE_ENV = "development";

    const parsed = envSchema.parse(env);
    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.PORT).toBe(4000);
  });

  it("should validate JWT_SECRET minimum length", () => {
    const env = validEnv();
    env.JWT_SECRET = "a".repeat(63); // Too short

    expect(() => envSchema.parse(env)).toThrow();
  });

  it("should validate JWT_SECRET maximum length", () => {
    const env = validEnv();
    env.JWT_SECRET = "a".repeat(513); // Too long

    expect(() => envSchema.parse(env)).toThrow();
  });

  it("should validate database URL format", () => {
    const env = validEnv();
    env.POSTGRES_URI = "invalid-url"; // Invalid format

    expect(() => envSchema.parse(env)).toThrow();
  });

  it("should validate email format", () => {
    const env = validEnv();
    env.EMAIL_FROM = "invalid-email"; // Invalid format

    expect(() => envSchema.parse(env)).toThrow();
  });

  // ── Brevo SMTP configuration ────────────────────────────────────────────────
  // A missing value here used to be a soft failure (a transporter that raised on
  // first use). These assert the hard failure: no sender, no host, no username or
  // no password must stop the process at boot instead.

  it("should reject environment without SMTP_HOST", () => {
    const env = validEnv();
    delete env.SMTP_HOST;

    expect(() => envSchema.parse(env)).toThrow();
  });

  it("should reject environment without SMTP_USER", () => {
    const env = validEnv();
    delete env.SMTP_USER;

    expect(() => envSchema.parse(env)).toThrow();
  });

  it("should reject environment without SMTP_PASSWORD", () => {
    const env = validEnv();
    delete env.SMTP_PASSWORD;

    expect(() => envSchema.parse(env)).toThrow();
  });

  it("should reject environment without a sender address", () => {
    const env = validEnv();
    delete env.EMAIL_FROM;

    expect(() => envSchema.parse(env)).toThrow();
  });

  it("should default the SMTP port to the submission port and the sender name to the product", () => {
    const env = validEnv();
    delete env.SMTP_PORT;
    delete env.EMAIL_FROM_NAME;

    const parsed = envSchema.parse(env);
    expect(parsed.SMTP_PORT).toBe(587);
    expect(parsed.EMAIL_FROM_NAME).toBe("SynthView AI");
  });

  it("should reject an out-of-range SMTP port", () => {
    const env = validEnv();
    env.SMTP_PORT = "70000";

    expect(() => envSchema.parse(env)).toThrow();
  });
});
