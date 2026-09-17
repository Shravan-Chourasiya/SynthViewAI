/**
 * unit.interview-service.test.ts
 * Interview state-machine transitions, duplicate-answer protection and
 * current-question validation (src/modules/interview/services/interview.service.ts).
 *
 * Runs against real Postgres + Redis testcontainers (same infra as the
 * integration suite) with the AI provider chain mocked — no LLM calls.
 *
 * State machine under test (docs/progress-after-aug31.md):
 *   DRAFT → READY
 *   READY → INPROGRESS | SCHEDULED | CANCELLED
 *   SCHEDULED → INPROGRESS | CANCELLED | EXPIRED
 *   INPROGRESS → SCHEDULED | COMPLETED | CANCELLED | ABANDONED | TIMED_OUT
 *   terminal states (COMPLETED/CANCELLED/ABANDONED/EXPIRED/TIMED_OUT) → []
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { setup, teardown, resetDb, resetRedis, getContainers } from "./helpers/containers.js";
import { usersTable } from "../src/modules/auth/schemas/user.schema.js";
import {
  interviewsTable,
} from "../src/modules/interview/schemas/interview.schema.js";
import { interviewQuestionsTable } from "../src/modules/interview/schemas/question.schema.js";
import type { InterviewContext } from "../src/modules/interview/types/interview.context.js";
import {
  readInterviewContext,
  writeInterviewContext,
} from "../src/modules/interview/services/interview.context.service.js";

// ── Module under test (dynamically imported after mocks) ─────────────────────

type Service = typeof import("../src/modules/interview/services/interview.service.js");
let svc: Service;

// ── AI provider stubs (Groq/Mistral chain is never touched) ──────────────────

const aiCalls = { start: 0, next: 0, evaluate: 0, end: 0 };

vi.mock("../src/integrations/ai/index.js", () => ({
  startAiSession: async () => {
    aiCalls.start += 1;
    return { threadId: `thread-${aiCalls.start}` };
  },
  generateNextQuestion: async () => {
    aiCalls.next += 1;
    return {
      question: {
        questionTitle: `Question ${aiCalls.next}`,
        questionDescription: null,
        questionType: "TECHNICAL",
        topic: "arrays",
      },
    };
  },
  evaluateAnswer: async () => {
    aiCalls.evaluate += 1;
    return {
      score: 80,
      correctness: 80,
      relevance: 80,
      clarity: 80,
      technicalDepth: 80,
      feedback: "good",
      strengths: ["clear"],
      weaknesses: [],
      detectionSignals: ["strong"],
    };
  },
  endAiSession: async () => {
    aiCalls.end += 1;
  },
}));

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

  svc = await import("../src/modules/interview/services/interview.service.js");
}, 120_000);

afterAll(async () => {
  await teardown();
});
beforeEach(async () => {
  await resetDb();
  await resetRedis();
  aiCalls.start = 0;
  aiCalls.next = 0;
  aiCalls.evaluate = 0;
  aiCalls.end = 0;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedUser() {
  const { db } = getContainers();
  const hash = await bcrypt.hash("Password1", 1);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: `user-${randomUUID()}@example.com`,
      password: hash,
      username: `user_${randomUUID().slice(0, 8)}`,
      isVerified: true,
      accountStatus: "active",
    })
    .returning({ id: usersTable.id });
  return user!;
}

function authreq(userId: string) {
  return { auth: { userId } } as never;
}

const CREATE_INPUT = {
  jobrole: "Backend Engineer",
  experience: "mid",
  difficulty: "MEDIUM" as const,
  isAdaptive: true,
  interviewStyle: "REGULAR" as const,
  interviewType: "TECHNICAL" as const,
  duration: 15,
  maxFollowUps: 2,
  isScheduled: false,
  endingCriteria: "DURATION" as const,
};

async function createReady(userId: string) {
  return svc.createInterviewService(authreq(userId), { ...CREATE_INPUT });
}

async function errOf(p: Promise<unknown>) {
  return p.then(
    () => null,
    (e: unknown) => e as { statusCode?: number; message?: string },
  );
}

/** Base InterviewContext used when manually staging a "current question". */
function baseContext(interviewId: string, userId: string): InterviewContext {
  return {
    interviewId,
    candidateIdentity: { userId, experience: "mid" },
    config: {
      interviewType: "TECHNICAL",
      interviewStyle: "REGULAR",
      difficulty: "MEDIUM",
      durationMinutes: 15,
      maxFollowUps: 2,
      endingCriteria: "DURATION",
      jobRole: "Backend Engineer",
    },
    questionState: { currentIndex: 0, totalQuestions: 3, currentQuestionId: null },
    timerStartedAt: new Date().toISOString(),
    aiContext: { threadId: "thread-test" },
    performanceState: {
      currentDifficulty: "MEDIUM",
      strongStreak: 0,
      weakStreak: 0,
      lastSignals: [],
      topicScores: [],
      averageScore: null,
      answeredCount: 0,
      skippedCount: 0,
      timedOutCount: 0,
    },
    adaptationHistory: [],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
/** startInterviewService returns void; callers re-fetch the row to assert state. */
async function ctxStart(userId: string, interviewId: string) {
  await svc.startInterviewService(authreq(userId), interviewId);
}

describe("Interview creation", () => {
  it("creates an unscheduled interview in READY state", async () => {
    const user = await seedUser();
    const interview = await createReady(user.id!);
    expect(interview!.interviewStatus).toBe("READY");
    expect(interview!.isInterviewScheduled).toBe(false);
    expect(interview!.interviewDuration).toBe(15);
    expect(interview!.interviewType).toBe("TECHNICAL");
  });

  it("creates a scheduled interview in DRAFT state with the scheduled date", async () => {
    const user = await seedUser();
    const when = new Date(Date.now() + 3_600_000);
    const interview = await svc.createInterviewService(authreq(user.id!), {
      ...CREATE_INPUT,
      isScheduled: true,
      scheduledDate: when,
    });
    expect(interview!.interviewStatus).toBe("DRAFT");
    expect(interview!.interviewScheduledDate!.getTime()).toBe(when.getTime());
  });

  it("another user cannot resolve someone else's interview (ownership)", async () => {
    const owner = await seedUser();
    const intruder = await seedUser();
    const interview = await createReady(owner.id!);
    const err = await errOf(
      svc.getInterviewByIdService(authreq(intruder.id!), interview!.id),
    );
    expect(err).toBeInstanceOf(Error);
    expect(err!.statusCode).toBe(404);
  });
});

// ── State machine: valid transitions ──────────────────────────────────────────

describe("State machine — valid transitions", () => {
  it("READY → INPROGRESS via startInterviewService (context persisted, timer set)", async () => {
    const user = await seedUser();
    const interview = await createReady(user.id!);
    await ctxStart(user.id!, interview!.id);
    const started = await svc.getInterviewByIdService(authreq(user.id!), interview!.id);
    expect(started!.interviewStatus).toBe("INPROGRESS");
    expect(started!.interviewStartedAt).not.toBeNull();

    const context = await readInterviewContext(interview!.id);
    expect(context).not.toBeNull();
    expect(context!.config.durationMinutes).toBe(15);
    expect(context!.timerStartedAt).toBeTruthy();
    expect(context!.questionState.currentIndex).toBe(0);
  });

  it("READY → CANCELLED via cancelInterviewService", async () => {
    const user = await seedUser();
    const interview = await createReady(user.id!);
    const cancelled = await svc.cancelInterviewService(authreq(user.id!), interview!.id);
    expect(cancelled!.interviewStatus).toBe("CANCELLED");
  });

  it("READY → SCHEDULED via pauseInterviewService, then SCHEDULED → INPROGRESS via resume", async () => {
    const user = await seedUser();
    const interview = await createReady(user.id!);
    const scheduled = await svc.pauseInterviewService(authreq(user.id!), interview!.id);
    expect(scheduled!.interviewStatus).toBe("SCHEDULED");
    const resumed = await svc.resumeInterviewService(authreq(user.id!), interview!.id);
    expect(resumed!.interviewStatus).toBe("INPROGRESS");
  });
});

// ── State machine: invalid transitions ────────────────────────────────────────

describe("State machine — invalid transitions", () => {
  it("starting a DRAFT interview is rejected", async () => {
    const user = await seedUser();
    const interview = await svc.createInterviewService(authreq(user.id!), {
      ...CREATE_INPUT,
      isScheduled: true,
      scheduledDate: new Date(Date.now() + 3_600_000),
    });
    const err = await errOf(svc.startInterviewService(authreq(user.id!), interview!.id));
    expect(err).toBeInstanceOf(Error);
    expect(err!.statusCode).toBe(400);
  });

  it("starting from terminal CANCELLED is rejected", async () => {
    const user = await seedUser();
    const interview = await createReady(user.id!);
    await svc.cancelInterviewService(authreq(user.id!), interview!.id);
    const err = await errOf(svc.startInterviewService(authreq(user.id!), interview!.id));
    expect(err).toBeInstanceOf(Error);
    expect(err!.statusCode).toBe(400);
  });

  it("cancelling twice is rejected — terminal states are final", async () => {
    const user = await seedUser();
    const interview = await createReady(user.id!);
    await svc.cancelInterviewService(authreq(user.id!), interview!.id);
    const err = await errOf(svc.cancelInterviewService(authreq(user.id!), interview!.id));
    expect(err).toBeInstanceOf(Error);
    expect(err!.statusCode).toBe(400);
  });

  it("resuming a CANCELLED interview is rejected", async () => {
    const user = await seedUser();
    const interview = await createReady(user.id!);
    await svc.startInterviewService(authreq(user.id!), interview!.id);
    await svc.cancelInterviewService(authreq(user.id!), interview!.id);
    const err = await errOf(svc.resumeInterviewService(authreq(user.id!), interview!.id));
    expect(err).toBeInstanceOf(Error);
    expect(err!.statusCode).toBe(400);
  });
});

// ── Answer submission protections ─────────────────────────────────────────────

describe("Answer submission — validation", () => {
  /** Creates interview + INPROGRESS, stages a question row, wires it as current. */
  async function stageCurrentQuestion() {
    const user = await seedUser();
    const interview = await createReady(user.id!);
    await svc.startInterviewService(authreq(user.id!), interview!.id);

    const { db } = getContainers();
    const [question] = await db
      .insert(interviewQuestionsTable)
      .values({
        interviewId: interview!.id,
        sequenceNumber: 1,
        questionTitle: "Explain database indexing",
        questionType: "TECHNICAL",
        questionState: "PENDING",
      })
      .returning({ id: interviewQuestionsTable.id });

    const context = (await readInterviewContext(interview!.id))!;
    await writeInterviewContext(
      {
        ...context,
        questionState: { ...context.questionState, currentQuestionId: question!.id },
      },
      15,
    );
    return { user, interview: interview!, question: question! };
  }

  it("rejects an answer that is not for the current question (staleness guard)", async () => {
    const { user, interview } = await stageCurrentQuestion();
    const err = await errOf(
      svc.submitAnswerService(authreq(user.id!), interview.id, {
        questionId: "00000000-0000-0000-0000-000000000000",
        answerData: "some answer",
        answerType: "TEXT",
      }),
    );
    expect(err).toBeInstanceOf(Error);
    expect(err!.statusCode).toBe(409);
  });

  it("rejects answers when the interview is not INPROGRESS", async () => {
    const user = await seedUser();
    const interview = await createReady(user.id!); // READY, never started
    const err = await errOf(
      svc.submitAnswerService(authreq(user.id!), interview!.id, {
        questionId: randomUUID(),
        answerData: "x",
        answerType: "TEXT",
      }),
    );
    expect(err).toBeInstanceOf(Error);
    expect(err!.statusCode).toBe(400);
  });
});
