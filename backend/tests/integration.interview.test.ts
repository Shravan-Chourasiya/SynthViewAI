/**
 * integration.interview.test.ts
 * REST endpoints of the interview module against real Postgres + Redis
 * testcontainers, with the AI provider chain mocked (no LLM calls).
 *
 * Covers: creation, lifecycle transitions (start/pause/resume/cancel/end),
 * fetching by id / list / metrics, and ownership + auth enforcement.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import supertest from "supertest";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { setup, teardown, resetDb, resetRedis, getContainers } from "./helpers/containers.js";
import { usersTable } from "../src/modules/auth/schemas/user.schema.js";
import { interviewQuestionsTable } from "../src/modules/interview/schemas/question.schema.js";

// ── AI provider stubs (Groq/Mistral chain is never touched) ───────────────────

vi.mock("../src/integrations/ai/index.js", () => ({
  startAiSession: async () => ({ threadId: "thread-test" }),
  generateNextQuestion: async () => ({
    question: {
      questionTitle: "Explain database indexing",
      questionDescription: null,
      questionType: "TECHNICAL",
      topic: "databases",
    },
  }),
  evaluateAnswer: async () => ({
    score: 80,
    correctness: 80,
    relevance: 80,
    clarity: 80,
    technicalDepth: 80,
    feedback: "good",
    strengths: ["clear"],
    weaknesses: [],
    detectionSignals: ["strong"],
  }),
  endAiSession: async () => {},
}));

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
      PORT: 4001,
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

afterAll(async () => {
  await teardown();
});
beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCookie(cookieHeader: string[] | string, name: string): string | null {
  const arr = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  for (const line of arr) {
    const m = line.match(new RegExp(`${name}=([^;]+)`));
    if (m) return m[1]!;
  }
  return null;
}

async function seedAndLogin() {
  const { db } = getContainers();
  const hash = await bcrypt.hash("Password1", 1);
  const email = `user-${randomUUID()}@example.com`;
  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      password: hash,
      username: `user_${randomUUID().slice(0, 8)}`,
      isVerified: true,
      accountStatus: "active",
    })
    .returning({ id: usersTable.id });

  const csrf = "csrf-" + randomUUID();
  const res = await request
    .post(`${API}/auth/login`)
    .set("Cookie", `csrf_token=${csrf}`)
    .set("x-csrf-token", csrf)
    .send({ email, password: "Password1" });
  expect(res.status).toBe(200);

  const accessToken = extractCookie(res.headers["set-cookie"], "access_token");
  const csrfToken = extractCookie(res.headers["set-cookie"], "csrf_token") ?? csrf;
  expect(accessToken).toBeTruthy();
  return { userId: user!.id!, accessToken: accessToken!, csrfToken };
}

function authed(accessToken: string, csrfToken: string) {
  const headers = (req: { set: (k: string, v: string) => unknown }) =>
    req
      .set("Cookie", `access_token=${accessToken}; csrf_token=${csrfToken}`)
      .set("x-csrf-token", csrfToken);
  return {
    get: (url: string) => headers(request.get(url)),
    post: (url: string) => headers(request.post(url)),
  };
}

const CREATE_INPUT = {
  jobrole: "Backend Engineer",
  experience: "mid-level",
  difficulty: "MEDIUM" as const,
  isAdaptive: true,
  interviewStyle: "REGULAR" as const,
  interviewType: "TECHNICAL" as const,
  duration: 15,
  maxFollowUps: 2,
  isScheduled: false,
  endingCriteria: "DURATION" as const,
};

async function createInterview(tokens: Awaited<ReturnType<typeof seedAndLogin>>) {
  const res = await authed(tokens.accessToken, tokens.csrfToken)
    .post(`${API}/interviews`)
    .send({ ...CREATE_INPUT });
  expect(res.status).toBe(200); // controller returns OK even for creation
  // The service returns the interview row directly as `data` (no `interview` key).
  return res.body.data as { id: string; interviewStatus: string };
}

async function startInterview(
  tokens: Awaited<ReturnType<typeof seedAndLogin>>,
  interviewId: string,
) {
  const res = await authed(tokens.accessToken, tokens.csrfToken).post(
    `${API}/interviews/${interviewId}/start`,
  );
  expect(res.status).toBe(200);
}

// ── Suite 1: Creation & auth/ownership enforcement ────────────────────────────

describe("POST /interviews — creation", () => {
  it("creates an unscheduled interview and returns it in READY state", async () => {
    const tokens = await seedAndLogin();
    const interview = await createInterview(tokens);
    expect(interview.interviewStatus).toBe("READY");
  });

  it("rejects unauthenticated creation with 401", async () => {
    const res = await request.post(`${API}/interviews`).send({ ...CREATE_INPUT });
    expect(res.status).toBe(401);
  });

  it("rejects a payload violating the zod schema with 400", async () => {
    const tokens = await seedAndLogin();
    // `duration` is `z.number().int().positive()` — a negative value violates it.
    const res = await authed(tokens.accessToken, tokens.csrfToken)
      .post(`${API}/interviews`)
      .send({ ...CREATE_INPUT, duration: -5 });
    // The zod validator middleware responds 422 (UNPROCESSABLE_ENTITY).
    expect(res.status).toBe(422);
  });

  it("rejects an unknown interviewType with 400", async () => {
    const tokens = await seedAndLogin();
    const res = await authed(tokens.accessToken, tokens.csrfToken)
      .post(`${API}/interviews`)
      .send({ ...CREATE_INPUT, interviewType: "CODING" });
    expect(res.status).toBe(422);
  });
});

// ── Suite 2: Lifecycle transitions over REST ─────────────────────────────────

describe("Interview lifecycle over REST", () => {
  it("start → INPROGRESS, cancel → CANCELLED (terminal)", async () => {
    const tokens = await seedAndLogin();
    const interview = await createInterview(tokens);

    await startInterview(tokens, interview.id);
    const started = await authed(tokens.accessToken, tokens.csrfToken).get(
      `${API}/interviews/${interview.id}`,
    );
    expect(
      started.body.data.interview?.interviewStatus ?? started.body.data.interviewStatus,
    ).toBe("INPROGRESS");

    const cancel = await authed(tokens.accessToken, tokens.csrfToken).post(
      `${API}/interviews/${interview.id}/cancel`,
    );
    expect(cancel.status).toBe(200);
    const after = await authed(tokens.accessToken, tokens.csrfToken).get(
      `${API}/interviews/${interview.id}`,
    );
    const status = after.body.data.interview?.interviewStatus ?? after.body.data.interviewStatus;
    expect(["CANCELLED"]).toContain(status);

    // Terminal state — start again must fail
    const restart = await authed(tokens.accessToken, tokens.csrfToken).post(
      `${API}/interviews/${interview.id}/start`,
    );
    expect(restart.status).toBeGreaterThanOrEqual(400);
  });

  it("end with fewer than 3 answered questions cancels, and history becomes available", async () => {
    const tokens = await seedAndLogin();
    const interview = await createInterview(tokens);
    await startInterview(tokens, interview.id);

    const end = await authed(tokens.accessToken, tokens.csrfToken).post(
      `${API}/interviews/${interview.id}/end`,
    );
    expect(end.status).toBe(200);

    // State-machine contract: <3 answered questions on end ⇒ CANCELLED.
    const after = await authed(tokens.accessToken, tokens.csrfToken).get(
      `${API}/interviews/${interview.id}`,
    );
    const status = after.body.data.interview?.interviewStatus ?? after.body.data.interviewStatus;
    expect(status).toBe("CANCELLED");

    const history = await authed(tokens.accessToken, tokens.csrfToken).get(
      `${API}/interviews/${interview.id}/history`,
    );
    expect(history.status).toBe(200);
    // Terminal interviews (including CANCELLED) expose history.
    expect(history.body.data.interviewId).toBe(interview.id);
    expect(Array.isArray(history.body.data.questions)).toBe(true);
  });

  it("starting an already-in-progress interview is rejected by the state guard", async () => {
    const tokens = await seedAndLogin();
    const interview = await createInterview(tokens);
    await startInterview(tokens, interview.id);

    const again = await authed(tokens.accessToken, tokens.csrfToken).post(
      `${API}/interviews/${interview.id}/start`,
    );
    expect(again.status).toBeGreaterThanOrEqual(400);
  });
});

// ── Suite 3: Read endpoints & ownership ──────────────────────────────────────

describe("Read endpoints & ownership", () => {
  it("lists only the owner's interviews", async () => {
    const a = await seedAndLogin();
    const b = await seedAndLogin();
    await createInterview(a);

    const listA = await authed(a.accessToken, a.csrfToken).get(`${API}/interviews`);
    expect(listA.status).toBe(200);
    const itemsA = listA.body.data.interviews ?? listA.body.data;
    expect(itemsA.length).toBe(1);

    const listB = await authed(b.accessToken, b.csrfToken).get(`${API}/interviews`);
    const itemsB = listB.body.data.interviews ?? listB.body.data;
    expect(itemsB.length).toBe(0);
  });

  it("another user cannot fetch an interview by id (ownership middleware)", async () => {
    const owner = await seedAndLogin();
    const other = await seedAndLogin();
    const interview = await createInterview(owner);

    const res = await authed(other.accessToken, other.csrfToken).get(
      `${API}/interviews/${interview.id}`,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("an unknown interview id yields 4xx", async () => {
    const tokens = await seedAndLogin();
    const res = await authed(tokens.accessToken, tokens.csrfToken).get(
      `${API}/interviews/${randomUUID()}`,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("metrics are rejected while the interview is not completed", async () => {
    const tokens = await seedAndLogin();
    const interview = await createInterview(tokens);
    const res = await authed(tokens.accessToken, tokens.csrfToken).get(
      `${API}/interviews/${interview.id}/metrics`,
    );
    // Service contract: metrics require COMPLETED, otherwise 400.
    expect(res.status).toBe(400);
  });

  it("metrics return counts once the interview is COMPLETED", async () => {
    const tokens = await seedAndLogin();
    const interview = await createInterview(tokens);
    await startInterview(tokens, interview.id);

    // endInterviewService only completes an interview with >= 3 answered
    // questions — anything less is CANCELLED (and metrics reject non-COMPLETED).
    const { db } = getContainers();
    await db.insert(interviewQuestionsTable).values(
      [1, 2, 3].map((n) => ({
        interviewId: interview.id,
        sequenceNumber: n,
        questionTitle: `Seeded question ${n}`,
        questionType: "TECHNICAL" as const,
        questionState: "ANSWERED" as const,
      })),
    );

    const end = await authed(tokens.accessToken, tokens.csrfToken).post(
      `${API}/interviews/${interview.id}/end`,
    );
    expect(end.status).toBe(200);

    const completed = await authed(tokens.accessToken, tokens.csrfToken).get(
      `${API}/interviews/${interview.id}`,
    );
    const status =
      completed.body.data.interview?.interviewStatus ?? completed.body.data.interviewStatus;
    expect(status).toBe("COMPLETED");

    const res = await authed(tokens.accessToken, tokens.csrfToken).get(
      `${API}/interviews/${interview.id}/metrics`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toBeTruthy();
  });
});
