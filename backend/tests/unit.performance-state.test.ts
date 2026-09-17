/**
 * unit.performance-state.test.ts
 * Pure-function tests for the candidate performance state
 * (src/integrations/ai/adaptive/performance.state.ts).
 *
 * No mocks, no I/O — everything here is deterministic.
 */
import { describe, it, expect } from "vitest";
import {
  initialPerformanceState,
  updatePerformanceState,
  updateSkipCount,
  updateTimeoutCount,
  type CandidatePerformanceState,
} from "../src/integrations/ai/adaptive/performance.state.js";
import type {
  EvaluationResultShape,
  QuestionHistoryEntry,
} from "../src/integrations/ai/ai.graph.types.js";

function evalOf(score: number, signals: EvaluationResultShape["detectionSignals"] = []): EvaluationResultShape {
  return {
    score,
    correctness: score,
    relevance: score,
    clarity: score,
    technicalDepth: score,
    feedback: "ok",
    strengths: [],
    weaknesses: [],
    detectionSignals: signals,
  };
}

function entryOf(questionType: "BEHAVIORAL" | "TECHNICAL" | "MIXED"): QuestionHistoryEntry {
  return {
    questionId: "q-" + Math.random(),
    questionTitle: "Title",
    questionType,
    sequenceNumber: 1,
    wasAnswered: true,
    score: null,
  };
}

describe("initialPerformanceState", () => {
  it("starts at zero with the configured difficulty", () => {
    const s = initialPerformanceState("MEDIUM");
    expect(s).toMatchObject({
      averageScore: 0,
      answeredCount: 0,
      skippedCount: 0,
      timedOutCount: 0,
      strongStreak: 0,
      weakStreak: 0,
      probeCount: 0,
      currentDifficulty: "MEDIUM",
    });
    expect(s.topicScores).toEqual([]);
    expect(s.difficultyHistory).toEqual([]);
    expect(s.lastSignals).toEqual([]);
  });
});

describe("updatePerformanceState", () => {
  it("accumulates the overall average as a rounded running mean", () => {
    let s = initialPerformanceState("EASY");
    s = updatePerformanceState(s, evalOf(80), entryOf("TECHNICAL"));
    s = updatePerformanceState(s, evalOf(90), entryOf("TECHNICAL"));
    s = updatePerformanceState(s, evalOf(100), entryOf("BEHAVIORAL"));
    expect(s.answeredCount).toBe(3);
    expect(s.averageScore).toBe(90); // round(85 + 100)/3 → 90
  });

  it("tracks per-topic averages and counts separately", () => {
    let s = initialPerformanceState("EASY");
    s = updatePerformanceState(s, evalOf(60), entryOf("BEHAVIORAL"));
    s = updatePerformanceState(s, evalOf(80), entryOf("BEHAVIORAL"));
    s = updatePerformanceState(s, evalOf(40), entryOf("TECHNICAL"));

    const beh = s.topicScores.find((t) => t.topic === "BEHAVIORAL");
    const tech = s.topicScores.find((t) => t.topic === "TECHNICAL");
    expect(beh).toMatchObject({ averageScore: 70, questionCount: 2 });
    expect(tech).toMatchObject({ averageScore: 40, questionCount: 1 });
  });

  it("caps per-topic raw scores at the last 5", () => {
    let s = initialPerformanceState("EASY");
    for (const score of [10, 20, 30, 40, 50, 60, 70]) {
      s = updatePerformanceState(s, evalOf(score), entryOf("TECHNICAL"));
    }
    const tech = s.topicScores.find((t) => t.topic === "TECHNICAL")!;
    expect(tech.scores).toEqual([30, 40, 50, 60, 70]);
    expect(tech.averageScore).toBe(50);
    expect(tech.questionCount).toBe(7); // count is not capped
  });

  it("maintains strong and weak streaks from detection signals", () => {
    let s = initialPerformanceState("EASY");
    s = updatePerformanceState(s, evalOf(85, ["strong"]), entryOf("TECHNICAL"));
    s = updatePerformanceState(s, evalOf(90, ["strong"]), entryOf("TECHNICAL"));
    expect(s.strongStreak).toBe(2);

    s = updatePerformanceState(s, evalOf(20, ["weak"]), entryOf("TECHNICAL"));
    expect(s.strongStreak).toBe(0); // broken
    expect(s.weakStreak).toBe(1);

    s = updatePerformanceState(s, evalOf(25, ["weak"]), entryOf("TECHNICAL"));
    expect(s.weakStreak).toBe(2);
  });

  it("counts vague/incomplete answers as probes and resets on a clean answer", () => {
    let s = initialPerformanceState("EASY");
    s = updatePerformanceState(s, evalOf(50, ["vague"]), entryOf("BEHAVIORAL"));
    s = updatePerformanceState(s, evalOf(50, ["incomplete"]), entryOf("BEHAVIORAL"));
    expect(s.probeCount).toBe(2);

    s = updatePerformanceState(s, evalOf(90, ["strong"]), entryOf("BEHAVIORAL"));
    expect(s.probeCount).toBe(0);
  });

  it("records difficulty history and keeps the current difficulty untouched", () => {
    let s = initialPerformanceState("EASY");
    s = updatePerformanceState(s, evalOf(80), entryOf("TECHNICAL"));
    s = updatePerformanceState(s, evalOf(80), entryOf("TECHNICAL"));
    expect(s.difficultyHistory).toEqual(["EASY", "EASY"]);
    expect(s.currentDifficulty).toBe("EASY"); // update never escalates on its own
  });

  it("never mutates the input state", () => {
    const original = initialPerformanceState("HARD");
    const snapshot = JSON.stringify(original);
    updatePerformanceState(original, evalOf(99, ["strong"]), entryOf("TECHNICAL"));
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("carries lastSignals from the latest evaluation only", () => {
    let s = initialPerformanceState("EASY");
    s = updatePerformanceState(s, evalOf(80, ["strong"]), entryOf("TECHNICAL"));
    s = updatePerformanceState(s, evalOf(50, ["vague", "off_topic"]), entryOf("TECHNICAL"));
    expect(s.lastSignals).toEqual(["vague", "off_topic"]);
  });
});

describe("updateSkipCount / updateTimeoutCount", () => {
  it("increments skip count and resets streaks/probes", () => {
    let s: CandidatePerformanceState = {
      ...initialPerformanceState("EASY"),
      strongStreak: 3,
      weakStreak: 1,
      probeCount: 2,
    };
    s = updateSkipCount(s);
    expect(s.skippedCount).toBe(1);
    expect(s.strongStreak).toBe(0);
    expect(s.weakStreak).toBe(0);
    expect(s.probeCount).toBe(0);
    expect(s.answeredCount).toBe(0); // skips are not answers
  });

  it("increments timeout count independently of skips", () => {
    let s = initialPerformanceState("EASY");
    s = updateSkipCount(s);
    s = updateTimeoutCount(s);
    s = updateTimeoutCount(s);
    expect(s.skippedCount).toBe(1);
    expect(s.timedOutCount).toBe(2);
  });

  it("resets streaks/probes on timeout too", () => {
    let s: CandidatePerformanceState = {
      ...initialPerformanceState("EASY"),
      strongStreak: 2,
      probeCount: 1,
    };
    s = updateTimeoutCount(s);
    expect(s.strongStreak).toBe(0);
    expect(s.probeCount).toBe(0);
    expect(s.answeredCount).toBe(0); // timeouts are not answers
  });
});

