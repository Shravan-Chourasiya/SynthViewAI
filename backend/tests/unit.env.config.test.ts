import { describe, it, expect, beforeEach, afterEach } from "vitest";
import envSchema from "../src/config/env.schema.js";
import { faker } from "@faker-js/faker";

describe("Environment Configuration Validation", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should reject environment without required JWT_SECRET", () => {
    process.env.POSTGRES_URI = "postgresql://localhost/test";
    process.env.REDIS_URI = "redis://localhost:6379";
    process.env.NODE_ENV = "test";
    process.env.GMAIL_USER_EMAIL = "test@gmail.com";
    process.env.GMAIL_CLIENT_ID = "client_id";
    process.env.GMAIL_CLIENT_SECRET = "client_secret";
    process.env.GMAIL_REFRESH_TOKEN = "refresh_token";
    process.env.REDIS_HOST = "localhost";
    process.env.API_VERSION = "v1";

    delete process.env.JWT_SECRET;

    expect(() => envSchema.parse(process.env)).toThrow();
  });

  it("should reject environment without required POSTGRES_URI", () => {
    process.env.JWT_SECRET = "a".repeat(64); // Valid length
    process.env.REDIS_URI = "redis://localhost:6379";
    process.env.NODE_ENV = "test";
    process.env.GMAIL_USER_EMAIL = "test@gmail.com";
    process.env.GMAIL_CLIENT_ID = "client_id";
    process.env.GMAIL_CLIENT_SECRET = "client_secret";
    process.env.GMAIL_REFRESH_TOKEN = "refresh_token";
    process.env.REDIS_HOST = "localhost";
    process.env.API_VERSION = "v1";

    delete process.env.POSTGRES_URI;

    expect(() => envSchema.parse(process.env)).toThrow();
  });

  it("should reject environment without required REDIS_URI", () => {
    process.env.JWT_SECRET = "a".repeat(64); // Valid length
    process.env.POSTGRES_URI = "postgresql://localhost/test";
    process.env.NODE_ENV = "test";
    process.env.GMAIL_USER_EMAIL = "test@gmail.com";
    process.env.GMAIL_CLIENT_ID = "client_id";
    process.env.GMAIL_CLIENT_SECRET = "client_secret";
    process.env.GMAIL_REFRESH_TOKEN = "refresh_token";
    process.env.REDIS_HOST = "localhost";
    process.env.API_VERSION = "v1";

    delete process.env.REDIS_URI;

    expect(() => envSchema.parse(process.env)).toThrow();
  });

  it("should accept minimal valid environment", () => {
    process.env.JWT_SECRET = "a".repeat(64); // Valid length
    process.env.POSTGRES_URI = "postgresql://localhost/test";
    process.env.REDIS_URI = "redis://localhost:6379";
    process.env.NODE_ENV = "test";
    process.env.GMAIL_USER_EMAIL = "test@gmail.com";
    process.env.GMAIL_CLIENT_ID = "client_id";
    process.env.GMAIL_CLIENT_SECRET = "client_secret";
    process.env.GMAIL_REFRESH_TOKEN = "refresh_token";
    process.env.REDIS_HOST = "localhost";
    process.env.API_VERSION = "v1";

    expect(() => envSchema.parse(process.env)).not.toThrow();
  });

  it("should accept environment with valid defaults", () => {
    process.env.JWT_SECRET = "a".repeat(64); // Valid length
    process.env.POSTGRES_URI = "postgresql://localhost/test";
    process.env.REDIS_URI = "redis://localhost:6379";
    process.env.NODE_ENV = "development";
    process.env.GMAIL_USER_EMAIL = "test@gmail.com";
    process.env.GMAIL_CLIENT_ID = "client_id";
    process.env.GMAIL_CLIENT_SECRET = "client_secret";
    process.env.GMAIL_REFRESH_TOKEN = "refresh_token";
    process.env.REDIS_HOST = "localhost";
    process.env.API_VERSION = "v1";

    const parsed = envSchema.parse(process.env);
    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.PORT).toBe(4000);
  });

  it("should validate JWT_SECRET minimum length", () => {
    process.env.JWT_SECRET = "a".repeat(63); // Too short
    process.env.POSTGRES_URI = "postgresql://localhost/test";
    process.env.REDIS_URI = "redis://localhost:6379";
    process.env.NODE_ENV = "test";
    process.env.GMAIL_USER_EMAIL = "test@gmail.com";
    process.env.GMAIL_CLIENT_ID = "client_id";
    process.env.GMAIL_CLIENT_SECRET = "client_secret";
    process.env.GMAIL_REFRESH_TOKEN = "refresh_token";
    process.env.REDIS_HOST = "localhost";
    process.env.API_VERSION = "v1";

    expect(() => envSchema.parse(process.env)).toThrow();
  });

  it("should validate JWT_SECRET maximum length", () => {
    process.env.JWT_SECRET = "a".repeat(513); // Too long
    process.env.POSTGRES_URI = "postgresql://localhost/test";
    process.env.REDIS_URI = "redis://localhost:6379";
    process.env.NODE_ENV = "test";
    process.env.GMAIL_USER_EMAIL = "test@gmail.com";
    process.env.GMAIL_CLIENT_ID = "client_id";
    process.env.GMAIL_CLIENT_SECRET = "client_secret";
    process.env.GMAIL_REFRESH_TOKEN = "refresh_token";
    process.env.REDIS_HOST = "localhost";
    process.env.API_VERSION = "v1";

    expect(() => envSchema.parse(process.env)).toThrow();
  });

  it("should validate database URL format", () => {
    process.env.JWT_SECRET = "a".repeat(64); // Valid length
    process.env.POSTGRES_URI = "invalid-url"; // Invalid format
    process.env.REDIS_URI = "redis://localhost:6379";
    process.env.NODE_ENV = "test";
    process.env.GMAIL_USER_EMAIL = "test@gmail.com";
    process.env.GMAIL_CLIENT_ID = "client_id";
    process.env.GMAIL_CLIENT_SECRET = "client_secret";
    process.env.GMAIL_REFRESH_TOKEN = "refresh_token";
    process.env.REDIS_HOST = "localhost";
    process.env.API_VERSION = "v1";

    expect(() => envSchema.parse(process.env)).toThrow();
  });

  it("should validate email format", () => {
    process.env.JWT_SECRET = "a".repeat(64); // Valid length
    process.env.POSTGRES_URI = "postgresql://localhost/test";
    process.env.REDIS_URI = "redis://localhost:6379";
    process.env.NODE_ENV = "test";
    process.env.GMAIL_USER_EMAIL = "invalid-email"; // Invalid format
    process.env.GMAIL_CLIENT_ID = "client_id";
    process.env.GMAIL_CLIENT_SECRET = "client_secret";
    process.env.GMAIL_REFRESH_TOKEN = "refresh_token";
    process.env.REDIS_HOST = "localhost";
    process.env.API_VERSION = "v1";

    expect(() => envSchema.parse(process.env)).toThrow();
  });
});