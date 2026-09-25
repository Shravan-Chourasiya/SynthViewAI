// tests/setup.ts — runs before every test file
// Stubs the minimum env vars so env.ts doesn't throw when loaded in test context.
// Integration tests that need real DB/Redis set their own env via testcontainers.

import { vi } from "vitest";

vi.stubEnv("PORT", "4000");
vi.stubEnv("POSTGRES_URI", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("REDIS_URI", "redis://localhost:6379");
vi.stubEnv("JWT_SECRET", "a".repeat(64));
vi.stubEnv("API_VERSION", "1");
// Email (Brevo SMTP relay). Stub values only — never real credentials. The
// transport itself is mocked in every suite that would otherwise send mail, so
// these exist purely to satisfy env.schema.ts.
vi.stubEnv("SMTP_HOST", "smtp-relay.brevo.com");
vi.stubEnv("SMTP_PORT", "587");
vi.stubEnv("SMTP_USER", "test-smtp-user@test.com");
vi.stubEnv("SMTP_PASSWORD", "test-smtp-key");
vi.stubEnv("EMAIL_FROM", "no-reply@test.com");
vi.stubEnv("REDIS_HOST", "localhost");
