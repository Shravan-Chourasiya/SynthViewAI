/**
 * unit.adaptive.test.ts — Bug 1: duration enforcement
 *
 * Covers computeAdaptation's duration layering:
 *   - hard cutoff at config.durationMinutes (score-independent, both endingCriteria)
 *   - QUESTION_COUNT coverage heuristic vs DURATION criterion
 *   - wrap-up window at ~90% (no new topics, no escalation, hint.wrapUp)
 *   - elapsedMinutesSince edge cases
 *   - no ceiling when durationMinutes is unset/invalid
 *
 * Pure functions — no DB, no Redis, no model calls.
 */

import { describe, it, expect } from "vitest";

import type { QuestionHistoryEntry } from "../src/integrations/ai/ai.graph.types.js";
import type { InterviewConfig } from "../src/modules/interview/types/interview.context.js";
import type {
  CandidatePerformanceState,
  PatternDetection,
} from "../src/integrations/ai/adaptive/index.js";
import { computeAdaptation, elapsedMinutesSince } from "../src/integrations/ai/adaptive/adaptation.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<InterviewConfig> = {}): InterviewConfig {
  return {
    interviewType: "MIXED",
    interviewStyle: "FAANG",
    difficulty: "MEDIUM",
    durationMinutes: 30,
    maxFollowUps: 2,
    ...overrides,
  };
}

function makeState(overrides: Partial<CandidatePerformanceState> = {}): CandidatePerformanceState {
  return {
    averageScore: 70,
    answeredCount: 3,
    skippedCount: 0,
    timedOutCount: 0,
    topicScores: [],
    currentDifficulty: "MEDIUM",
    difficultyHistory: ["MEDIUM"],
    strongStreak: 0,
    weakStreak: 0,
    probeCount: 0,
    lastSignals: [],
    ...overrides,
  };
}

/** Neutral detection — no pattern fires, so the default rule (follow-up) wins. */
function neutralDetection(): PatternDetection {
  return {
    strongArea: false,
    weakArea: false,
    vague: false,
    incomplete: false,
    offTopic: false,
    reasons: {},
  };
}

function makeHistoryEntry(overrides: Partial<QuestionHistoryEntry> = {}): QuestionHistoryEntry {
  return {
    questionId: `q-${Math.random().toString(36).slice(2, 8)}`,
    questionTitle: "Some question",
    questionType: "TECHNICAL",
    sequenceNumber: 1,
    wasAnswered: true,
    score: 75,
    ...overrides,
  };
}

// ── endingCriteria handling ───────────────────────────────────────────────────

describe("computeAdaptation — endingCriteria", () => {
  const strongHistory = (n: number): QuestionHistoryEntry[] =>
    Array.from({ length: n }, (_, i) => makeHistoryEntry({ sequenceNumber: i + 1, score: 90 }));

  it("DURATION criterion: strong score + high coverage still waits for the duration", () => {
    // If the coverage heuristic still applied to DURATION sessions this would
    // terminate (10 answered vs estimatedTotal 6, avg 95) — it must not.
    const decision = computeAdaptation(
      makeState({ answeredCount: 10, averageScore: 95 }),
      neutralDetection(),
      makeConfig({ durationMinutes: 30, endingCriteria: "DURATION" }),
      strongHistory(10),
      20, // only ~67% of the duration used
    );

    expect(decision.action).not.toBe("terminate");
  });

  it("QUESTION_COUNT criterion: coverage + strong score terminates early as today", () => {
    const decision = computeAdaptation(
      makeState({ answeredCount: 6, averageScore: 90 }), // 6/6 = 100% coverage
      neutralDetection(),
      makeConfig({ durationMinutes: 30, endingCriteria: "QUESTION_COUNT" }),
      strongHistory(6),
      12, // 40% of duration — early termination is the QUESTION_COUNT contract
    );

    expect(decision.action).toBe("terminate");
    expect(decision.reason).toMatch(/coverage/i);
  });
});

// ── Wrap-up window (soft threshold) ──────────────────────────────────────────

describe("computeAdaptation — wrap-up window", () => {
  it("flags wrapUp once ~90% of the duration has elapsed", () => {
    const decision = computeAdaptation(
      makeState(),
      neutralDetection(),
      makeConfig({ durationMinutes: 30 }),
      [],
      27.5, // ≈ 92%
    );

    expect(decision.hint.wrapUp).toBe(true);
    expect(decision.hint.mode).toBe("follow_up");
    expect(decision.reason).toMatch(/wrap-up/i);
  });

  it("converts a topic change inside the window into a follow-up on the current line", () => {
    const decision = computeAdaptation(
      makeState({ weakStreak: 3 }),
      { ...neutralDetection(), weakArea: true, reasons: { weakArea: "Weak streak of 3" } },
      makeConfig({ durationMinutes: 20 }),
      [],
      19, // 95% — wrap-up active
    );

    // Without the wrap-up window this would be a new_topic decision.
    expect(decision.action).toBe("follow_up");
    expect(decision.hint.wrapUp).toBe(true);
    expect(decision.reason).toMatch(/wrap-up/i);
  });

  it("suppresses escalation inside the window (harder → follow-up at current difficulty)", () => {
    const decision = computeAdaptation(
      makeState({ strongStreak: 3, currentDifficulty: "EASY" }),
      { ...neutralDetection(), strongArea: true, reasons: { strongArea: "Strong streak of 3" } },
      makeConfig({ durationMinutes: 20 }),
      [],
      19,
    );

    expect(decision.action).toBe("follow_up");
    expect(decision.hint.difficulty).toBe("EASY"); // no escalation
    expect(decision.hint.wrapUp).toBe(true);
  });

  it("does not activate wrap-up below the threshold", () => {
    const decision = computeAdaptation(
      makeState(),
      neutralDetection(),
      makeConfig({ durationMinutes: 30 }),
      [],
      10,
    );

    expect(decision.hint.wrapUp).toBeUndefined();
  });

  it("never softens an actual termination", () => {
    const decision = computeAdaptation(
      makeState({ weakStreak: 5 }),
      neutralDetection(),
      makeConfig({ durationMinutes: 20 }),
      [],
      18, // inside the wrap-up window, but the weak-streak rule terminates first
    );

    expect(decision.action).toBe("terminate");
  });
});

// ── elapsedMinutesSince ───────────────────────────────────────────────────────

describe("elapsedMinutesSince", () => {
  it("returns 0 for a missing timestamp", () => {
    expect(elapsedMinutesSince(null)).toBe(0);
    expect(elapsedMinutesSince(undefined)).toBe(0);
    expect(elapsedMinutesSince("")).toBe(0);
  });

  it("returns 0 for an unparseable timestamp", () => {
    expect(elapsedMinutesSince("not-a-date")).toBe(0);
  });

  it("returns 0 for a timestamp in the future (clock skew)", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(elapsedMinutesSince("2026-01-01T12:05:00Z", now)).toBe(0);
  });

  it("computes fractional minutes between the timer start and now", () => {
    const now = new Date("2026-01-01T12:12:30Z");
    expect(elapsedMinutesSince("2026-01-01T12:00:00Z", now)).toBeCloseTo(12.5, 5);
  });
});


describe("computeAdaptation — hard duration cutoff", () => {
  it("terminates at the configured duration even with a perfect score", () => {
    const decision = computeAdaptation(
      makeState({ averageScore: 95, strongStreak: 5 }),
      neutralDetection(),
      makeConfig({ durationMinutes: 30 }),
      [],
      30.05,
    );

    expect(decision.action).toBe("terminate");
    expect(decision.reason).toMatch(/duration reached/i);
  });

  it("terminates at the configured duration even with a failing score", () => {
    const decision = computeAdaptation(
      makeState({ averageScore: 20, weakStreak: 2 }),
      neutralDetection(),
      makeConfig({ durationMinutes: 15 }),
      [],
      16,
    );

    expect(decision.action).toBe("terminate");
    expect(decision.reason).toMatch(/duration reached/i);
  });

  it("takes priority over the weak-streak early termination at the cutoff", () => {
    const decision = computeAdaptation(
      makeState({ weakStreak: 5 }), // would independently terminate
      neutralDetection(),
      makeConfig({ durationMinutes: 20 }),
      [],
      20,
    );

    expect(decision.action).toBe("terminate");
    expect(decision.reason).toMatch(/duration reached/i);
  });

  it("applies as a safety ceiling to QUESTION_COUNT sessions too", () => {
    const decision = computeAdaptation(
      makeState({ answeredCount: 1, averageScore: 40 }), // far from coverage-based end
      neutralDetection(),
      makeConfig({ durationMinutes: 10, endingCriteria: "QUESTION_COUNT" }),
      [],
      10.5,
    );

    expect(decision.action).toBe("terminate");
    expect(decision.reason).toMatch(/duration reached/i);
  });

  it("does not fire before the configured duration", () => {
    const decision = computeAdaptation(
      makeState(),
      neutralDetection(),
      makeConfig({ durationMinutes: 30 }),
      [],
      29,
    );

    expect(decision.action).not.toBe("terminate");
  });

  it("treats an invalid/missing durationMinutes as no ceiling", () => {
    for (const durationMinutes of [0, Number.NaN]) {
      const decision = computeAdaptation(
        makeState(),
        neutralDetection(),
        makeConfig({ durationMinutes }),
        [],
        500,
      );

      expect(decision.action).not.toBe("terminate");
    }
  });
});
