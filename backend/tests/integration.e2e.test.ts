/**
 * integration.e2e.test.ts — Part 7
 * Full Phase 1 acceptance sequence.
 *
 * Runs the complete lifecycle in order, asserting at each step before
 * proceeding. A failure at step N stops the test immediately (fail-fast).
 *
 * Email verification (OTP) step: The OTP is intercepted by mocking
 * mail service and redis.service so we can capture and replay the OTP
 * without a real mail server. This exercises the real OTP code path.
 *
 * Requires: Docker running, @testcontainers/* installed.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import supertest from "supertest";
import { setup, teardown, resetDb, resetRedis } from "./helpers/containers.js";
import { randomUUID } from "crypto";

let request: ReturnType<typeof supertest>;
const API = "/v1";
const CSRF = "e2e-csrf-" + randomUUID();

// Capture OTP sent by the service
let capturedOtp = "";

beforeAll(async () => {
  const containers = await setup();

  vi.doMock("../src/db/postgres.init.js", () => ({
    default: () => containers.db,
    getPgDb: () => containers.db,
    getPgPool: () => containers.pool,
  }));
  vi.doMock("../src/config/redis.init.js", () => ({
    redisClient: containers.redis,
  }));
  vi.doMock("../src/config/env.js", () => ({
    env: {
      NODE_ENV: "test",
      PORT: 4003,
      API_VERSION: "v1",
      JWT_SECRET: "a".repeat(64),
      CORS_ORIGIN: ["http://localhost:3000"],
      COOKIE_DOMAIN: undefined,
      LOG_LEVEL: "silent",
      APP_VERSION: "1.0.0",
    },
  }));

  // Intercept the mail service so the real OTP is captured instead of sent. The
  // factory covers every export the app imports at load time.
  vi.doMock("../src/services/mail.service.js", () => ({
    verifyMailTransporter: async () => true,
    // Signature matches the real helper: callers pass (label, task).
    sendInBackground: (_label: string, task: () => Promise<void>) =>
      void task().catch(() => undefined),
    sendOtpMail: async (_email: string, otp: string) => {
      capturedOtp = otp;
    },
    sendWelcomeMail: async () => undefined,
    sendNewLoginAlertMail: async () => undefined,
    sendCredentialUpdatedMail: async () => undefined,
    sendAccountSuspendedMail: async () => undefined,
    sendAccountDeletedMail: async () => undefined,
    sendInterviewReminderMail: async () => undefined,
    sendInterviewCancelledMail: async () => undefined,
    sendPausedInterviewReminderMail: async () => undefined,
  }));

  const { default: app } = await import("../src/app.js");
  request = supertest(app);
}, 120_000);

afterAll(async () => {
  await teardown();
});

function extractCookie(cookies: string[] | undefined, name: string): string | undefined {
  return cookies
    ?.find((c) => c.startsWith(`${name}=`))
    ?.split(";")[0]
    ?.split("=")[1];
}

describe("Phase 1 acceptance sequence", () => {
  it("runs the full lifecycle end-to-end", async () => {
    await resetDb();
    await resetRedis();

    const email = `e2e-${randomUUID()}@example.com`;
    const password = "E2ePass1";
    const username = `e2e_${randomUUID().slice(0, 8)}`;

    // ── Step 1: Register ──────────────────────────────────────────────────────
    const registerRes = await request
      .post(`${API}/auth/register`)
      .set("Cookie", `csrf_token=${CSRF}`)
      .set("x-csrf-token", CSRF)
      .send({ email, password, username });

    expect(registerRes.status).toBe(200);
    expect(registerRes.body.success).toBe(true);
    // No secrets in response
    expect(JSON.stringify(registerRes.body)).not.toContain("password");
    expect(JSON.stringify(registerRes.body)).not.toContain("$2b$");

    // ── Step 2: Verify OTP (email verification is part of Phase 1) ────────────
    expect(capturedOtp).toHaveLength(6);
    expect(capturedOtp).toMatch(/^\d{6}$/);

    const verifyRes = await request
      .post(`${API}/auth/verify-otp`)
      .set("Cookie", `csrf_token=${CSRF}`)
      .set("x-csrf-token", CSRF)
      .send({ email, otp: capturedOtp });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);

    // ── Step 3: Login ─────────────────────────────────────────────────────────
    const loginRes = await request
      .post(`${API}/auth/login`)
      .set("Cookie", `csrf_token=${CSRF}`)
      .set("x-csrf-token", CSRF)
      .send({ email, password, deviceType: "desktop" });

    expect(loginRes.status).toBe(200);
    const loginCookies = loginRes.headers["set-cookie"] as string[];
    const accessToken = extractCookie(loginCookies, "access_token");
    const refreshToken = extractCookie(loginCookies, "refresh_token");
    const csrfToken = extractCookie(loginCookies, "csrf_token") ?? CSRF;

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    // ── Step 4: Access protected route ────────────────────────────────────────
    const meRes = await request
      .get(`${API}/usr/me`)
      .set("Cookie", `access_token=${accessToken}; csrf_token=${csrfToken}`)
      .set("x-csrf-token", csrfToken);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    // Response must not include password or internal fields
    expect(JSON.stringify(meRes.body)).not.toContain("password");

    // ── Step 5: Create an interview ───────────────────────────────────────────
    const createRes = await request
      .post(`${API}/interviews`)
      .set("Cookie", `access_token=${accessToken}; csrf_token=${csrfToken}`)
      .set("x-csrf-token", csrfToken)
      .send({
        jobrole: "Software Engineer",
        experience: "junior",
        interviewStyle: "FAANG",
        interviewType: "MIXED",
        duration: 30,
        isScheduled: false,
      });

    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    const interviewId = (createRes.body as { data: { id: string } }).data?.id;
    expect(interviewId).toBeTruthy();

    // ── Step 6: Retrieve interview by ID ──────────────────────────────────────
    const getRes = await request
      .get(`${API}/interviews/${interviewId}`)
      .set("Cookie", `access_token=${accessToken}; csrf_token=${csrfToken}`)
      .set("x-csrf-token", csrfToken);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    const returnedInterview = (getRes.body as { data: { id: string; interviewTitle: string } })
      .data;
    expect(returnedInterview.id).toBe(interviewId);
    expect(returnedInterview.interviewTitle).toContain("Software Engineer");

    // ── Step 7: Retrieve interview list ───────────────────────────────────────
    const listRes = await request
      .get(`${API}/interviews`)
      .set("Cookie", `access_token=${accessToken}; csrf_token=${csrfToken}`)
      .set("x-csrf-token", csrfToken);

    expect(listRes.status).toBe(200);
    const interviews = (listRes.body as { data: unknown[] }).data;
    expect(Array.isArray(interviews)).toBe(true);
    expect(interviews.length).toBeGreaterThanOrEqual(1);
    expect(interviews.some((i) => (i as { id: string }).id === interviewId)).toBe(true);

    // ── Step 8: Logout ────────────────────────────────────────────────────────
    const logoutRes = await request
      .post(`${API}/usr/logout`)
      .set(
        "Cookie",
        `access_token=${accessToken}; refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
      )
      .set("x-csrf-token", csrfToken);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // ── Step 9: Reuse same token after logout — must be rejected ──────────────
    const reuseRes = await request
      .get(`${API}/usr/me`)
      .set("Cookie", `access_token=${accessToken}; csrf_token=${csrfToken}`)
      .set("x-csrf-token", csrfToken);

    expect(reuseRes.status).toBe(401);
    // Proves logout invalidated the session server-side, not just cleared a cookie
  });
});
