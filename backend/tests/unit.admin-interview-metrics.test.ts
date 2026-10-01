/**
 * Unit tests for the admin metrics projection.
 *
 * This module is a privacy boundary, not just a mapper: it is what lets an admin
 * see *how* a session was scored without seeing *what the candidate said*. The
 * tests below therefore spend most of their effort on what must be absent, and
 * they deliberately feed it rows that contain the forbidden fields — including
 * fields the row types don't declare — so that a future `.select()` that pulls
 * too much, or a `{ ...row }` spread in the shaping code, fails here rather than
 * in production.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import type { Request } from "express";
import {
  buildAdminInterviewMetrics,
  candidateReference,
  type MetricsAnswerRow,
  type MetricsInterviewRow,
  type MetricsQuestionRow,
  type MetricsResultRow,
} from "../src/modules/admin/services/interview-metrics.service.js";
import { requireRole } from "../src/middlewares/requireRole.middleware.js";
import { AppError } from "../src/utils/AppError.js";

// ── Sentinels ─────────────────────────────────────────────────────────────────
// Distinctive strings standing in for everything the admin view must never
// receive. If one of them appears anywhere in the output, the boundary leaked.

const SENTINEL = {
  answerText: "ANSWER-TEXT-SENTINEL",
  transcript: "TRANSCRIPT-SENTINEL",
  feedback: "EVALUATION-FEEDBACK-SENTINEL",
  strengths: "STRENGTH-SENTINEL",
  weaknesses: "WEAKNESS-SENTINEL",
  finalFeedback: "FINAL-FEEDBACK-SENTINEL",
  improvements: "SUGGESTED-IMPROVEMENTS-SENTINEL",
  candidateName: "CANDIDATE-NAME-SENTINEL",
  candidateEmail: "candidate-email-sentinel@example.com",
  notes: "SESSION-NOTES-SENTINEL",
  chat: "CHAT-HISTORY-SENTINEL",
  description: "DESCRIPTION-SENTINEL",
} as const;

const FORBIDDEN_VALUE = Object.values(SENTINEL);

const USER_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

/**
 * A "fat" row: everything the projection is allowed to read, plus the fields
 * that must never reach the client. Typed through `unknown` because the row
 * interfaces intentionally do not declare the forbidden fields — the query layer
 * is not supposed to produce them.
 */
function makeInterview(overrides: Partial<MetricsInterviewRow> = {}): MetricsInterviewRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: USER_ID,
    title: "Senior Backend Interview",
    status: "COMPLETED",
    type: "TECHNICAL",
    companyStyle: "FAANG",
    difficulty: "MEDIUM",
    durationMinutes: 30,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-01T10:31:00.000Z"),
    startedAt: new Date("2026-09-01T10:01:00.000Z"),
    meta: {
      jobRole: "Backend Engineer",
      domain: "Distributed systems",
      experience: "5-plus",
      jobSkills: ["Postgres", "Caching"],
      targetedCompany: "Stripe",
      isAdaptive: true,
      endingCriteria: "manual",
      questionCount: 6,
      // Neither of these belongs to the whitelist.
      notes: SENTINEL.notes,
      transcript: SENTINEL.transcript,
    },
    verdict: "PASS",
    ...overrides,
    // Forbidden fields, injected after the overrides so a test can never
    // accidentally overwrite them away.
    ...({
      userName: SENTINEL.candidateName,
      userEmail: SENTINEL.candidateEmail,
      description: SENTINEL.description,
      interviewOutcome: {
        finalVerdict: "PASS",
        finalFeedBack: SENTINEL.finalFeedback,
        suggestedImprovements: [SENTINEL.improvements],
      },
    } as unknown as Partial<MetricsInterviewRow>),
  } as unknown as MetricsInterviewRow;
}

function makeQuestion(overrides: Partial<MetricsQuestionRow> = {}): MetricsQuestionRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    sequenceNumber: 1,
    title: "Explain how a connection pool can become the bottleneck.",
    type: "TECHNICAL",
    difficulty: "MEDIUM",
    state: "EVALUATED",
    createdAt: new Date("2026-09-01T10:02:00.000Z"),
    ...overrides,
    ...({
      questionDescription: SENTINEL.answerText,
      chatHistory: [SENTINEL.chat],
    } as unknown as Partial<MetricsQuestionRow>),
  } as unknown as MetricsQuestionRow;
}

function makeAnswer(overrides: Partial<MetricsAnswerRow> = {}): MetricsAnswerRow {
  return {
    questionId: "22222222-2222-4222-8222-222222222222",
    answeredAt: new Date("2026-09-01T10:03:30.000Z"),
    timeTakenSeconds: 90,
    score: "7.5",
    correctness: "8",
    relevance: "7",
    clarity: "8",
    technicalDepth: "7",
    ...overrides,
    ...({
      answerData: SENTINEL.answerText,
      transcript: SENTINEL.transcript,
      evaluationData: {
        score: 7.5,
        feedback: SENTINEL.feedback,
        strengths: [SENTINEL.strengths],
        weaknesses: [SENTINEL.weaknesses],
      },
    } as unknown as Partial<MetricsAnswerRow>),
  } as unknown as MetricsAnswerRow;
}

function makeResult(overrides: Partial<MetricsResultRow> = {}): MetricsResultRow {
  return {
    overallScore: "78.50",
    technicalScore: "82.00",
    communicationScore: "74.00",
    problemSolvingScore: "80.00",
    confidenceScore: "70.00",
    questionsAnswered: 5,
    questionsSkipped: 1,
    questionsEvaluated: 5,
    totalDuration: 1_800,
    ...overrides,
    ...({
      feedback: SENTINEL.feedback,
      strengths: [SENTINEL.strengths],
      weaknesses: [SENTINEL.weaknesses],
    } as unknown as Partial<MetricsResultRow>),
  } as unknown as MetricsResultRow;
}

const build = (input?: {
  interview?: MetricsInterviewRow;
  questions?: MetricsQuestionRow[];
  answers?: MetricsAnswerRow[];
  result?: MetricsResultRow | null;
}) =>
  buildAdminInterviewMetrics({
    interview: input?.interview ?? makeInterview(),
    questions: input?.questions ?? [makeQuestion()],
    answers: input?.answers ?? [makeAnswer()],
    result: input?.result === undefined ? makeResult() : input.result,
  });

// ── The privacy promise ───────────────────────────────────────────────────────

describe("admin interview metrics — privacy boundary", () => {
  it("returns no answer text, evaluation feedback, transcript or candidate identity", () => {
    const serialized = JSON.stringify(build());

    for (const forbidden of FORBIDDEN_VALUE) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("does not carry the raw user id, nor its name or email fields", () => {
    const metrics = build();
    const serialized = JSON.stringify(metrics);

    expect(serialized).not.toContain(USER_ID);
    const sessionKeys = Object.keys(metrics.session);
    expect(sessionKeys).not.toContain("userId");
    expect(sessionKeys).not.toContain("userName");
    expect(sessionKeys).not.toContain("userEmail");
    expect(sessionKeys).not.toContain("email");
  });

  it("locks the response shape, so a new field has to be added on purpose", () => {
    const metrics = build();

    expect(Object.keys(metrics).sort()).toEqual([
      "aggregate",
      "categoryBreakdown",
      "difficultyProgression",
      "questions",
      "session",
    ]);

    expect(Object.keys(metrics.session).sort()).toEqual([
      "adaptive",
      "candidateRef",
      "companyStyle",
      "createdAt",
      "difficulty",
      "domain",
      "durationMinutes",
      "endingCriteria",
      "experienceLevel",
      "jobRole",
      "outcome",
      "questionTarget",
      "ref",
      "startedAt",
      "status",
      "targetedCompany",
      "title",
      "topics",
      "type",
      "updatedAt",
      "verdict",
    ]);

    expect(Object.keys(metrics.aggregate!).sort()).toEqual([
      "communicationScore",
      "confidenceScore",
      "overallScore",
      "problemSolvingScore",
      "questionsAnswered",
      "questionsEvaluated",
      "questionsSkipped",
      "technicalScore",
      "totalDurationSeconds",
    ]);

    expect(Object.keys(metrics.questions[0]!).sort()).toEqual([
      "difficulty",
      "score",
      "scores",
      "sequenceNumber",
      "state",
      "timeTakenSeconds",
      "title",
      "type",
    ]);

    expect(Object.keys(metrics.questions[0]!.scores).sort()).toEqual([
      "clarity",
      "correctness",
      "relevance",
      "technicalDepth",
    ]);
  });

  it("whitelists the metadata jsonb rather than passing it through", () => {
    const metrics = build();
    const serialized = JSON.stringify(metrics);

    // Unknown keys inside the configuration blob stay out, even though the blob
    // itself reached the shaping layer.
    expect(serialized).not.toContain("notes");
    expect(metrics.session.jobRole).toBe("Backend Engineer");
    expect(metrics.session.domain).toBe("Distributed systems");
    expect(metrics.session.topics).toEqual(["Postgres", "Caching"]);
  });
});

// ── Anonymized reference ──────────────────────────────────────────────────────

describe("candidateReference", () => {
  it("is stable for a user and shaped like a reference, not an identifier", () => {
    const first = candidateReference(USER_ID);
    expect(candidateReference(USER_ID)).toBe(first);
    expect(first).toMatch(/^C-[0-9A-F]{10}$/);
  });

  it("differs per candidate and reveals nothing about the raw id", () => {
    const other = "9c858901-8a57-4791-81fe-4c455b099bc9";
    expect(candidateReference(other)).not.toBe(candidateReference(USER_ID));
    expect(candidateReference(USER_ID)).not.toContain(USER_ID.replace(/-/g, "").slice(0, 10));
  });

  it("is salted, so it cannot be recomputed from a leaked user id", () => {
    // A bare hash of the id would be reproducible by anyone holding the id — the
    // salt is what makes the reference an anonymous handle instead of a pseudonym
    // anyone can reverse by enumeration.
    const unsalted = `C-${createHash("sha256")
      .update(USER_ID)
      .digest("hex")
      .slice(0, 10)
      .toUpperCase()}`;
    expect(candidateReference(USER_ID)).not.toBe(unsalted);
  });
});

// ── Shaping ───────────────────────────────────────────────────────────────────

describe("admin interview metrics — shaping", () => {
  it("prefers the scored answer when a question also has a skip row", () => {
    const skipRow = makeAnswer({
      questionId: "22222222-2222-4222-8222-222222222222",
      answeredAt: null,
      timeTakenSeconds: null,
      score: null,
      correctness: null,
      relevance: null,
      clarity: null,
      technicalDepth: null,
    });
    const scored = makeAnswer({ score: "9", timeTakenSeconds: 120 });

    // Order is deliberately wrong: the scored row comes first, so picking "the
    // last one wins" would produce the skip row's nulls.
    const metrics = build({ answers: [scored, skipRow] });

    expect(metrics.questions[0]!.score).toBe(9);
    expect(metrics.questions[0]!.timeTakenSeconds).toBe(120);
  });

  it("normalises numeric strings and jsonb text into numbers", () => {
    const metrics = build({ answers: [makeAnswer({ score: "8.25", correctness: 9 })] });

    expect(metrics.questions[0]!.score).toBe(8.25);
    expect(metrics.questions[0]!.scores.correctness).toBe(9);
    expect(metrics.questions[0]!.scores.relevance).toBe(7);
    expect(metrics.aggregate!.overallScore).toBe(78.5);
    expect(metrics.aggregate!.totalDurationSeconds).toBe(1_800);
  });

  it("falls back to the timestamp difference when per-answer timing is absent", () => {
    const question = makeQuestion({ createdAt: new Date("2026-09-01T10:02:00.000Z") });
    const answer = makeAnswer({
      timeTakenSeconds: null,
      answeredAt: new Date("2026-09-01T10:04:30.000Z"),
    });

    expect(build({ questions: [question], answers: [answer] }).questions[0]!.timeTakenSeconds).toBe(
      150,
    );
  });

  it("leaves timing null when there is neither stored time nor an answer timestamp", () => {
    const metrics = build({ answers: [makeAnswer({ timeTakenSeconds: null, answeredAt: null })] });

    expect(metrics.questions[0]!.timeTakenSeconds).toBeNull();
    expect(metrics.questions[0]!.score).toBe(7.5);
  });

  it("orders questions by sequence and reports the difficulty progression", () => {
    const metrics = build({
      questions: [
        makeQuestion({
          id: "b",
          sequenceNumber: 2,
          difficulty: "HARD",
          type: "BEHAVIORAL",
          createdAt: new Date("2026-09-01T10:07:00.000Z"),
        }),
        makeQuestion({ id: "a", sequenceNumber: 1, difficulty: "EASY" }),
        // A question asked before the difficulty column existed.
        makeQuestion({ id: "c", sequenceNumber: 3, difficulty: null }),
      ],
      answers: [],
    });

    expect(metrics.questions.map((q) => q.sequenceNumber)).toEqual([1, 2, 3]);
    expect(metrics.difficultyProgression).toEqual([
      { sequenceNumber: 1, difficulty: "EASY" },
      { sequenceNumber: 2, difficulty: "HARD" },
      { sequenceNumber: 3, difficulty: null },
    ]);
  });

  it("averages scores per category and ignores unanswered questions", () => {
    const metrics = build({
      questions: [
        makeQuestion({ id: "t1", sequenceNumber: 1, type: "TECHNICAL" }),
        makeQuestion({ id: "t2", sequenceNumber: 2, type: "TECHNICAL" }),
        makeQuestion({ id: "b1", sequenceNumber: 3, type: "BEHAVIORAL" }),
      ],
      answers: [
        makeAnswer({ questionId: "t1", score: "8" }),
        makeAnswer({ questionId: "t2", score: "7" }),
        // Behavioral question present but not scored.
        makeAnswer({ questionId: "b1", score: null }),
      ],
    });

    expect(metrics.categoryBreakdown).toEqual([
      { category: "TECHNICAL", questions: 2, scored: 2, averageScore: 7.5 },
      { category: "BEHAVIORAL", questions: 1, scored: 0, averageScore: null },
    ]);
  });

  it("reports a null aggregate when the session has not been scored", () => {
    const metrics = build({ result: null });

    expect(metrics.aggregate).toBeNull();
    // The per-question metrics still stand on their own.
    expect(metrics.questions[0]!.score).toBe(7.5);
  });

  it("maps every terminal status onto a completion outcome", () => {
    const outcomeFor = (status: string) => build({ interview: makeInterview({ status }) }).session.outcome;

    expect(outcomeFor("COMPLETED")).toBe("completed");
    expect(outcomeFor("CANCELLED")).toBe("ended_early");
    expect(outcomeFor("ABANDONED")).toBe("ended_early");
    expect(outcomeFor("TIMED_OUT")).toBe("time_expired");
    expect(outcomeFor("EXPIRED")).toBe("time_expired");
    expect(outcomeFor("INPROGRESS")).toBe("in_progress");
    expect(outcomeFor("DRAFT")).toBe("not_started");
    expect(outcomeFor("SCHEDULED")).toBe("not_started");
  });

  it("survives a session with no metadata, no answer and no difficulty", () => {
    const metrics = build({
      interview: makeInterview({ meta: null, verdict: null }),
      questions: [makeQuestion({ difficulty: null })],
      answers: [],
      result: null,
    });

    expect(metrics.session.jobRole).toBeNull();
    expect(metrics.session.targetedCompany).toBeNull();
    expect(metrics.session.topics).toEqual([]);
    expect(metrics.session.adaptive).toBe(false);
    expect(metrics.session.questionTarget).toBeNull();
    expect(metrics.session.verdict).toBeNull();
    expect(metrics.questions[0]!.score).toBeNull();
  });
});

// ── Route gate ────────────────────────────────────────────────────────────────

describe("admin metrics route gate", () => {
  /**
   * The endpoint's authorisation is a property of how the router is wired, which
   * no unit test of the service can see. Reading the router source is a blunt
   * instrument, but it is the one that fails loudly if the `requireRole("admin")`
   * gate is loosened or the route is moved onto the moderator-level area — and
   * this route is the only place candidate performance is exposed.
   */
  const routesSource = readFileSync(
    new URL("../src/routes/admin.routes.ts", import.meta.url),
    "utf8",
  );

  it("is registered behind the admin-and-above gate", () => {
    expect(routesSource).toMatch(
      /performanceInsights\s*=\s*\[requireAuth,\s*requireRole\("admin"\)\]/,
    );
    expect(routesSource).toMatch(
      /"\/interviews\/:id\/metrics",\s*\n\s*\.\.\.performanceInsights,/,
    );
  });

  it("match the gate's actual behaviour for each role", () => {
    const run = (userRole: string | undefined) => {
      const req = userRole ? ({ auth: { userId: "admin-1", userRole } } as Request) : ({} as Request);
      let outcome: unknown = "reached-handler";
      const next = (error?: unknown) => {
        outcome = error ?? "reached-handler";
      };
      requireRole("admin")(req, {} as never, next as never);
      return outcome;
    };

    expect(run("admin")).toBe("reached-handler");
    expect(run("owner")).toBe("reached-handler");

    // Authenticated but not privileged enough: 403. A moderator, who can reach
    // the rest of the admin area, is refused here on purpose.
    for (const denied of ["moderator", "user"]) {
      const outcome = run(denied);
      expect(outcome).toBeInstanceOf(AppError);
      expect((outcome as AppError).statusCode).toBe(403);
    }

    // No session at all: `requireRole` refuses to run without one, and reports
    // that distinctly from a permission failure.
    const unauthenticated = run(undefined);
    expect(unauthenticated).toBeInstanceOf(AppError);
    expect((unauthenticated as AppError).statusCode).toBe(401);
  });
});
