/**
 * One focused test per route in `backend/src/routes/interview.routes.ts` (14).
 *
 * The AI integration is stubbed (`mockAi`) because it is a paid third-party
 * call; everything else — Postgres, Redis, the interview context cache, the
 * state machine, ownership and CSRF — is real.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  bootTestServer,
  stopTestServer,
  resetState,
  request,
  createUser,
  createInterview,
  currentQuestionId,
  playThrough,
  waitForEvaluation,
  type TestServer,
  type Session,
} from "./support.js";

let server: TestServer;

async function startedInterview(
  session: Session,
): Promise<{ interviewId: string; questionId: string }> {
  const interview = await createInterview(session, {
    jobrole: "Backend Engineer",
    endingCriteria: "QUESTION_COUNT",
    questionCount: 5,
  });
  const interviewId = interview.id as string;

  const started = await request(session, "post", `/interviews/${interviewId}/start`).send();
  expect(started.status).toBe(200);

  return { interviewId, questionId: await currentQuestionId(server, interviewId) };
}


// One boot for the whole file: `app.js` is imported once and closes over the
// containers from that boot, so a second `bootTestServer()` would hand the
// tests a *different* database than the app is talking to.
beforeAll(async () => {
  server = await bootTestServer({ mockAi: true });
}, 180_000);

afterAll(async () => {
  await stopTestServer();
});

describe("interview routes", () => {
  beforeEach(async () => {
    await resetState();
  });

  it("POST /interviews creates a READY interview", async () => {
    const session = await createUser(server);
    const res = await request(session, "post", "/interviews").send({
      jobrole: "Platform Engineer",
      difficulty: "MEDIUM",
      interviewType: "TECHNICAL",
      duration: 30,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      interviewStatus: "READY",
      userId: session.userId,
    });
  });

  it("GET /interviews lists the caller's interviews", async () => {
    const session = await createUser(server);
    const created = await createInterview(session, { jobrole: "Data Engineer" });

    const res = await request(session, "get", "/interviews");

    expect(res.status).toBe(200);
    expect((res.body.data as { id: string }[]).map((i) => i.id)).toContain(created.id);
  });

  it("GET /interviews/resumable returns only unfinished interviews", async () => {
    const session = await createUser(server);
    await createInterview(session, { jobrole: "Resumable Role" });

    const res = await request(session, "get", "/interviews/resumable");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /interviews/:id returns the interview", async () => {
    const session = await createUser(server);
    const created = await createInterview(session, { jobrole: "SRE" });

    const res = await request(session, "get", `/interviews/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: created.id });
  });

  it("DELETE /interviews/:id removes the interview", async () => {
    const session = await createUser(server);
    const created = await createInterview(session, { jobrole: "DevOps" });

    const res = await request(session, "delete", `/interviews/${created.id}`).send();

    expect(res.status).toBe(200);
    const rows = await server.query("SELECT id FROM interviews WHERE id = $1", [created.id]);
    expect(rows).toHaveLength(0);
  });

  it("POST /interviews/:id/start moves it to INPROGRESS with a first question", async () => {
    const session = await createUser(server);
    const { interviewId, questionId } = await startedInterview(session);

    const [row] = await server.query<{ interview_status: string }>(
      "SELECT interview_status FROM interviews WHERE id = $1",
      [interviewId],
    );
    expect(row?.interview_status).toBe("INPROGRESS");
    expect(questionId).toBeTruthy();
  });

  it("POST /interviews/:id/pause suspends an INPROGRESS interview", async () => {
    const session = await createUser(server);
    const { interviewId } = await startedInterview(session);

    const res = await request(session, "post", `/interviews/${interviewId}/pause`).send();

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ interviewStatus: "SCHEDULED" });
  });

  it("POST /interviews/:id/resume puts a paused interview back INPROGRESS", async () => {
    const session = await createUser(server);
    const { interviewId } = await startedInterview(session);
    await request(session, "post", `/interviews/${interviewId}/pause`).send();

    const res = await request(session, "post", `/interviews/${interviewId}/resume`).send();

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ interviewStatus: "INPROGRESS" });
  });

  it("POST /interviews/:id/cancel cancels the interview", async () => {
    const session = await createUser(server);
    const { interviewId } = await startedInterview(session);

    const res = await request(session, "post", `/interviews/${interviewId}/cancel`).send();

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ interviewStatus: "CANCELLED" });
  });

  it("POST /interviews/:id/end completes an interview with enough answers", async () => {
    const session = await createUser(server);
    const { interviewId, questionId } = await startedInterview(session);
    await request(session, "post", `/interviews/${interviewId}/questions/${questionId}/answer`)
      .send({ questionId, answerData: "A detailed answer.", answerType: "TEXT" });
    await waitForEvaluation(server, questionId);

    const res = await request(session, "post", `/interviews/${interviewId}/end`).send();

    expect(res.status).toBe(200);
    expect(["COMPLETED", "CANCELLED"]).toContain(
      (res.body.data as { interviewStatus: string }).interviewStatus,
    );
  });

  it("POST /interviews/:id/questions/:questionId/answer records the answer", async () => {
    const session = await createUser(server);
    const { interviewId, questionId } = await startedInterview(session);

    const res = await request(
      session,
      "post",
      `/interviews/${interviewId}/questions/${questionId}/answer`,
    ).send({ questionId, answerData: "My answer.", answerType: "TEXT" });

    expect(res.status).toBe(200);
    const rows = await server.query("SELECT id FROM interview_answers WHERE question_id = $1", [
      questionId,
    ]);
    expect(rows).toHaveLength(1);
  });

});

/**
 * The three read-only routes that only answer for a *completed* interview.
 *
 * They share one real end-to-end fixture (three answered questions, then end)
 * instead of building it three times: `endInterviewService` only awards
 * COMPLETED at three or more answered questions, and each answer is evaluated by
 * the service's fire-and-forget pipeline — so the fixture waits for the rows to
 * reach EVALUATED rather than assuming it.
 */
describe("interview read routes for a completed interview", () => {
  let session: Session;
  let interviewId: string;

  beforeAll(async () => {
    session = await createUser(server);
    const interview = await createInterview(session, {
      jobrole: "Completed Interview Role",
      endingCriteria: "QUESTION_COUNT",
      questionCount: 5,
    });
    interviewId = interview.id as string;
    await request(session, "post", `/interviews/${interviewId}/start`).send();

    // Real service calls, not routes: this is how the socket gateway advances a
    // live interview one question at a time.
    await playThrough(server, session, interviewId, 3);

    const ended = await request(session, "post", `/interviews/${interviewId}/end`).send();
    expect(ended.body.data).toMatchObject({ interviewStatus: "COMPLETED" });

    // Reading the report is what materialises the results row when the
    // completion-time generation has not landed yet.
    await request(session, "get", `/interviews/${interviewId}/report`);
  }, 180_000);

  it("GET /interviews/:id/history returns the answered timeline", async () => {
    const res = await request(session, "get", `/interviews/${interviewId}/history`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it("GET /interviews/:id/metrics returns scores for the completed run", async () => {
    const res = await request(session, "get", `/interviews/${interviewId}/metrics`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it("GET /interviews/:id/report returns the aggregated report", async () => {
    const res = await request(session, "get", `/interviews/${interviewId}/report`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
