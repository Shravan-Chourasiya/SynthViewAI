/**
 * One focused test per route in `backend/src/routes/analytics.routes.ts` (2).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  bootTestServer,
  stopTestServer,
  resetState,
  request,
  createUser,
  type TestServer,
} from "./support.js";

let server: TestServer;

describe("analytics routes", () => {
  beforeAll(async () => {
    server = await bootTestServer();
  }, 180_000);

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await resetState();
  });

  it("GET /analytics/me returns the caller's aggregates", async () => {
    const session = await createUser(server);

    const res = await request(session, "get", "/analytics/me");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeTruthy();
  });

  it("GET /analytics/me/trend returns the trend series", async () => {
    const session = await createUser(server);

    const res = await request(session, "get", "/analytics/me/trend");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
