/**
 * Lean root-level suite — shared harness for the backend half.
 *
 * Reuses the existing container helpers (`backend/tests/helpers/containers.ts`)
 * and the existing env stubs (`backend/tests/setup.ts`) rather than duplicating
 * setup logic. Two mechanics are worth knowing before reading a test:
 *
 * 1. Only the *edges* are faked. Postgres, Redis, sessions, ownership, CSRF and
 *    every route/service under test runs for real against Testcontainers — the
 *    only mocks are the ones that would otherwise leave the process: the DB and
 *    Redis singletons are pointed at the containers, the mailer is stubbed (and
 *    records the OTP it would have emailed, so the real verification flow can
 *    still be driven), and — for interview routes — the AI integration is
 *    stubbed because it is a paid third-party call.
 *
 * 2. `vi.doMock` + dynamic `import()` must happen in this order: mocks first,
 *    app second. Each test file boots its own server in `beforeAll`, and the
 *    vitest config keeps `isolate` at its default so the module registry is
 *    fresh per file — otherwise file two would reuse file one's `app.js` and
 *    silently talk to a torn-down container.
 */
import { vi } from "vitest";
import supertest from "supertest";
import { randomUUID } from "node:crypto";
import {
  setup,
  teardown,
  resetDb,
  resetRedis,
  type TestContainers,
} from "../../backend/tests/helpers/containers.js";

export type { TestContainers };

const CSRF = "lean-suite-csrf";

export interface OtpRecord {
  email: string;
  otp: string;
}

const otpInbox: OtpRecord[] = [];

export function clearOtpInbox(): void {
  otpInbox.length = 0;
}

export function lastOtpFor(email: string): string | undefined {
  for (let i = otpInbox.length - 1; i >= 0; i -= 1) {
    if (otpInbox[i]!.email === email) return otpInbox[i]!.otp;
  }
  return undefined;
}

export interface TestServer {
  /** The Express app under test. */
  app: Parameters<typeof supertest>[0];
  /** Cookie-less agent for unauthenticated requests. */
  anon: supertest.Agent;
  containers: TestContainers;
  /** Mount prefix, e.g. `/v1` — read from the app's own env instead of guessing. */
  api: string;
  /** Raw SQL against the container, for fixture assertions. */
  query: <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
}

export interface Session {
  api: string;
  /** Cookie-less agent, used with the cookies captured at login. */
  anon: supertest.Agent;
  /** Serialized `name=value; name=value` pair set from the login response. */
  cookie: string;
  csrf: string;
  email: string;
  password: string;
  userId: string;
}

export interface BootOptions {
  /** Stub `integrations/ai` (paid third-party call). */
  mockAi?: boolean;
}

const noop = async (): Promise<void> => undefined;

function aiStub() {
  return {
    startAiSession: async () => ({ threadId: randomUUID() }),
    generateNextQuestion: async (input: { sequenceNumber?: number }) => ({
      question: {
        questionTitle: `Lean suite question ${input?.sequenceNumber ?? 1}`,
        questionDescription: "Deterministic question produced by the lean suite AI stub.",
        questionType: "TECHNICAL" as const,
      },
    }),
    evaluateAnswer: async () => ({
      score: 78,
      correctness: 80,
      relevance: 75,
      clarity: 82,
      technicalDepth: 70,
      feedback: "Lean suite stub evaluation.",
      strengths: ["clear structure"],
      weaknesses: ["more concrete examples would help"],
      detectionSignals: ["strong" as const],
    }),
    endAiSession: noop,
  };
}

export async function bootTestServer(options: BootOptions = {}): Promise<TestServer> {
  const containers = await setup();

  vi.doMock("../../backend/src/db/postgres.init.js", () => ({
    default: () => containers.db,
    getPgDb: () => containers.db,
    getPgPool: () => containers.pool,
  }));

  vi.doMock("../../backend/src/config/redis.init.js", () => ({
    redisClient: containers.redis,
  }));

  vi.doMock("../../backend/src/services/nodemailer.service.js", () => ({
    verifyMailTransporter: async () => true,
    sendInBackground: (task: () => Promise<void>) => void task().catch(() => undefined),
    sendOtpMail: async (email: string, otp: string) => {
      otpInbox.push({ email, otp });
    },
    sendWelcomeMail: noop,
    sendNewLoginAlertMail: noop,
    sendCredentialUpdatedMail: noop,
    sendAccountSuspendedMail: noop,
    sendAccountDeletedMail: noop,
    sendInterviewReminderMail: noop,
    sendInterviewCancelledMail: noop,
    sendPausedInterviewReminderMail: noop,
  }));

  if (options.mockAi) {
    vi.doMock("../../backend/src/integrations/ai/index.js", aiStub);
  }

  const { default: app } = await import("../../backend/src/app.js");
  const { env } = await import("../../backend/src/config/env.js");

  const query = async <T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> => {
    const result = await containers.pool.query(sql, params);
    return result.rows as T[];
  };

  return {
    app,
    anon: supertest(app),
    containers,
    api: `/${env.API_VERSION}`,
    query,
  };
}

export async function stopTestServer(): Promise<void> {
  otpInbox.length = 0;
  await teardown();
}

/** Truncate user data and flush Redis so each test starts from a known state. */
export async function resetState(): Promise<void> {
  otpInbox.length = 0;
  await resetDb();
  await resetRedis();
}

// ── Request helpers ───────────────────────────────────────────────────────────
// Every request carries a unique `x-client-id`, which the rate limiter uses as
// its key (see `createRateLimiter`). That gives each test an isolated bucket, so
// a suite that logs in a dozen times is never throttled by — and never has to
// assert around — the production limits.

let clientCounter = 0;

function nextClientId(): string {
  clientCounter += 1;
  return `lean-${process.pid}-${clientCounter}`;
}

type Method = "get" | "post" | "patch" | "put" | "delete";

export function anonRequest(
  server: TestServer,
  method: Method,
  path: string,
): supertest.Test {
  return server.anon[method](`${server.api}${path}`)
    .set("Cookie", `csrf_token=${CSRF}`)
    .set("x-csrf-token", CSRF)
    .set("x-client-id", nextClientId());
}

export function request(session: Session, method: Method, path: string): supertest.Test {
  return session.anon[method](`${session.api}${path}`)
    .set("Cookie", session.cookie)
    .set("x-csrf-token", session.csrf)
    .set("x-client-id", nextClientId());
}

/**
 * Cookies are carried by hand rather than through supertest's cookie jar.
 *
 * The auth cookies are `secure: process.env.NODE_ENV !== "development"` (see
 * `constants/auth.constants.ts`), so under NODE_ENV=test they are marked
 * `Secure` — and a cookie jar correctly refuses to replay a Secure cookie over
 * plain http, which would make every authenticated test 401. Replaying the
 * `name=value` pairs verbatim keeps the tests honest about *what the server set*
 * while sidestepping browser transport rules that have nothing to do with the
 * behaviour under test.
 */
function cookieValue(raw: string[] | undefined, name: string): string | undefined {
  return raw?.find((c) => c.startsWith(`${name}=`))?.split(";")[0]?.split("=")[1];
}

export function cookiesFrom(res: supertest.Response): string {
  const raw = (res.headers["set-cookie"] ?? []) as unknown as string[];
  return raw.map((c) => c.split(";")[0]!).join("; ");
}

export interface Credentials {
  email: string;
  password: string;
  username: string;
  userId: string;
}

export function uniqueCredentials(prefix = "lean"): Credentials {
  const id = randomUUID().replaceAll("-", "").slice(0, 12);
  return {
    email: `${prefix}_${id}@example.com`,
    // Usernames are alphanumeric-only, so no dashes here.
    password: "LeanSuite1Pass",
    username: `${prefix}${id}`.slice(0, 30),
    userId: "",
  };
}

/**
 * Drives the real registration flow — register, read the OTP the stubbed
 * mailer received, verify — so fixtures exercise the same code path a user does
 * instead of inserting rows behind the API's back.
 */
export async function registerAndVerify(
  server: TestServer,
  creds: Credentials = uniqueCredentials(),
): Promise<Credentials> {
  const register = await anonRequest(server, "post", "/auth/register").send({
    email: creds.email,
    password: creds.password,
    username: creds.username,
  });
  if (register.status !== 201) {
    throw new Error(`register failed: ${register.status} ${JSON.stringify(register.body)}`);
  }

  const otp = lastOtpFor(creds.email);
  if (!otp) throw new Error(`no OTP was recorded for ${creds.email}`);

  const verify = await anonRequest(server, "post", "/auth/verify-otp").send({
    email: creds.email,
    otp,
  });
  if (verify.status !== 200) {
    throw new Error(`verify-otp failed: ${verify.status} ${JSON.stringify(verify.body)}`);
  }

  const [row] = await server.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [
    creds.email,
  ]);
  if (!row) throw new Error(`user row missing after verification: ${creds.email}`);

  return { ...creds, userId: row.id };
}

export async function login(
  server: TestServer,
  creds: Pick<Credentials, "email" | "password">,
): Promise<Session> {
  const res = await anonRequest(server, "post", "/auth/login").send({
    email: creds.email,
    password: creds.password,
    deviceType: "desktop",
  });

  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const raw = (res.headers["set-cookie"] ?? []) as unknown as string[];
  const csrf = cookieValue(raw, "csrf_token");
  if (!csrf) throw new Error("login response did not set a csrf_token cookie");

  const [row] = await server.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [
    creds.email,
  ]);

  return {
    api: server.api,
    anon: server.anon,
    cookie: cookiesFrom(res),
    csrf,
    email: creds.email,
    password: creds.password,
    userId: row!.id,
  };
}

/** register → verify → login, the full happy path every authed test needs. */
export async function createUser(
  server: TestServer,
  creds: Credentials = uniqueCredentials(),
): Promise<Session> {
  const verified = await registerAndVerify(server, creds);
  return login(server, verified);
}

/** Same as `createUser`, then promotes the row so admin routes accept it. */
export async function createAdmin(
  server: TestServer,
  role: "admin" | "moderator" = "admin",
): Promise<Session> {
  const creds = uniqueCredentials("leanadmin");
  const verified = await registerAndVerify(server, creds);
  await server.query("UPDATE users SET user_role = $2 WHERE id = $1", [verified.userId, role]);
  return login(server, verified);
}

export interface InterviewBody {
  jobrole: string;
  experience?: "fresher" | "junior" | "mid-level" | "senior";
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  interviewType?: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  duration?: number;
  [key: string]: unknown;
}

/** Creates an interview for `session` and returns the created row. */
export async function createInterview(
  session: Session,
  overrides: InterviewBody = { jobrole: "Backend Engineer" },
): Promise<Record<string, string>> {
  const res = await request(session, "post", "/interviews").send({
    difficulty: "MEDIUM",
    interviewType: "TECHNICAL",
    duration: 30,
    ...overrides,
  });
  if (res.status !== 200) {
    throw new Error(`create interview failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data as Record<string, string>;
}

/** Waits until the evaluation pipeline has scored a submitted answer. */
export async function waitForEvaluation(
  server: TestServer,
  questionId: string,
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [row] = await server.query<{ question_state: string }>(
      "SELECT question_state FROM interview_questions WHERE id = $1",
      [questionId],
    );
    if (row?.question_state === "EVALUATED") return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`question ${questionId} was never evaluated`);
}

/**
 * Plays an interview through `questions` answered turns.
 *
 * Uses the same service calls the socket gateway makes (`submitAnswerService`,
 * then `requestNextQuestionService` to advance) because the HTTP route alone
 * cannot move the session forward — advancing is a live-room action. Evaluation
 * is fire-and-forget inside the service, hence the polling.
 */
export async function playThrough(
  server: TestServer,
  session: Session,
  interviewId: string,
  questions = 3,
): Promise<void> {
  const { submitAnswerService, requestNextQuestionService } = await import(
    "../../backend/src/modules/interview/services/interview.service.js"
  );
  const authreq = { auth: { userId: session.userId } } as never;
  const io = { to: () => ({ emit: () => undefined }) } as never;

  for (let index = 0; index < questions; index += 1) {
    const questionId = await currentQuestionId(server, interviewId);
    await submitAnswerService(authreq, interviewId, {
      questionId,
      answerData: `Answer ${index + 1}: a detailed response that covers tradeoffs.`,
      answerType: "TEXT",
    });
    await waitForEvaluation(server, questionId);
    if (index < questions - 1) await requestNextQuestionService(interviewId, session.userId, io);
  }
}

/** The question the interview is currently waiting on, straight from Postgres. */
export async function currentQuestionId(
  server: TestServer,
  interviewId: string,
): Promise<string> {
  const [row] = await server.query<{ id: string }>(
    `SELECT id FROM interview_questions WHERE interview_id = $1
     ORDER BY sequence_number DESC LIMIT 1`,
    [interviewId],
  );
  if (!row) throw new Error(`no question row for interview ${interviewId}`);
  return row.id;
}
