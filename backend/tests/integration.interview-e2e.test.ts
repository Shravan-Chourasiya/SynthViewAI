/**
 * integration.interview-e2e.test.ts
 * End-to-end interview journey over the real stack:
 *   register → verify OTP → login → create interview → start → join over
 *   WebSocket → answer several questions (advancing with question:next) →
 *   end the interview → fetch history + report.
 *
 * Runs against real Postgres + Redis testcontainers and a real Socket.IO
 * server, with the mail service mocked to capture the OTP and the AI provider chain
 * mocked so no LLM call is made. Asserts on both the persisted DB state and the
 * WebSocket event sequence observed by the client.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { setup, teardown, resetDb, resetRedis, getContainers } from "./helpers/containers.js";
import { interviewsTable } from "../src/modules/interview/schemas/interview.schema.js";
import { interviewQuestionsTable } from "../src/modules/interview/schemas/question.schema.js";
import { interviewAnswersTable } from "../src/modules/interview/schemas/answers.schema.js";
import { interviewResultsTable } from "../src/modules/interview/schemas/result.schema.js";

// Capture the OTP that the register flow "emails".
let capturedOtp = "";

// ── AI provider stubs (Groq/Mistral chain is never touched) ───────────────────

vi.mock("../src/integrations/ai/index.js", () => ({
  startAiSession: async () => ({ threadId: "thread-e2e" }),
  generateNextQuestion: async () => ({
    question: {
      questionTitle: "Walk me through a system you designed",
      questionDescription: null,
      questionType: "TECHNICAL",
      topic: "system-design",
    },
  }),
  evaluateAnswer: async () => ({
    score: 82,
    correctness: 84,
    relevance: 80,
    clarity: 86,
    technicalDepth: 78,
    feedback: "Clear and structured.",
    strengths: ["structure", "trade-offs"],
    weaknesses: ["depth on failure modes"],
    detectionSignals: ["strong"],
  }),
  endAiSession: async () => {},
}));

let request: ReturnType<typeof import("supertest").default>;
let httpServer: HttpServer;
let baseUrl: string;
let client: ClientSocket | null = null;

const API = "/v1";
const CSRF = "e2e-int-csrf-" + randomUUID();
/** Answered questions needed before endInterviewService marks COMPLETED. */
const ANSWER_COUNT = 4;

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
      PORT: 4004,
      API_VERSION: "v1",
      JWT_SECRET: "a".repeat(64),
      CORS_ORIGIN: ["http://localhost:3000"],
      COOKIE_DOMAIN: undefined,
      LOG_LEVEL: "silent",
      APP_VERSION: "1.0.0",
    },
  }));

  // Intercept the mail service so the real OTP is captured, not emailed.
  // The factory covers every export the app imports at load time.
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
}, 180_000);

afterAll(async () => {
  client?.disconnect();
  if (httpServer) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await teardown();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCookie(cookies: string[] | undefined, name: string): string | undefined {
  return cookies
    ?.find((c) => c.startsWith(`${name}=`))
    ?.split(";")[0]
    ?.split("=")[1];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls an async predicate until true or the budget runs out. */
async function waitUntil(
  predicate: () => Promise<boolean>,
  attempts = 60,
  delayMs = 100,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await predicate()) return true;
    await sleep(delayMs);
  }
  return false;
}

function connectSocket(accessToken: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: { Cookie: `access_token=${accessToken}` },
    });
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

function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 10_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function authed(accessToken: string, csrfToken: string) {
  const decorate = (req: { set: (k: string, v: string) => unknown }) =>
    req
      .set("Cookie", `access_token=${accessToken}; csrf_token=${csrfToken}`)
      .set("x-csrf-token", csrfToken);
  return {
    get: (url: string) => decorate(request.get(url)),
    post: (url: string) => decorate(request.post(url)),
  };
}

function db() {
  return getContainers().db;
}
// ── The journey ───────────────────────────────────────────────────────────────

describe("Interview journey end-to-end", () => {
  it("register → login → create → WebSocket answers → complete → history + report", async () => {
    await resetDb();
    await resetRedis();

    const email = `e2e-int-${randomUUID()}@example.com`;
    const password = "E2eIntPass1";
    const username = `e2eint_${randomUUID().slice(0, 8)}`;

    // ── 1. Register ──────────────────────────────────────────────────────────
    const register = await request
      .post(`${API}/auth/register`)
      .set("Cookie", `csrf_token=${CSRF}`)
      .set("x-csrf-token", CSRF)
      .send({ email, password, username });
    // registerUserController responds 201 CREATED.
    expect(register.status).toBe(201);
    expect(register.body.success).toBe(true);

    // ── 2. Verify the emailed OTP ────────────────────────────────────────────
    expect(capturedOtp).toMatch(/^\d{6}$/);
    const verify = await request
      .post(`${API}/auth/verify-otp`)
      .set("Cookie", `csrf_token=${CSRF}`)
      .set("x-csrf-token", CSRF)
      .send({ email, otp: capturedOtp });
    expect(verify.status).toBe(200);

    // ── 3. Login ─────────────────────────────────────────────────────────────
    const login = await request
      .post(`${API}/auth/login`)
      .set("Cookie", `csrf_token=${CSRF}`)
      .set("x-csrf-token", CSRF)
      .send({ email, password });
    expect(login.status).toBe(200);
    const cookies = login.headers["set-cookie"] as unknown as string[];
    const accessToken = extractCookie(cookies, "access_token");
    const csrfToken = extractCookie(cookies, "csrf_token") ?? CSRF;
    expect(accessToken).toBeTruthy();

    // ── 4. Create a MIXED interview ──────────────────────────────────────────
    const create = await authed(accessToken!, csrfToken)
      .post(`${API}/interviews`)
      .send({
        jobrole: "Backend Engineer",
        experience: "mid-level",
        difficulty: "MEDIUM",
        isAdaptive: false,
        interviewStyle: "REGULAR",
        interviewType: "MIXED",
        duration: 20,
        maxFollowUps: 2,
        isScheduled: false,
        endingCriteria: "DURATION",
      });
    expect(create.status).toBe(200);
    const interviewId = (create.body as { data: { id: string } }).data.id;
    expect(interviewId).toBeTruthy();

    // ── 5. Start it ──────────────────────────────────────────────────────────
    const start = await authed(accessToken!, csrfToken).post(
      `${API}/interviews/${interviewId}/start`,
    );
    expect(start.status).toBe(200);

    // ── 6. Join over WebSocket and record the event sequence ─────────────────
    const socket = await connectSocket(accessToken!);
    client = socket;

    const sequence: string[] = [];
    for (const event of [
      "interview:joined",
      "question:delivered",
      "answer:accepted",
      "evaluation:feedback",
      "interview:state_change",
      "ws:error",
    ]) {
      socket.on(event, () => sequence.push(event));
    }

    const joinedPayload = waitFor<{ reconnected: boolean; durationMinutes: number }>(
      socket,
      "interview:joined",
    );
    const firstQuestionPayload = waitFor<{ questionId: string; sequenceNumber: number }>(
      socket,
      "question:delivered",
    );
    socket.emit("interview:join", { eventVersion: 1, event: "interview:join", interviewId });
    const joined = await joinedPayload;
    const firstQuestion = await firstQuestionPayload;

    expect(joined.reconnected).toBe(false);
    expect(joined.durationMinutes).toBe(20);
    expect(firstQuestion.sequenceNumber).toBe(1);

    // ── 7. Answer N questions, advancing with question:next ──────────────────
    let currentQuestionId = firstQuestion.questionId;

    for (let index = 1; index <= ANSWER_COUNT; index++) {
      const acceptedPayload = waitFor<{ questionId: string }>(socket, "answer:accepted");
      socket.emit("answer:submit", {
        eventVersion: 1,
        event: "answer:submit",
        interviewId,
        questionId: currentQuestionId,
        answerData: `Answer ${index}: I designed a queue-backed ingestion pipeline.`,
        answerType: "TEXT",
      });
      const accepted = await acceptedPayload;
      expect(accepted.questionId).toBe(currentQuestionId);

      if (index < ANSWER_COUNT) {
        const delivered = waitFor<{ questionId: string; sequenceNumber: number }>(
          socket,
          "question:delivered",
        );
        socket.emit("question:next", { eventVersion: 1, event: "question:next", interviewId });
        const next = await delivered;
        expect(next.sequenceNumber).toBe(index + 1);
        currentQuestionId = next.questionId;
      }
    }

    expect(sequence).not.toContain("ws:error");

    // ── 8. End the interview ─────────────────────────────────────────────────
    const stateChangePayload = waitFor<{ status: string }>(socket, "interview:state_change");
    socket.emit("interview:end", { eventVersion: 1, event: "interview:end", interviewId });
    const stateChange = await stateChangePayload;
    expect(stateChange.status).toBe("COMPLETED");
// ── 9. Assert the persisted DB state ─────────────────────────────────────
    const database = db();
    const [interviewRow] = await database
      .select()
      .from(interviewsTable)
      .where(eq(interviewsTable.id, interviewId))
      .limit(1);
    expect(interviewRow!.interviewStatus).toBe("COMPLETED");
    expect(interviewRow!.interviewStartedAt).not.toBeNull();

    const questionRows = await database
      .select()
      .from(interviewQuestionsTable)
      .where(eq(interviewQuestionsTable.interviewId, interviewId))
      .orderBy(interviewQuestionsTable.sequenceNumber);
    expect(questionRows.length).toBe(ANSWER_COUNT);
    expect(questionRows.map((q) => q.sequenceNumber)).toEqual(
      Array.from({ length: ANSWER_COUNT }, (_, i) => i + 1),
    );
    // Every question reached a completed state (evaluation is async).
    expect(
      questionRows.every(
        (q) => q.questionState === "ANSWERED" || q.questionState === "EVALUATED",
      ),
    ).toBe(true);

    const answerRows = await database
      .select()
      .from(interviewAnswersTable)
      .where(eq(interviewAnswersTable.interviewId, interviewId));
    expect(answerRows.length).toBe(ANSWER_COUNT);

    // ── 10. The async evaluation pipeline lands ──────────────────────────────
    expect(
      await waitUntil(async () => {
        const rows = await database
          .select()
          .from(interviewAnswersTable)
          .where(eq(interviewAnswersTable.interviewId, interviewId));
        return rows.every((r) => r.evaluationData !== null);
      }),
    ).toBe(true);

    // ── 11. History ──────────────────────────────────────────────────────────
    const history = await authed(accessToken!, csrfToken).get(
      `${API}/interviews/${interviewId}/history`,
    );
    expect(history.status).toBe(200);
    expect(history.body.data.interviewId).toBe(interviewId);
    expect(history.body.data.interviewStatus).toBe("COMPLETED");
    expect(history.body.data.questions.length).toBe(ANSWER_COUNT);

    // ─ 12. Report ───────────────────────────────────────────────────────────
    expect(
      await waitUntil(async () => {
        const [row] = await database
          .select()
          .from(interviewResultsTable)
          .where(eq(interviewResultsTable.interviewId, interviewId))
          .limit(1);
        return Boolean(row);
      }),
    ).toBe(true);

    const report = await authed(accessToken!, csrfToken).get(
      `${API}/interviews/${interviewId}/report`,
    );
    expect(report.status).toBe(200);
    expect(report.body.data).toBeTruthy();
    expect(report.body.data.interviewId).toBe(interviewId);

    // ── 13. The observed WebSocket sequence is coherent ──────────────────────
    expect(sequence[0]).toBe("interview:joined");
    expect(sequence.filter((e) => e === "question:delivered").length).toBe(ANSWER_COUNT);
    expect(sequence.filter((e) => e === "answer:accepted").length).toBe(ANSWER_COUNT);
    expect(sequence.indexOf("interview:joined")).toBeLessThan(
      sequence.indexOf("question:delivered"),
    );
    expect(sequence.indexOf("question:delivered")).toBeLessThan(
      sequence.indexOf("answer:accepted"),
    );
    expect(sequence[sequence.length - 1]).toBe("interview:state_change");

    socket.disconnect();
    client = null;
  }, 120_000);
});
