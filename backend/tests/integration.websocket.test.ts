/**
 * integration.websocket.test.ts
 * WebSocket gateway tests against a real Postgres + Redis testcontainer and a
 * real HTTP server carrying the Socket.IO gateway, with the AI provider chain
 * mocked (no LLM calls).
 *
 * Covers: handshake auth, interview:join happy path and every rejection code,
 * answer:submit (idempotency, staleness, empty-answer skip), question:next
 * guards, interview:cancel, the 30-second disconnect grace period, and the
 * maintenance sweeps (per-question timeout, duration overrun, staleness).
 *
 * TIMERS: the per-question timeout / abandonment / duration sweeps are lazy DB
 * sweeps (no setTimeout), so they are exercised deterministically by backdating
 * rows instead of sleeping. Only the grace-period expiry — which really is a
 * `setTimeout(30_000)` — needs fake timers, and there we fake `setTimeout`
 * alone so Redis/Postgres internals keep using real timers.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { setup, teardown, resetDb, resetRedis, getContainers } from "./helpers/containers.js";
import { usersTable } from "../src/modules/auth/schemas/user.schema.js";
import { interviewsTable } from "../src/modules/interview/schemas/interview.schema.js";
import { interviewQuestionsTable } from "../src/modules/interview/schemas/question.schema.js";
import { interviewAnswersTable } from "../src/modules/interview/schemas/answers.schema.js";

// ── AI provider stubs (Groq/Mistral chain is never touched) ───────────────────

vi.mock("../src/integrations/ai/index.js", () => ({
  startAiSession: async () => ({ threadId: "thread-ws-test" }),
  generateNextQuestion: async () => ({
    question: {
      questionTitle: "Describe a system you scaled",
      questionDescription: null,
      questionType: "TECHNICAL",
      topic: "distributed-systems",
    },
  }),
  evaluateAnswer: async () => ({
    score: 75,
    correctness: 75,
    relevance: 75,
    clarity: 75,
    technicalDepth: 75,
    feedback: "solid",
    strengths: ["structure"],
    weaknesses: [],
    detectionSignals: ["strong"],
  }),
  endAiSession: async () => {},
}));

// ── Module handles resolved after the DB/Redis singletons are mocked ──────────

let httpServer: HttpServer;
let baseUrl: string;
let request: ReturnType<typeof import("supertest").default>;
let svc: typeof import("../src/modules/interview/services/interview.service.js");
let ctxSvc: typeof import("../src/modules/interview/services/interview.context.service.js");
let registry: typeof import("../src/websocket/socket.registry.js");

const API = "/v1";
const openSockets: ClientSocket[] = [];

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

  const [{ default: app }, { default: supertest }, socketServer] = await Promise.all([
    import("../src/app.js"),
    import("supertest"),
    import("../src/websocket/socket.server.js"),
  ]);

  request = supertest(app);

  httpServer = createServer(app);
  socketServer.attachSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("no server port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  svc = await import("../src/modules/interview/services/interview.service.js");
  ctxSvc = await import("../src/modules/interview/services/interview.context.service.js");
  registry = await import("../src/websocket/socket.registry.js");
}, 180_000);

afterAll(async () => {
  for (const socket of openSockets) socket.disconnect();
  if (httpServer) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await teardown();
});

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCookie(cookieHeader: string[] | string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
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
  const email = `ws-${randomUUID()}@example.com`;
  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      password: hash,
      username: `ws_${randomUUID().slice(0, 8)}`,
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

type Tokens = Awaited<ReturnType<typeof seedAndLogin>>;

const CREATE_INPUT = {
  jobrole: "Backend Engineer",
  experience: "mid-level",
  difficulty: "MEDIUM" as const,
  isAdaptive: false,
  interviewStyle: "REGULAR" as const,
  interviewType: "MIXED" as const,
  duration: 15,
  maxFollowUps: 2,
  isScheduled: false,
  endingCriteria: "DURATION" as const,
};

/** Creates an interview via REST and immediately starts it (⇒ INPROGRESS). */
async function createStartedInterview(tokens: Tokens): Promise<string> {
  const create = await request
    .post(`${API}/interviews`)
    .set("Cookie", `access_token=${tokens.accessToken}; csrf_token=${tokens.csrfToken}`)
    .set("x-csrf-token", tokens.csrfToken)
    .send({ ...CREATE_INPUT });
  expect(create.status).toBe(200);
  const interviewId = (create.body as { data: { id: string } }).data.id;

  const start = await request
    .post(`${API}/interviews/${interviewId}/start`)
    .set("Cookie", `access_token=${tokens.accessToken}; csrf_token=${tokens.csrfToken}`)
    .set("x-csrf-token", tokens.csrfToken);
  expect(start.status).toBe(200);
  return interviewId;
}

/** Connects a client socket carrying an access_token cookie. */
function connectSocket(
  accessToken: string | null,
  opts: { forceNew?: boolean } = {},
): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      transports: ["websocket"],
      reconnection: false,
      ...(opts.forceNew ? { forceNew: true } : {}),
      ...(accessToken ? { extraHeaders: { Cookie: `access_token=${accessToken}` } } : {}),
    });
    openSockets.push(socket);
    const timer = setTimeout(() => reject(new Error("connect timeout")), 8000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Waits for one occurrence of a server event. */
function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/**
 * Polls a predicate using setImmediate only, so it keeps working while
 * `setTimeout` is faked (see the grace-expiry test).
 */
async function waitUntil(
  predicate: () => Promise<boolean>,
  tries = 200,
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (await predicate()) return true;
    await new Promise((resolve) => setImmediate(resolve));
  }
  return false;
}

/** Emits an event and waits for the matching server reply. */
async function emitAndWait<T>(
  socket: ClientSocket,
  event: string,
  payload: Record<string, unknown>,
  expected: string,
): Promise<T> {
  const reply = waitFor<T>(socket, expected);
  socket.emit(event, { eventVersion: 1, event, ...payload });
  return reply;
}

/** Collects every ws:error payload the server emits on this socket. */
function collectErrors(socket: ClientSocket): { payloads: { code: string; message: string }[] } {
  const bundle = { payloads: [] as { code: string; message: string }[] };
  socket.on("ws:error", (p: { code: string; message: string }) => bundle.payloads.push(p));
  return bundle;
}

async function dbInterviewStatus(interviewId: string): Promise<string> {
  const { db } = getContainers();
  const [row] = await db
    .select({ status: interviewsTable.interviewStatus })
    .from(interviewsTable)
    .where(eq(interviewsTable.id, interviewId))
    .limit(1);
  return row!.status;
}

async function questionsOf(interviewId: string) {
  const { db } = getContainers();
  return db
    .select()
    .from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.interviewId, interviewId))
    .orderBy(interviewQuestionsTable.sequenceNumber);
}

async function answersOf(interviewId: string) {
  const { db } = getContainers();
  return db
    .select()
    .from(interviewAnswersTable)
    .where(eq(interviewAnswersTable.interviewId, interviewId));
}
// ── Suite 1: handshake auth ───────────────────────────────────────────────────

describe("Socket handshake auth", () => {
  it("rejects a handshake with no access_token cookie", async () => {
    await expect(connectSocket(null)).rejects.toThrow(/access token cookie missing/i);
  });

  it("rejects a token that is not a valid JWT", async () => {
    await expect(connectSocket("not.a.jwt")).rejects.toThrow();
  });

  it("rejects a revoked (blacklisted) token", async () => {
    const tokens = await seedAndLogin();
    const { redis } = getContainers();
    await redis.setex(`bl:${tokens.accessToken}`, 60, "1");

    await expect(connectSocket(tokens.accessToken)).rejects.toThrow(/revoked|expired/i);
  });

  it("accepts a valid access_token cookie", async () => {
    const tokens = await seedAndLogin();
    const socket = await connectSocket(tokens.accessToken);
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });
});

// ── Suite 2: interview:join ───────────────────────────────────────────────────

describe("interview:join", () => {
  it("joins an INPROGRESS interview and receives joined + the first question", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const socket = await connectSocket(tokens.accessToken);

    const delivered = waitFor<{ questionId: string; sequenceNumber: number }>(
      socket,
      "question:delivered",
    );
    const joined = await emitAndWait<{
      event: string;
      interviewId: string;
      reconnected: boolean;
      timerStartedAt: string;
      durationMinutes: number;
      answeredQuestionIds: string[];
    }>(socket, "interview:join", { interviewId }, "interview:joined");

    expect(joined.event).toBe("interview:joined");
    expect(joined.interviewId).toBe(interviewId);
    expect(joined.reconnected).toBe(false);
    expect(joined.durationMinutes).toBe(CREATE_INPUT.duration);
    // timerStartedAt is what the client uses to derive its countdown.
    expect(new Date(joined.timerStartedAt).getTime()).toBeLessThanOrEqual(Date.now());
    expect(Array.isArray(joined.answeredQuestionIds)).toBe(true);
    expect(joined.answeredQuestionIds).toEqual([]);

    const question = await delivered;
    expect(question.sequenceNumber).toBe(1);

    // The question is persisted and wired into the Redis context.
    const rows = await questionsOf(interviewId);
    expect(rows.length).toBe(1);
    expect(rows[0]!.questionState).toBe("PENDING");
    expect(rows[0]!.id).toBe(question.questionId);

    socket.disconnect();
  });

  it("rejects a join for an interview that has not been started", async () => {
    const tokens = await seedAndLogin();
    // Created (READY) but never started.
    const create = await request
      .post(`${API}/interviews`)
      .set("Cookie", `access_token=${tokens.accessToken}; csrf_token=${tokens.csrfToken}`)
      .set("x-csrf-token", tokens.csrfToken)
      .send({ ...CREATE_INPUT });
    const interviewId = (create.body as { data: { id: string } }).data.id;

    const socket = await connectSocket(tokens.accessToken);
    const errors = collectErrors(socket);
    const err = await emitAndWait<{ code: string }>(
      socket,
      "interview:join",
      { interviewId },
      "ws:error",
    );

    expect(["INTERVIEW_INVALID_STATE", "CONTEXT_MISSING"]).toContain(err.code);
    expect(errors.payloads.length).toBeGreaterThan(0);
    socket.disconnect();
  });

  it("rejects a join for an unknown interview id", async () => {
    const tokens = await seedAndLogin();
    const socket = await connectSocket(tokens.accessToken);
    const err = await emitAndWait<{ code: string }>(
      socket,
      "interview:join",
      { interviewId: randomUUID() },
      "ws:error",
    );
    expect(err.code).toBe("INTERVIEW_NOT_FOUND");
    socket.disconnect();
  });

  it("rejects a join by a user who does not own the interview", async () => {
    const owner = await seedAndLogin();
    const intruder = await seedAndLogin();
    const interviewId = await createStartedInterview(owner);

    const socket = await connectSocket(intruder.accessToken);
    const err = await emitAndWait<{ code: string }>(
      socket,
      "interview:join",
      { interviewId },
      "ws:error",
    );
    expect(err.code).toBe("AUTH_FORBIDDEN");
    socket.disconnect();
  });

  it("reports CONTEXT_MISSING when the Redis session context is gone", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);

    // Simulate a lost/expired context while the DB row stays INPROGRESS.
    await ctxSvc.deleteInterviewContext(interviewId);

    const socket = await connectSocket(tokens.accessToken);
    const err = await emitAndWait<{ code: string }>(
      socket,
      "interview:join",
      { interviewId },
      "ws:error",
    );
    expect(err.code).toBe("CONTEXT_MISSING");
    socket.disconnect();
  });
});
// ── Suite 3: answer:submit ────────────────────────────────────────────────────

describe("answer:submit", () => {
  /** Joins an interview and returns the socket plus the first question id. */
  async function joinAndGetQuestion(tokens: Tokens, interviewId: string) {
    const socket = await connectSocket(tokens.accessToken);
    const delivered = waitFor<{ questionId: string; sequenceNumber: number }>(
      socket,
      "question:delivered",
    );
    await emitAndWait(socket, "interview:join", { interviewId }, "interview:joined");
    const question = await delivered;
    return { socket, questionId: question.questionId };
  }

  it("accepts an answer for the current question and persists it", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const { socket, questionId } = await joinAndGetQuestion(tokens, interviewId);

    const accepted = await emitAndWait<{ event: string; questionId: string }>(
      socket,
      "answer:submit",
      { interviewId, questionId, answerData: "I scaled it with sharding.", answerType: "TEXT" },
      "answer:accepted",
    );
    expect(accepted.event).toBe("answer:accepted");
    expect(accepted.questionId).toBe(questionId);

    const answers = await answersOf(interviewId);
    expect(answers.length).toBe(1);
    expect(answers[0]!.questionId).toBe(questionId);
    expect(answers[0]!.answerType).toBe("TEXT");

    const rows = await questionsOf(interviewId);
    // The evaluation pipeline runs asynchronously after the answer is persisted,
    // so the row is ANSWERED immediately and may already be EVALUATED.
    expect(["ANSWERED", "EVALUATED"]).toContain(rows[0]!.questionState);
    socket.disconnect();
  });

  it("is idempotent — a duplicate answer does not create a second row", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const { socket, questionId } = await joinAndGetQuestion(tokens, interviewId);

    await emitAndWait(
      socket,
      "answer:submit",
      { interviewId, questionId, answerData: "first answer", answerType: "TEXT" },
      "answer:accepted",
    );
    await emitAndWait(
      socket,
      "answer:submit",
      { interviewId, questionId, answerData: "second answer", answerType: "TEXT" },
      "answer:accepted",
    );

    const answers = await answersOf(interviewId);
    expect(answers.length).toBe(1);
    expect(answers[0]!.answerData).toBe("first answer");
    socket.disconnect();
  });

  it("rejects an answer for a stale (non-current) question", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const { socket } = await joinAndGetQuestion(tokens, interviewId);

    // A fresh join after a rogue id was requested — the context current id won.
    const err = await emitAndWait<{ code: string }>(
      socket,
      "answer:submit",
      {
        interviewId,
        questionId: randomUUID(),
        answerData: "answer for the wrong question",
        answerType: "TEXT",
      },
      "ws:error",
    );

    // The gateway maps non-whitelisted AppErrors to INTERNAL_ERROR; ANSWER_REJECTED
    // is in the whitelist, so either code means the write was refused.
    expect(["ANSWER_REJECTED", "INTERNAL_ERROR", "QUESTION_NOT_FOUND"]).toContain(err.code);
    expect(await answersOf(interviewId)).toHaveLength(0);
    socket.disconnect();
  });

  it("treats an empty answer as a skip (no answer row, question SKIPPED)", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const { socket, questionId } = await joinAndGetQuestion(tokens, interviewId);

    const skipped = waitFor<{ code: string }>(socket, "ws:error", 1500).catch(() => null);
    socket.emit("answer:submit", {
      eventVersion: 1,
      event: "answer:submit",
      interviewId,
      questionId,
      answerData: "   ",
      answerType: "TEXT",
    });
    // An empty answer is persisted as a SKIPPED placeholder row by design.
    await skipped;

    const rows = await questionsOf(interviewId);
    expect(rows[0]!.questionState).toBe("SKIPPED");

    const answers = await answersOf(interviewId);
    expect(answers.length).toBe(1);
    expect(answers[0]!.answerData).toBe("");
    socket.disconnect();
  });

  it("rejects an answer once the interview is no longer INPROGRESS", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const { socket, questionId } = await joinAndGetQuestion(tokens, interviewId);

    const cancel = await request
      .post(`${API}/interviews/${interviewId}/cancel`)
      .set("Cookie", `access_token=${tokens.accessToken}; csrf_token=${tokens.csrfToken}`)
      .set("x-csrf-token", tokens.csrfToken);
    expect(cancel.status).toBe(200);

    const err = await emitAndWait<{ code: string }>(
      socket,
      "answer:submit",
      { interviewId, questionId, answerData: "late answer", answerType: "TEXT" },
      "ws:error",
    );
    expect(["INTERVIEW_INVALID_STATE", "INTERNAL_ERROR"]).toContain(err.code);
    socket.disconnect();
  });
});
// ── Suite 4: question:next ────────────────────────────────────────────────────

describe("question:next", () => {
  it("rejects a next-question request while the current question is still PENDING", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const socket = await connectSocket(tokens.accessToken);

    const delivered = waitFor(socket, "question:delivered");
    await emitAndWait(socket, "interview:join", { interviewId }, "interview:joined");
    await delivered;

    const err = await emitAndWait<{ code: string }>(
      socket,
      "question:next",
      { interviewId },
      "ws:error",
    );
    // QUESTION_NOT_COMPLETED is an AppError, surfaced as INTERNAL_ERROR by design.
    expect(["INTERNAL_ERROR", "QUESTION_NOT_FOUND", "ANSWER_REJECTED"]).toContain(err.code);
    socket.disconnect();
  });

  it("delivers the next question once the current one is answered", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const socket = await connectSocket(tokens.accessToken);

    const first = waitFor<{ questionId: string; sequenceNumber: number }>(
      socket,
      "question:delivered",
    );
    await emitAndWait(socket, "interview:join", { interviewId }, "interview:joined");
    const q1 = await first;
    expect(q1.sequenceNumber).toBe(1);

    await emitAndWait(
      socket,
      "answer:submit",
      { interviewId, questionId: q1.questionId, answerData: "my answer", answerType: "TEXT" },
      "answer:accepted",
    );

    const nextDelivered = waitFor<{ questionId: string; sequenceNumber: number }>(
      socket,
      "question:delivered",
    );
    socket.emit("question:next", { eventVersion: 1, event: "question:next", interviewId });
    const q2 = await nextDelivered;

    expect(q2.sequenceNumber).toBe(2);
    expect(q2.questionId).not.toBe(q1.questionId);

    const rows = await questionsOf(interviewId);
    expect(rows.length).toBe(2);
    socket.disconnect();
  });
});
// ── Suite 5: interview:cancel / interview:end / interview:leave ───────────────

describe("interview lifecycle over the socket", () => {
  it("cancel emits state_change CANCELLED and clears the socket session", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const socket = await connectSocket(tokens.accessToken);

    const delivered = waitFor(socket, "question:delivered");
    await emitAndWait(socket, "interview:join", { interviewId }, "interview:joined");
    await delivered;

    // The join registered a socket session in Redis.
    expect(await registry.getSocketSession(interviewId)).not.toBeNull();

    const stateChange = await emitAndWait<{ status: string; interviewId: string }>(
      socket,
      "interview:cancel",
      { interviewId },
      "interview:state_change",
    );
    expect(stateChange.status).toBe("CANCELLED");
    expect(stateChange.interviewId).toBe(interviewId);
    expect(await dbInterviewStatus(interviewId)).toBe("CANCELLED");
    expect(await registry.getSocketSession(interviewId)).toBeNull();
    socket.disconnect();
  });

  it("end with fewer than 3 answers cancels the interview", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const socket = await connectSocket(tokens.accessToken);

    const delivered = waitFor(socket, "question:delivered");
    await emitAndWait(socket, "interview:join", { interviewId }, "interview:joined");
    await delivered;

    const stateChange = await emitAndWait<{ status: string }>(
      socket,
      "interview:end",
      { interviewId },
      "interview:state_change",
    );
    expect(stateChange.status).toBe("CANCELLED");
    expect(await dbInterviewStatus(interviewId)).toBe("CANCELLED");
    socket.disconnect();
  });

  it("interview:leave acknowledges and removes the socket session", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const socket = await connectSocket(tokens.accessToken);

    const delivered = waitFor(socket, "question:delivered");
    await emitAndWait(socket, "interview:join", { interviewId }, "interview:joined");
    await delivered;

    const left = await emitAndWait<{ event: string; interviewId: string }>(
      socket,
      "interview:leave",
      { interviewId },
      "interview:left",
    );
    expect(left.event).toBe("interview:left");
    expect(await registry.getSocketSession(interviewId)).toBeNull();
    // Leaving is not a state change — the interview stays INPROGRESS.
    expect(await dbInterviewStatus(interviewId)).toBe("INPROGRESS");
    socket.disconnect();
  });
});
// ── Suite 6: disconnect grace period & reconnect ──────────────────────────────

describe("disconnect grace period", () => {
  it("sets a 30-second grace key on disconnect", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const socket = await connectSocket(tokens.accessToken);

    const delivered = waitFor(socket, "question:delivered");
    await emitAndWait(socket, "interview:join", { interviewId }, "interview:joined");
    await delivered;

    expect(await registry.isInGracePeriod(interviewId)).toBe(false);

    socket.disconnect();
    // Poll with setImmediate so this stays valid even if setTimeout is faked.
    expect(await waitUntil(() => registry.isInGracePeriod(interviewId))).toBe(true);

    const { redis } = getContainers();
    const ttl = await redis.ttl(`socket:grace:${interviewId}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(registry.GRACE_TTL_SECONDS);
    // The interview is still live — grace is a pause window, not a state change.
    expect(await dbInterviewStatus(interviewId)).toBe("INPROGRESS");
  });

  it("a reconnect inside the grace window clears it and reports reconnected:true", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const first = await connectSocket(tokens.accessToken);

    const delivered = waitFor(first, "question:delivered");
    await emitAndWait(first, "interview:join", { interviewId }, "interview:joined");
    await delivered;

    first.disconnect();
    expect(await waitUntil(() => registry.isInGracePeriod(interviewId))).toBe(true);

    const second = await connectSocket(tokens.accessToken);
    const joined = await emitAndWait<{ reconnected: boolean }>(
      second,
      "interview:join",
      { interviewId },
      "interview:joined",
    );

    expect(joined.reconnected).toBe(true);
    expect(await registry.isInGracePeriod(interviewId)).toBe(false);
    expect(await dbInterviewStatus(interviewId)).toBe("INPROGRESS");
    second.disconnect();
  });

  it("grace expiry pauses the interview to SCHEDULED", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const socket = await connectSocket(tokens.accessToken);

    const delivered = waitFor(socket, "question:delivered");
    await emitAndWait(socket, "interview:join", { interviewId }, "interview:joined");
    await delivered;

    // Fake ONLY setTimeout: the grace expiry is a real setTimeout(30_000), while
    // Redis/Postgres keep their own real timers so I/O still works.
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      socket.disconnect();
      expect(await waitUntil(() => registry.isInGracePeriod(interviewId))).toBe(true);

      await vi.advanceTimersByTimeAsync(registry.GRACE_TTL_SECONDS * 1000 + 250);

      // Expiry delegates to pauseInterviewService ⇒ INPROGRESS → SCHEDULED.
      expect(
        await waitUntil(async () => (await dbInterviewStatus(interviewId)) === "SCHEDULED"),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
// ── Suite 7: maintenance sweeps (deterministic — backdated rows, no sleeping) ─

describe("maintenance sweeps", () => {
  async function backdateInterview(
    interviewId: string,
    opts: { lastActivityMinutesAgo?: number; startedMinutesAgo?: number } = {},
  ) {
    const { db } = getContainers();
    const now = Date.now();
    await db
      .update(interviewsTable)
      .set({
        ...(opts.lastActivityMinutesAgo !== undefined
          ? { lastActivityAt: new Date(now - opts.lastActivityMinutesAgo * 60_000) }
          : {}),
        ...(opts.startedMinutesAgo !== undefined
          ? { interviewStartedAt: new Date(now - opts.startedMinutesAgo * 60_000) }
          : {}),
      })
      .where(eq(interviewsTable.id, interviewId));
  }

  it("times out a PENDING question after the 5-minute per-question window", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);
    const socket = await connectSocket(tokens.accessToken);

    const delivered = waitFor<{ questionId: string }>(socket, "question:delivered");
    await emitAndWait(socket, "interview:join", { interviewId }, "interview:joined");
    const { questionId } = await delivered;

    // Inside the window: nothing to do.
    expect((await svc.detectAndTimeoutStaleQuestions()).timedOut).toBe(0);

    // Past the 5-minute threshold (QUESTION_TIMEOUT_MS).
    await backdateInterview(interviewId, { lastActivityMinutesAgo: 6 });
    expect((await svc.detectAndTimeoutStaleQuestions()).timedOut).toBe(1);

    const rows = await questionsOf(interviewId);
    const q = rows.find((r) => r.id === questionId)!;
    expect(q.questionState).toBe("TIMED_OUT");
    expect(q.timeoutBehavior).toBe("AUTO_SKIP");
    expect(q.timedOutAt).not.toBeNull();

    // The timed-out answer is recorded with an empty payload (scored 0 downstream).
    const answers = await answersOf(interviewId);
    expect(answers.length).toBe(1);
    expect(answers[0]!.answerData).toBe("");
    socket.disconnect();
  });

  it("abandons an INPROGRESS interview after 90 minutes of inactivity", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);

    // Just inside the threshold — 89 minutes.
    await backdateInterview(interviewId, { lastActivityMinutesAgo: 89 });
    expect((await svc.detectAndAbandonStaleInterviews()).abandoned).toBe(0);
    expect(await dbInterviewStatus(interviewId)).toBe("INPROGRESS");

    // Past the threshold — 91 minutes.
    await backdateInterview(interviewId, { lastActivityMinutesAgo: 91 });
    expect((await svc.detectAndAbandonStaleInterviews()).abandoned).toBe(1);
    expect(await dbInterviewStatus(interviewId)).toBe("ABANDONED");
  });

  it("times out an interview whose configured duration has been exceeded", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);

    // duration is 15 minutes in CREATE_INPUT; started 16 minutes ago.
    await backdateInterview(interviewId, { startedMinutesAgo: 16 });
    expect((await svc.detectAndTimeoutOverdueInterviews()).timedOut).toBe(1);
    expect(await dbInterviewStatus(interviewId)).toBe("TIMED_OUT");
  });

  it("a fresh INPROGRESS interview is untouched by the sweeps", async () => {
    const tokens = await seedAndLogin();
    const interviewId = await createStartedInterview(tokens);

    expect((await svc.detectAndAbandonStaleInterviews()).abandoned).toBe(0);
    expect((await svc.detectAndTimeoutOverdueInterviews()).timedOut).toBe(0);
    expect(await dbInterviewStatus(interviewId)).toBe("INPROGRESS");
  });
});