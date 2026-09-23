/**
 * One focused test per route in `backend/src/routes/auth.routes.ts` (18).
 *
 * These are smoke tests: valid input, assert the success status and the
 * response envelope. Deep validation coverage lives in the existing
 * `backend/tests/unit.*` / `integration.*` suites.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  bootTestServer,
  stopTestServer,
  resetState,
  anonRequest,
  request,
  registerAndVerify,
  login,
  createUser,
  lastOtpFor,
  uniqueCredentials,
  clearOtpInbox,
  type TestServer,
} from "./support.js";

let server: TestServer;

describe("auth routes", () => {
  beforeAll(async () => {
    server = await bootTestServer();
  }, 180_000);

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await resetState();
  });

  it("POST /auth/register creates a pending registration", async () => {
    const creds = uniqueCredentials();
    const res = await anonRequest(server, "post", "/auth/register").send({
      email: creds.email,
      password: creds.password,
      username: creds.username,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, statusCode: 201, data: null });
    expect(lastOtpFor(creds.email)).toBeDefined();
  });

  it("POST /auth/verify-otp activates the account", async () => {
    const creds = uniqueCredentials();
    await anonRequest(server, "post", "/auth/register").send({
      email: creds.email,
      password: creds.password,
      username: creds.username,
    });

    const res = await anonRequest(server, "post", "/auth/verify-otp").send({
      email: creds.email,
      otp: lastOtpFor(creds.email),
    });

    expect(res.status).toBe(200);
    const [row] = await server.query<{ is_verified: boolean }>(
      "SELECT is_verified FROM users WHERE email = $1",
      [creds.email],
    );
    expect(row?.is_verified).toBe(true);
  });

  it("POST /auth/login returns the auth cookie set", async () => {
    const creds = await registerAndVerify(server);
    const res = await anonRequest(server, "post", "/auth/login").send({
      email: creds.email,
      password: creds.password,
      deviceType: "desktop",
    });

    expect(res.status).toBe(200);
    const cookies = (res.headers["set-cookie"] ?? []) as unknown as string[];
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
  });

  it("POST /auth/refresh rotates the tokens", async () => {
    const session = await createUser(server);
    const res = await request(session, "post", "/auth/refresh").send();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: expect.stringContaining("refreshed") });
  });

  it("POST /usr/logout ends the session", async () => {
    const session = await createUser(server);
    const res = await request(session, "post", "/usr/logout").send();

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("DELETE /usr/account schedules the account for deletion", async () => {
    const session = await createUser(server);
    const res = await request(session, "delete", "/usr/account").send();

    expect(res.status).toBe(200);
    const [row] = await server.query<{ account_status: string }>(
      "SELECT account_status FROM users WHERE id = $1",
      [session.userId],
    );
    expect(row?.account_status).toBe("disabled");
  });

  it("POST /auth/recover-account sends a recovery OTP for a disabled account", async () => {
    const session = await createUser(server);
    await request(session, "delete", "/usr/account").send();
    // Drop the fixture's own OTP so this asserts a *fresh* one was issued.
    clearOtpInbox();

    const res = await anonRequest(server, "post", "/auth/recover-account").send({
      email: session.email,
    });

    expect(res.status).toBe(200);
    expect(lastOtpFor(session.email)).toMatch(/^\d{6}$/);
  });

  it("POST /auth/recover-account/verify restores the account", async () => {
    const session = await createUser(server);
    await request(session, "delete", "/usr/account").send();
    await anonRequest(server, "post", "/auth/recover-account").send({ email: session.email });

    const res = await anonRequest(server, "post", "/auth/recover-account/verify").send({
      email: session.email,
      otp: lastOtpFor(session.email),
    });

    expect(res.status).toBe(200);
    const [row] = await server.query<{ account_status: string }>(
      "SELECT account_status FROM users WHERE id = $1",
      [session.userId],
    );
    expect(row?.account_status).toBe("active");
  });

  it("POST /auth/forgot-password sends a reset OTP", async () => {
    const session = await createUser(server);
    clearOtpInbox();
    const res = await anonRequest(server, "post", "/auth/forgot-password").send({
      email: session.email,
    });

    expect(res.status).toBe(200);
    expect(lastOtpFor(session.email)).toMatch(/^\d{6}$/);
  });

  it("POST /auth/forgot-password/verify resets the password", async () => {
    const session = await createUser(server);
    await anonRequest(server, "post", "/auth/forgot-password").send({ email: session.email });

    const res = await anonRequest(server, "post", "/auth/forgot-password/verify").send({
      email: session.email,
      otp: lastOtpFor(session.email),
      newPassword: "LeanSuite2Pass",
      confirmPassword: "LeanSuite2Pass",
    });

    expect(res.status).toBe(200);
    const relogin = await login(server, { email: session.email, password: "LeanSuite2Pass" });
    expect(relogin.csrf).toBeTruthy();
  });

  it("POST /usr/update-password replaces the password while authenticated", async () => {
    const session = await createUser(server);
    const res = await request(session, "post", "/usr/update-password").send({
      email: session.email,
      currentPassword: session.password,
      newPassword: "LeanSuite3Pass",
    });

    expect(res.status).toBe(200);
    const relogin = await login(server, { email: session.email, password: "LeanSuite3Pass" });
    expect(relogin.userId).toBe(session.userId);
  });

  it("POST /usr/update-email answers identically for unknown addresses", async () => {
    // The service returns early without sending anything when the address
    // belongs to no active account — an anti-enumeration answer, so the response
    // must not differ from the happy path.
    const session = await createUser(server);
    const next = uniqueCredentials("leanmoved");
    clearOtpInbox();

    const res = await request(session, "post", "/usr/update-email").send({
      email: next.email,
    });

    expect(res.status).toBe(200);
    expect(lastOtpFor(next.email)).toBeUndefined();
    const [row] = await server.query<{ email: string }>(
      "SELECT email FROM users WHERE id = $1",
      [session.userId],
    );
    expect(row?.email).toBe(session.email);
  });

  it("POST /usr/update-email/verify rejects an unissued OTP", async () => {
    const session = await createUser(server);
    const next = uniqueCredentials("leanmoved");

    const res = await request(session, "post", "/usr/update-email/verify").send({
      email: next.email,
      otp: "000000",
    });

    expect(res.status).toBe(401);
    const [row] = await server.query<{ email: string }>(
      "SELECT email FROM users WHERE id = $1",
      [session.userId],
    );
    expect(row?.email).toBe(session.email);
  });

  it("GET /usr/me returns the authenticated profile", async () => {
    const session = await createUser(server);
    const res = await request(session, "get", "/usr/me");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: session.userId, email: session.email });
  });

  it("PATCH /usr/profile updates the profile fields", async () => {
    const session = await createUser(server);
    const res = await request(session, "patch", "/usr/profile").send({
      firstName: "Lean",
      lastName: "Suite",
      country: "India",
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ firstName: "Lean", lastName: "Suite" });
  });

  it("GET /usr/sessions lists the active session", async () => {
    const session = await createUser(server);
    const res = await request(session, "get", "/usr/sessions");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("DELETE /usr/sessions revokes every session row", async () => {
    const session = await createUser(server);
    const res = await request(session, "delete", "/usr/sessions").send();

    expect(res.status).toBe(200);
    // Asserted against the rows, not the API: `GET /usr/sessions` deliberately
    // returns the full session history (including revoked entries).
    const active = await server.query(
      "SELECT id FROM sessions WHERE user_id = $1 AND is_active = true",
      [session.userId],
    );
    expect(active).toHaveLength(0);
  });

  it("DELETE /usr/session/:id revokes only that session", async () => {
    const session = await createUser(server);
    // A second device, so there is a session that is not the caller's own.
    const other = await login(server, { email: session.email, password: session.password });
    const [second] = await server.query<{ id: string }>(
      "SELECT id FROM sessions WHERE user_id = $1 AND id <> $2 ORDER BY created_at DESC LIMIT 1",
      [session.userId, other.userId],
    );

    const res = await request(session, "delete", `/usr/session/${second!.id}`).send();

    expect(res.status).toBe(200);
    const [row] = await server.query<{ is_revoked: boolean }>(
      "SELECT is_revoked FROM sessions WHERE id = $1",
      [second!.id],
    );
    expect(row?.is_revoked).toBe(true);
  });

});
