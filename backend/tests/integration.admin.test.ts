/**
 * integration.admin.test.ts
 * Admin role-visibility and suspend/reinstate rank-enforcement tests.
 * Uses real Postgres + Redis testcontainers; AI provider is not involved.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import supertest from "supertest";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { setup, teardown, resetDb, resetRedis, getContainers } from "./helpers/containers.js";
import { usersTable } from "../src/modules/auth/schemas/user.schema.js";

let request: ReturnType<typeof supertest>;
const API = "/v1";

beforeAll(async () => {
  const containers = await setup();

  vi.doMock("../src/db/postgres.init.js", () => ({
    default: () => containers.db,
    getPgDb: () => containers.db,
    getPgPool: () => containers.pool,
  }));
  vi.doMock("../src/config/redis.init.js", () => ({ redisClient: containers.redis }));
  vi.doMock("../src/config/env.js", () => ({
    env: {
      NODE_ENV: "test",
      PORT: 4002,
      API_VERSION: "v1",
      JWT_SECRET: "a".repeat(64),
      CORS_ORIGIN: ["http://localhost:3000"],
      COOKIE_DOMAIN: undefined,
      LOG_LEVEL: "silent",
      APP_VERSION: "1.0.0",
    },
  }));

  const { default: app } = await import("../src/app.js");
  request = supertest(app);
}, 120_000);

afterAll(async () => { await teardown(); });
beforeEach(async () => { await resetDb(); await resetRedis(); });

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCookie(header: string[] | string, name: string): string | null {
  const arr = Array.isArray(header) ? header : [header];
  for (const line of arr) {
    const m = line.match(new RegExp(`${name}=([^;]+)`));
    if (m) return m[1]!;
  }
  return null;
}

async function seedUser(role: "user" | "moderator" | "admin" | "owner") {
  const { db } = getContainers();
  const hash = await bcrypt.hash("Password1", 1);
  const email = `${role}-${randomUUID()}@example.com`;
  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      password: hash,
      username: `${role}_${randomUUID().slice(0, 8)}`,
      isVerified: true,
      accountStatus: "active",
      userrole: role,
    })
    .returning();
  return user!;
}

async function loginAs(email: string) {
  const csrf = "csrf-" + randomUUID();
  const res = await request
    .post(`${API}/auth/login`)
    .set("Cookie", `csrf_token=${csrf}`)
    .set("x-csrf-token", csrf)
    .send({ email, password: "Password1" });
  expect(res.status).toBe(200);
  const accessToken = extractCookie(res.headers["set-cookie"], "access_token")!;
  const csrfToken = extractCookie(res.headers["set-cookie"], "csrf_token") ?? csrf;
  return { accessToken, csrfToken };
}

function authed(accessToken: string, csrfToken: string) {
  return {
    get: (url: string) =>
      request
        .get(url)
        .set("Cookie", `access_token=${accessToken}; csrf_token=${csrfToken}`)
        .set("x-csrf-token", csrfToken),
    post: (url: string) =>
      request
        .post(url)
        .set("Cookie", `access_token=${accessToken}; csrf_token=${csrfToken}`)
        .set("x-csrf-token", csrfToken),
  };
}

// ── Fix 2: visibility and rank-enforcement tests ──────────────────────────────

describe("Fix 2 — moderator visibility ceiling on GET /admin/users", () => {
  it("moderator never receives admin or owner rows in unfiltered list", async () => {
    const mod = await seedUser("moderator");
    const admin = await seedUser("admin");
    const owner = await seedUser("owner");
    const tokens = await loginAs(mod.email);

    const res = await authed(tokens.accessToken, tokens.csrfToken).get(`${API}/admin/users`);
    expect(res.status).toBe(200);

    const users: { userrole: string }[] = res.body.data?.users ?? res.body.data ?? [];
    const roles = users.map((u) => u.userrole);
    expect(roles).not.toContain("admin");
    expect(roles).not.toContain("owner");
    // The admin and owner we seeded must not appear
    const ids = users.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(admin.id);
    expect(ids).not.toContain(owner.id);
  });
});

describe("Fix 2 — moderator GET /admin/users/:id for an admin ID returns 404", () => {
  it("moderator probing an admin ID gets 404, not 200", async () => {
    const mod = await seedUser("moderator");
    const admin = await seedUser("admin");
    const tokens = await loginAs(mod.email);

    const res = await authed(tokens.accessToken, tokens.csrfToken).get(
      `${API}/admin/users/${admin.id}`,
    );
    expect(res.status).toBe(404);
  });
});

describe("Fix 2 — moderator POST /admin/users/:id/suspend on admin ID returns 403", () => {
  it("moderator cannot suspend an admin", async () => {
    const mod = await seedUser("moderator");
    const admin = await seedUser("admin");
    const tokens = await loginAs(mod.email);

    const res = await authed(tokens.accessToken, tokens.csrfToken)
      .post(`${API}/admin/users/${admin.id}/suspend`)
      .send({ reason: "test" });
    expect(res.status).toBe(403);
  });
});

describe("Fix 2 — admin suspend rank enforcement", () => {
  it("admin can suspend a moderator", async () => {
    const admin = await seedUser("admin");
    const mod = await seedUser("moderator");
    const tokens = await loginAs(admin.email);

    const res = await authed(tokens.accessToken, tokens.csrfToken)
      .post(`${API}/admin/users/${mod.id}/suspend`)
      .send({ reason: "test" });
    expect(res.status).toBe(200);
  });

  it("admin cannot suspend another admin (403)", async () => {
    const admin1 = await seedUser("admin");
    const admin2 = await seedUser("admin");
    const tokens = await loginAs(admin1.email);

    const res = await authed(tokens.accessToken, tokens.csrfToken)
      .post(`${API}/admin/users/${admin2.id}/suspend`)
      .send({ reason: "test" });
    expect(res.status).toBe(403);
  });
});

describe("Fix 2 — owner can suspend an admin", () => {
  it("owner suspends admin successfully", async () => {
    const owner = await seedUser("owner");
    const admin = await seedUser("admin");
    const tokens = await loginAs(owner.email);

    const res = await authed(tokens.accessToken, tokens.csrfToken)
      .post(`${API}/admin/users/${admin.id}/suspend`)
      .send({ reason: "test" });
    expect(res.status).toBe(200);
  });
});
