/**
 * unit.adaptive-engine.test.ts
 * Pattern detection + adaptation decision chain
 * (src/integrations/ai/adaptive/detection.ts + adaptation.ts).
 *
 * computeAdaptation is called with elapsedMinutes = 0 so the duration
 * ceiling/wrap-up layering is inert and the raw decision chain is exercised.
 * The duration behaviour itself is covered by unit.adaptive.test.ts.
 */
import { describe, it, expect } from "vitest";
import { detectPatterns } from "../src/integrations/ai/adaptive/detection.js";
import { computeAdaptation } from "../src/integrations/ai/adaptive/adaptation.js";
import {
  initialPerformanceState,
  updatePerformanceState,
} from "../src/integrations/ai/adaptive/performance.state.js";
import type { CandidatePerformanceState } from "../src/integrations/ai/adaptive/performance.state.js";
import type { PatternDetection } from "../src/integrations/ai/adaptive/detection.js";
import type { InterviewConfig } from "../src/modules/interview/types/interview.context.js";
import type {
  QuestionHistoryEntry,
  EvaluationResultShape,
  DetectionSignal,
} from "../src/integrations/ai/ai.graph.types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const CONFIG: InterviewConfig = {
  interviewType: "MIXED",
  interviewStyle: "REGULAR",
  difficulty: "EASY",
  durationMinutes: 60,
  maxFollowUps: 2,
};

function behavioralConfig(): InterviewConfig {
  return { ...CONFIG, interviewType: "BEHAVIORAL" };
}

let seq = 0;
function entry(questionType: "BEHAVIORAL" | "TECHNICAL", wasAnswered = true): QuestionHistoryEntry {
  seq += 1;
  return {
    questionId: `q-${seq}`,
    questionTitle: `Question ${seq}`,
    questionType,
    sequenceNumber: seq,
    wasAnswered,
    score: null,
  };
}

function evalOf(score: number, signals: DetectionSignal[]): EvaluationResultShape {
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

/** Drive the state through n consecutive answers with the given signal. */
function stateWith(n: number, signal: DetectionSignal, start = initialPerformanceState("EASY")): CandidatePerformanceState {
  let s = start;
  for (let i = 0; i < n; i += 1) {
    s = updatePerformanceState(s, evalOf(signal === "strong" ? 90 : 20, [signal]), entry("TECHNICAL"));
  }
  return s;
}

const NO_SIGNALS: PatternDetection = {
  strongArea: false,
  weakArea: false,
  vague: false,
  incomplete: false,
  offTopic: false,
  reasons: {},
};

// ── detectPatterns ─────────────────────────────────────────────────────────────

describe("detectPatterns", () => {
  it("flags nothing on a clean first answer", () => {
    const d = detectPatterns(initialPerformanceState("EASY"), []);
    expect(d).toMatchObject({ strongArea: false, weakArea: false, vague: false, incomplete: false, offTopic: false });
  });

  it("detects a strong area after 2 consecutive strong answers", () => {
    const s = stateWith(2, "strong");
    const d = detectPatterns(s, []);
    expect(d.strongArea).toBe(true);
    expect(d.reasons.strongArea).toContain("2 consecutive strong");
  });

  it("detects a weak area after 2 consecutive weak answers", () => {
    const s = stateWith(2, "weak");
    const d = detectPatterns(s, []);
    expect(d.weakArea).toBe(true);
  });

  it("detects a strong area from topic average (>=75 over >=2 questions) without a streak", () => {
    let s = initialPerformanceState("EASY");
    const history = [entry("TECHNICAL"), entry("TECHNICAL")];
    s = updatePerformanceState(s, evalOf(80, []), history[0]!);
    s = updatePerformanceState(s, evalOf(90, []), history[1]!);
    const d = detectPatterns(s, history); // lastSignals empty → no streak, but topic avg = 85
    expect(d.strongArea).toBe(true);
    expect(d.reasons.strongArea).toContain("average 85 over 2 questions");
  });

  it("detects a weak area from topic average (<=45 over >=2 questions)", () => {
    let s = initialPerformanceState("EASY");
    const history = [entry("TECHNICAL"), entry("TECHNICAL")];
    s = updatePerformanceState(s, evalOf(30, []), history[0]!);
    s = updatePerformanceState(s, evalOf(50, []), history[1]!);
    const d = detectPatterns(s, history);
    expect(d.weakArea).toBe(true);
  });

  it("does not fire topic-average detection on a single question", () => {
    let s = initialPerformanceState("EASY");
    const history = [entry("TECHNICAL")];
    s = updatePerformanceState(s, evalOf(10, []), history[0]!);
    expect(detectPatterns(s, history).weakArea).toBe(false);
  });

  it("prefers strong over weak when both fire (mutually exclusive)", () => {
    let s = stateWith(2, "weak");
    s = updatePerformanceState(s, evalOf(95, ["strong"]), entry("TECHNICAL"));
    s = updatePerformanceState(s, evalOf(95, ["strong"]), entry("TECHNICAL"));
    const d = detectPatterns(s, []);
    expect(d.strongArea).toBe(true);
    expect(d.weakArea).toBe(false);
  });

  it("passes single-turn signals through from lastSignals", () => {
    let s = initialPerformanceState("EASY");
    s = updatePerformanceState(s, evalOf(50, ["vague", "off_topic"]), entry("TECHNICAL"));
    const d = detectPatterns(s, []);
    expect(d.vague).toBe(true);
    expect(d.offTopic).toBe(true);
    expect(d.incomplete).toBe(false);
  });
});

// ── computeAdaptation — decision chain (elapsed = 0 so duration layers are inert)

describe("computeAdaptation — decision chain", () => {
  // Note: the coverage-based termination (rule 2) needs endingCriteria QUESTION_COUNT;
  // CONFIG omits it so the ?? default "DURATION" keeps rules 3-8 fully exercisable.

  it("defaults to follow_up at current difficulty when nothing fires", () => {
    const d = computeAdaptation(initialPerformanceState("MEDIUM"), NO_SIGNALS, CONFIG, [], 0);
    expect(d.action).toBe("follow_up");
    expect(d.hint.mode).toBe("follow_up");
    expect(d.hint.difficulty).toBe("MEDIUM");
    expect(d.decidedAt).toBeTruthy();
  });

  it("probes with follow_up on a vague answer while under the follow-up cap", () => {
    const d = computeAdaptation(initialPerformanceState("EASY"), { ...NO_SIGNALS, vague: true }, CONFIG, [], 0);
    expect(d.action).toBe("follow_up");
    expect(d.reason).toContain("vague");
    expect(d.reason).toContain("probe 1/2");
  });

  it("prefers vague/incomplete probing over weak-area de-escalation", () => {
    const s = stateWith(3, "weak");
    const d = computeAdaptation(s, { ...NO_SIGNALS, weakArea: true, incomplete: true }, CONFIG, [], 0);
    expect(d.action).toBe("follow_up");
    expect(d.reason).toContain("incomplete");
  });

  it("moves to a new topic when the probe limit is exhausted", () => {
    let s = initialPerformanceState("EASY");
    for (let i = 0; i < CONFIG.maxFollowUps; i += 1) {
      s = updatePerformanceState(s, evalOf(50, ["vague"]), entry("TECHNICAL"));
    }
    expect(s.probeCount).toBe(CONFIG.maxFollowUps);
    const d = computeAdaptation(s, { ...NO_SIGNALS, vague: true }, CONFIG, [], 0);
    expect(d.action).toBe("new_topic");
    expect(d.hint.mode).toBe("topic_change");
  });

  it("keeps following up past the probe limit for BEHAVIORAL interviews (no topic change)", () => {
    let s = initialPerformanceState("EASY");
    for (let i = 0; i < 5; i += 1) {
      s = updatePerformanceState(s, evalOf(50, ["vague"]), entry("BEHAVIORAL"));
    }
    const d = computeAdaptation(s, { ...NO_SIGNALS, vague: true }, behavioralConfig(), [], 0);
    expect(d.action).toBe("follow_up");
    expect(d.reason).toContain("topic change not allowed");
  });

  it("escalates difficulty after 2 consecutive strong answers", () => {
    const s = stateWith(2, "strong", initialPerformanceState("EASY"));
    const d = computeAdaptation(s, detectPatterns(s, []), CONFIG, [], 0);
    expect(d.action).toBe("harder");
    expect(d.hint.difficulty).toBe("MEDIUM");
    expect(d.reason).toContain("escalating to MEDIUM");
  });

  it("changes topic instead of escalating past max difficulty", () => {
    const s = stateWith(2, "strong", initialPerformanceState("HARD"));
    const d = computeAdaptation(s, detectPatterns(s, []), CONFIG, [], 0);
    expect(d.action).toBe("new_topic");
    expect(d.hint.mode).toBe("topic_change");
    expect(d.hint.difficulty).toBe("HARD");
  });

  it("de-escalates on a weak area with a 2-answer streak", () => {
    const s = stateWith(2, "weak", initialPerformanceState("MEDIUM"));
    const d = computeAdaptation(s, detectPatterns(s, []), CONFIG, [], 0);
    expect(d.action).toBe("easier");
    expect(d.hint.difficulty).toBe("EASY");
    expect(d.reason).toContain("de-escalating to EASY");
  });

  it("changes topic on a weak area after 3 weak answers", () => {
    const s = stateWith(3, "weak", initialPerformanceState("MEDIUM"));
    const d = computeAdaptation(s, detectPatterns(s, []), CONFIG, [], 0);
    expect(d.action).toBe("new_topic");
    expect(d.hint.mode).toBe("topic_change");
    expect(d.hint.difficulty).toBe("EASY");
  });

  it("cannot de-escalate below EASY — falls through to the default follow-up", () => {
    const s = stateWith(2, "weak", initialPerformanceState("EASY"));
    const d = computeAdaptation(s, detectPatterns(s, []), CONFIG, [], 0);
    expect(d.action).toBe("follow_up");
    expect(d.hint.difficulty).toBe("EASY");
  });

  it("pivots on an off-topic answer for MIXED interviews", () => {
    const s = initialPerformanceState("EASY");
    const d = computeAdaptation(s, { ...NO_SIGNALS, offTopic: true }, CONFIG, [], 0);
    expect(d.action).toBe("new_topic");
    expect(d.hint.mode).toBe("topic_change");
  });

  it("asks a clearer follow-up instead of pivoting when topics cannot change", () => {
    const d = computeAdaptation(
      initialPerformanceState("EASY"),
      { ...NO_SIGNALS, offTopic: true },
      behavioralConfig(),
      [],
      0,
    );
    expect(d.action).toBe("follow_up");
    expect(d.reason).toContain("off-topic");
  });

  it("terminates early after 5 consecutive weak answers — regardless of config", () => {
    const s = stateWith(5, "weak", initialPerformanceState("HARD"));
    const d = computeAdaptation(s, detectPatterns(s, []), CONFIG, [], 0);
    expect(d.action).toBe("terminate");
    expect(d.reason).toContain("5 consecutive weak answers");
  });

  it("terminates early on 85%+ coverage with a strong average (QUESTION_COUNT only)", () => {
    const qc: InterviewConfig = {
      ...CONFIG,
      durationMinutes: 60, // estimatedTotal = 12
      endingCriteria: "QUESTION_COUNT",
    };
    const s: CandidatePerformanceState = {
      ...initialPerformanceState("EASY"),
      answeredCount: 11, // 11/12 ≈ 92%
      averageScore: 80,
    };
    const d = computeAdaptation(s, NO_SIGNALS, qc, [], 0);
    expect(d.action).toBe("terminate");
    expect(d.reason).toContain("coverage at 92%");
  });

  it("does NOT end a DURATION session early on the coverage heuristic", () => {
    const s: CandidatePerformanceState = {
      ...initialPerformanceState("EASY"),
      answeredCount: 11,
      averageScore: 80,
    };
    const d = computeAdaptation(s, NO_SIGNALS, { ...CONFIG, endingCriteria: "DURATION" }, [], 0);
    expect(d.action).not.toBe("terminate");
  });
});


