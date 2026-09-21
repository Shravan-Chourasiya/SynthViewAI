// tests/setup.ts — runs before every test file
// Stubs the minimum env vars so env.ts doesn't throw when loaded in test context.
// Integration tests that need real DB/Redis set their own env via testcontainers.

import { vi } from "vitest";

vi.stubEnv("PORT", "4000");
vi.stubEnv("POSTGRES_URI", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("REDIS_URI", "redis://localhost:6379");
vi.stubEnv("JWT_SECRET", "a".repeat(64));
vi.stubEnv("API_VERSION", "1");
vi.stubEnv("GMAIL_USER_EMAIL", "test@test.com");
vi.stubEnv("GMAIL_CLIENT_ID", "test-client-id");
vi.stubEnv("GMAIL_CLIENT_SECRET", "test-client-secret");
vi.stubEnv("GMAIL_REFRESH_TOKEN", "test-refresh-token");
vi.stubEnv("REDIS_HOST", "localhost");
