/**
 * Multi-step flows through the real route handlers, in sequence, with no
 * mocking between steps: register → verify → login → create → start → answer →
 * end → report, plus the two cross-cutting guards (CSRF, ownership) that a
 * single-route test cannot exercise.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  bootTestServer,
  stopTestServer,
  resetState,
  request,
  registerAndVerify,
  login,
  createUser,
  createInterview,
  currentQuestionId,
  playThrough,
  type TestServer,
} from "./support.js";

let server: TestServer;

describe("integration flows", () => {
  beforeAll(async () => {
    server = await bootTestServer({ mockAi: true });
  }, 180_000);

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await resetState();
  });

  it("takes a new account from registration to a finished report", async () => {
    // Register + verify through the API, then log in for real cookies.
    const creds = await registerAndVerify(server);
    const session = await login(server, creds);

    const interview = await createInterview(session, {
      jobrole: "Integration Flow Role",
      endingCriteria: "QUESTION_COUNT",
      questionCount: 5,
    });
    const interviewId = interview.id as string;

    const started = await request(session, "post", `/interviews/${interviewId}/start`).send();
    expect(started.status).toBe(200);

    await playThrough(server, session, interviewId, 3);

    const ended = await request(session, "post", `/interviews/${interviewId}/end`).send();
    expect(ended.body.data).toMatchObject({ interviewStatus: "COMPLETED" });

    const report = await request(session, "get", `/interviews/${interviewId}/report`);
    expect(report.status).toBe(200);

    const history = await request(session, "get", `/interviews/${interviewId}/history`);
    expect(history.status).toBe(200);
  });

  it("walks the account lifecycle: profile, sessions, logout", async () => {
    const session = await createUser(server);

    const profile = await request(session, "patch", "/usr/profile").send({
      firstName: "Integration",
      lastName: "Flow",
    });
    expect(profile.status).toBe(200);

    const beforeLogout = await request(session, "get", "/usr/sessions");
    expect((beforeLogout.body.data as { isActive: boolean }[]).length).toBeGreaterThan(0);

    const loggedOut = await request(session, "post", "/usr/logout").send();
    expect(loggedOut.status).toBe(200);

    // The session row, not the token, is the durable record of the logout.
    const active = await server.query(
      "SELECT id FROM sessions WHERE user_id = $1 AND is_active = true",
      [session.userId],
    );
    expect(active).toHaveLength(0);
  });

  it("refuses a mutating request without CSRF and another user's interview", async () => {
    const owner = await createUser(server);
    const interview = await createInterview(owner, { jobrole: "Ownership Role" });

    // No x-csrf-token header on a mutating call.
    const noCsrf = await owner.anon
      .delete(`${server.api}/interviews/${interview.id}`)
      .set("Cookie", owner.cookie);
    expect(noCsrf.status).toBe(403);

    // A valid session belonging to somebody else is refused by the ownership
    // middleware (`requireOwnership` → 403 for a record it does not own).
    const intruder = await createUser(server);
    const foreign = await request(intruder, "get", `/interviews/${interview.id}`);
    expect(foreign.status).toBe(403);

    // ...and the interview is still the owner's.
    const stillThere = await request(owner, "get", `/interviews/${interview.id}`);
    expect(stillThere.status).toBe(200);
  });
});
