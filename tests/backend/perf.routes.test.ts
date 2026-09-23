/**
 * Timed smoke checks on the load-sensitive surface: the interview list the
 * dashboard fans out to, and the answer submission the live room depends on.
 *
 * These are deliberately not benchmarks. They assert a generous ceiling (see
 * `BUDGET_MS`) so a genuine regression — an N+1 query, a blocking AI call
 * pulled back onto the request path — fails loudly, while a slow CI box does
 * not. A warm-up request runs first so route compilation and connection setup
 * are not part of the measurement.
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
  waitForEvaluation,
  type TestServer,
  type Session,
} from "./support.js";

/** Ceiling for a single request on the hot paths, in milliseconds. */
const BUDGET_MS = 3000;
const CONCURRENCY = 10;

let server: TestServer;

async function timed(run: () => Promise<unknown>): Promise<number> {
  const started = performance.now();
  await run();
  return performance.now() - started;
}

describe("route performance smoke checks", () => {
  beforeAll(async () => {
    server = await bootTestServer({ mockAi: true });
  }, 180_000);

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await resetState();
  });

  it("serves concurrent interview list requests within budget", async () => {
    const session = await createUser(server);
    for (let index = 0; index < 3; index += 1) {
      await createInterview(session, { jobrole: `Perf Role ${index}` });
    }

    // Warm-up: first call pays for module-level setup, not for the query.
    await request(session, "get", "/interviews");

    const started = performance.now();
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => request(session, "get", "/interviews")),
    );
    const elapsed = performance.now() - started;

    for (const res of responses) expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(BUDGET_MS * CONCURRENCY);
    expect(elapsed / CONCURRENCY).toBeLessThan(BUDGET_MS);
  });

  it("answers a submission immediately while evaluation runs in the background", async () => {
    const session: Session = await createUser(server);
    const interview = await createInterview(session, {
      jobrole: "Perf Answer Role",
      endingCriteria: "QUESTION_COUNT",
      questionCount: 5,
    });
    const interviewId = interview.id as string;
    await request(session, "post", `/interviews/${interviewId}/start`).send();
    const questionId = await currentQuestionId(server, interviewId);

    const duration = await timed(() =>
      request(session, "post", `/interviews/${interviewId}/questions/${questionId}/answer`).send({
        questionId,
        answerData: "A candidate answer long enough to require real evaluation work.",
        answerType: "TEXT",
      }),
    );

    expect(duration).toBeLessThan(BUDGET_MS);
    // Persisted synchronously...
    const answers = await server.query(
      "SELECT id FROM interview_answers WHERE question_id = $1",
      [questionId],
    );
    expect(answers).toHaveLength(1);

    // ...while the score arrives later, off the request path.
    await waitForEvaluation(server, questionId);
  });
});
