/**
 * unit.answer-submission.test.ts — code answers as first-class submissions
 *
 * Covers:
 *   - submit: a prose answer, a code answer (stored as code + language, never
 *     folded into a "[lang]\ncode" string), and an audio answer
 *   - idempotency: a replay returns the answer already on record
 *   - skip: an empty answer, prose or code, is a skip rather than a zero score
 *   - oversized code rejection at the 20,000-character ceiling, including the boundary
 *   - the evaluator's code rubric and the "code was NOT executed" statement
 *
 * Pure functions — no DB, no Redis, no model calls.
 */

import { describe, it, expect } from "vitest";

import {
  MAX_ANSWER_CHARS,
  assertAnswerWithinLimit,
  decideSubmission,
  isBlankAnswer,
  normaliseAnswerLanguage,
  type AnswerSubmissionPayload,
} from "../src/modules/interview/answer-submission.js";
import { AppError } from "../src/utils/AppError.js";
import { buildEvaluatorPrompt, type PromptStateContext } from "../src/integrations/ai/prompts.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function payload(overrides: Partial<AnswerSubmissionPayload> = {}): AnswerSubmissionPayload {
  return {
    questionId: "question-1",
    answerData: "A heap keeps the next item in O(log n).",
    answerType: "TEXT",
    ...overrides,
  };
}

const CODE = "def add(a, b):\n    return a + b\n";

// ── Submit ────────────────────────────────────────────────────────────────────

describe("decideSubmission — submit", () => {
  it("persists a prose answer unchanged", () => {
    const decision = decideSubmission(null, payload());
    expect(decision).toEqual({
      kind: "persist",
      answerData: "A heap keeps the next item in O(log n).",
      answerType: "TEXT",
      answerLanguage: null,
    });
  });

  it("stores code as the answer text with its language beside it", () => {
    const decision = decideSubmission(
      null,
      payload({ answerData: CODE, answerType: "TEXT", answerLanguage: "python" }),
    );

    expect(decision.kind).toBe("persist");
    if (decision.kind !== "persist") return;
    expect(decision.answerData).toBe(CODE);
    expect(decision.answerLanguage).toBe("python");
    // The old gateway folded the language into the text; that must not come back.
    expect(decision.answerData).not.toContain("[python]");
  });

  it("keeps other answer types intact", () => {
    const decision = decideSubmission(
      null,
      payload({ answerData: "https://cdn/x.webm", answerType: "VIDEO" }),
    );
    expect(decision.kind).toBe("persist");
    if (decision.kind !== "persist") return;
    expect(decision.answerType).toBe("VIDEO");
  });

  it("treats an empty answer as a skip, prose or code", () => {
    expect(decideSubmission(null, payload({ answerData: "" }))).toEqual({ kind: "skip" });
    expect(decideSubmission(null, payload({ answerData: "   \n\t " }))).toEqual({ kind: "skip" });
    expect(decideSubmission(null, payload({ answerData: "", answerLanguage: "python" }))).toEqual({
      kind: "skip",
    });
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe("decideSubmission — idempotency", () => {
  it("returns the answer already on record instead of writing a second one", () => {
    const decision = decideSubmission("answer-existing", payload());
    expect(decision).toEqual({ kind: "duplicate", answerId: "answer-existing" });
  });

  it("is idempotent for code submissions too", () => {
    const decision = decideSubmission(
      "answer-existing",
      payload({ answerData: CODE, answerLanguage: "python" }),
    );
    expect(decision).toEqual({ kind: "duplicate", answerId: "answer-existing" });
  });

  it("checks the duplicate before the empty-answer rule", () => {
    // A replay must be recognised as a replay even if the retried payload is blank,
    // otherwise the same request could be answered two different ways.
    expect(decideSubmission("answer-existing", payload({ answerData: "" }))).toEqual({
      kind: "duplicate",
      answerId: "answer-existing",
    });
  });
});

// ── Oversized answers ─────────────────────────────────────────────────────────

describe("oversized answers", () => {
  it("accepts exactly the limit", () => {
    expect(MAX_ANSWER_CHARS).toBe(20_000);
    const decision = decideSubmission(null, payload({ answerData: "x".repeat(MAX_ANSWER_CHARS) }));
    expect(decision.kind).toBe("persist");
  });

  it("rejects oversized code with a 422 validation error", () => {
    let thrown: unknown;
    try {
      decideSubmission(
        null,
        payload({ answerData: "y".repeat(MAX_ANSWER_CHARS + 1), answerLanguage: "python" }),
      );
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AppError);
    const appError = thrown as AppError;
    expect(appError.statusCode).toBe(422);
    expect(appError.errorCode).toBe("VALIDATION_FAILED");
    expect(appError.message).toContain("20,000");
  });

  it("rejects an oversized prose answer the same way", () => {
    expect(() => assertAnswerWithinLimit("z".repeat(MAX_ANSWER_CHARS + 1))).toThrow(AppError);
  });

  it("rejects before deciding to persist, so nothing oversized is stored", () => {
    // A blank oversized answer is a skip; a real one is a validation failure. Either
    // way the payload never reaches the insert.
    const decisionIsNotPersisted = () => {
      try {
        return decideSubmission(null, payload({ answerData: "q".repeat(MAX_ANSWER_CHARS + 1) }));
      } catch {
        return null;
      }
    };
    expect(decisionIsNotPersisted()).toBeNull();
  });
});

// ── Blank + language helpers ──────────────────────────────────────────────────

describe("isBlankAnswer", () => {
  it("treats whitespace as blank and any content as an answer", () => {
    expect(isBlankAnswer("")).toBe(true);
    expect(isBlankAnswer(" \n\t\r ")).toBe(true);
    expect(isBlankAnswer("x")).toBe(false);
    expect(isBlankAnswer(" return 1; ")).toBe(false);
  });
});

describe("normaliseAnswerLanguage", () => {
  it("trims a usable language", () => {
    expect(normaliseAnswerLanguage("  python  ")).toBe("python");
    expect(normaliseAnswerLanguage("c++")).toBe("c++");
  });

  it("returns null for unusable input", () => {
    expect(normaliseAnswerLanguage(undefined)).toBeNull();
    expect(normaliseAnswerLanguage(null)).toBeNull();
    expect(normaliseAnswerLanguage("")).toBeNull();
    expect(normaliseAnswerLanguage("   ")).toBeNull();
    expect(normaliseAnswerLanguage(42)).toBeNull();
  });

  it("bounds the language to the column width", () => {
    expect(normaliseAnswerLanguage("a".repeat(80))).toHaveLength(32);
  });
});

// ── Evaluator code rubric ─────────────────────────────────────────────────────

function evaluatorState(overrides: Record<string, unknown> = {}): PromptStateContext {
  return {
    jobRole: "Backend Engineer",
    domain: undefined,
    targetedCompany: undefined,
    jobSkills: ["Python"],
    difficulty: "MEDIUM",
    interviewType: "TECHNICAL",
    interviewStyle: "FAANG",
    currentInput: {
      operation: "evaluate",
      questionTitle: "Write a function that adds two numbers",
      answerData: CODE,
      answerType: "TEXT",
      ...overrides,
    },
  } as PromptStateContext;
}

describe("buildEvaluatorPrompt — code answers", () => {
  it("states that the code was not executed and gives the code rubric", () => {
    const prompt = buildEvaluatorPrompt(
      evaluatorState({ answerFormat: "CODE", answerLanguage: "python" }),
      [],
    );

    expect(prompt.systemPrompt).toContain("The code was NOT executed");
    expect(prompt.systemPrompt).toContain("algorithmic complexity");
    expect(prompt.systemPrompt).toContain("edge cases");
    expect(prompt.systemPrompt).toContain("readability");
    expect(prompt.systemPrompt).toMatch(/do NOT penalise trivial syntax slips/i);
    expect(prompt.systemPrompt).toContain("python");
  });

  it("renders the answer as a code block with its language", () => {
    const prompt = buildEvaluatorPrompt(
      evaluatorState({ answerFormat: "CODE", answerLanguage: "python" }),
      [],
    );

    expect(prompt.userPrompt).toContain("```python");
    expect(prompt.userPrompt).toContain("return a + b");
    expect(prompt.userPrompt).toContain("NOT executed");
  });

  it("keeps the prose rubric for a text answer", () => {
    const prompt = buildEvaluatorPrompt(
      evaluatorState({ answerData: "It is fast.", answerFormat: "TEXT" }),
      [],
    );

    expect(prompt.systemPrompt).not.toContain("NOT executed");
    expect(prompt.userPrompt).toContain('Candidate\'s answer: "It is fast."');
    expect(prompt.userPrompt).toContain("TEXT (prose)");
  });

  it("treats a missing answerFormat as prose", () => {
    const prompt = buildEvaluatorPrompt(evaluatorState(), []);
    expect(prompt.systemPrompt).not.toContain("NOT executed");
  });

  it("still uses the code rubric when the language is unknown", () => {
    const prompt = buildEvaluatorPrompt(evaluatorState({ answerFormat: "CODE" }), []);
    expect(prompt.systemPrompt).toContain("This answer is CODE, submitted as source text.");
    expect(prompt.userPrompt).toContain("Candidate's code (not executed)");
  });
});
