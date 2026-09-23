/**
 * One focused test per route in `backend/src/routes/admin.routes.ts` (8).
 *
 * Admin surface is role-gated (`requireRole`), so each test signs in as a real
 * promoted account rather than forging a role onto the request.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  bootTestServer,
  stopTestServer,
  resetState,
  request,
  createAdmin,
  createUser,
  createInterview,
  type TestServer,
} from "./support.js";

let server: TestServer;

describe("admin routes", () => {
  beforeAll(async () => {
    server = await bootTestServer();
  }, 180_000);

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await resetState();
  });

  it("GET /admin/overview returns the dashboard totals", async () => {
    const admin = await createAdmin(server);

    const res = await request(admin, "get", "/admin/overview");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeTruthy();
  });

  it("GET /admin/users lists users with pagination metadata", async () => {
    const admin = await createAdmin(server);
    const target = await createUser(server);

    const res = await request(admin, "get", "/admin/users?page=1&limit=10");

    expect(res.status).toBe(200);
    const body = res.body.data as { users?: { id: string }[]; items?: { id: string }[] };
    const listed = body.users ?? body.items ?? [];
    expect(listed.map((u) => u.id)).toContain(target.userId);
  });

  it("GET /admin/users/:id returns one user", async () => {
    const admin = await createAdmin(server);
    const target = await createUser(server);

    const res = await request(admin, "get", `/admin/users/${target.userId}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: target.userId });
  });

  it("PATCH /admin/users/:id/role assigns the new role", async () => {
    const admin = await createAdmin(server);
    const target = await createUser(server);

    const res = await request(admin, "patch", `/admin/users/${target.userId}/role`).send({
      newRole: "moderator",
    });

    expect(res.status).toBe(200);
    const [row] = await server.query<{ user_role: string }>(
      "SELECT user_role FROM users WHERE id = $1",
      [target.userId],
    );
    expect(row?.user_role).toBe("moderator");
  });

  it("POST /admin/users/:id/suspend suspends the account", async () => {
    const admin = await createAdmin(server);
    const target = await createUser(server);

    const res = await request(admin, "post", `/admin/users/${target.userId}/suspend`).send({
      reason: "Lean suite check",
    });

    expect(res.status).toBe(200);
    const [row] = await server.query<{ account_status: string }>(
      "SELECT account_status FROM users WHERE id = $1",
      [target.userId],
    );
    expect(row?.account_status).toBe("suspended");
  });

  it("POST /admin/users/:id/reinstate reactivates a suspended account", async () => {
    const admin = await createAdmin(server);
    const target = await createUser(server);
    await request(admin, "post", `/admin/users/${target.userId}/suspend`).send({});

    const res = await request(admin, "post", `/admin/users/${target.userId}/reinstate`).send();

    expect(res.status).toBe(200);
    const [row] = await server.query<{ account_status: string }>(
      "SELECT account_status FROM users WHERE id = $1",
      [target.userId],
    );
    expect(row?.account_status).toBe("active");
  });

  it("GET /admin/interviews lists interviews across users", async () => {
    const admin = await createAdmin(server);
    const owner = await createUser(server);
    const interview = await createInterview(owner, { jobrole: "Admin Listed Role" });

    const res = await request(admin, "get", "/admin/interviews?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.data)).toContain(interview.id);
  });

  it("GET /admin/interviews/:id returns one interview", async () => {
    const admin = await createAdmin(server);
    const owner = await createUser(server);
    const interview = await createInterview(owner, { jobrole: "Admin Detail Role" });

    const res = await request(admin, "get", `/admin/interviews/${interview.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeTruthy();
  });
});
