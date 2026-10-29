/**
 * unit.answer-format.test.ts — code-answer format policy
 *
 * Covers:
 *   - default-to-TEXT: missing, unrecognised, wrong-typed and lower-case output
 *   - behavioural questions can never ask for a code answer
 *   - the one-in-three technical cap, including a model that asks for CODE every turn
 *   - the quota surviving a restart (counted from persisted rows, not graph memory)
 *   - codeLanguage normalisation (trim, bound, null for TEXT)
 *   - prompt instructions carrying the real session counts
 *   - generatedQuestionSchema tolerating an unusable field instead of failing the question
 *
 * Pure functions — no DB, no Redis, no model calls.
 */

import { describe, it, expect } from "vitest";

import {
  CODE_QUESTIONS_PER,
  canUseCodeAnswer,
  codeQuota,
  normaliseAnswerFormat,
  normaliseCodeLanguage,
  resolveAnswerFormat,
  summarizeAnswerFormats,
} from "../src/integrations/ai/answer-format.js";
import type { PriorQuestion, QuestionHistoryEntry } from "../src/integrations/ai/ai.graph.types.js";
import { generatedQuestionSchema } from "../src/integrations/ai/ai.types.js";
import { buildInterviewerPrompt, type PromptStateContext } from "../src/integrations/ai/prompts.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function entry(overrides: Partial<QuestionHistoryEntry> = {}): QuestionHistoryEntry {
  return {
    questionId: `q-${Math.random().toString(36).slice(2, 8)}`,
    questionTitle: "A technical question",
    questionType: "TECHNICAL",
    answerFormat: "TEXT",
    sequenceNumber: 1,
    wasAnswered: true,
    score: 70,
    ...overrides,
  };
}

/**
 * A session where the model asks for CODE on every single turn. The resolver has to
 * hold the line by itself — this is the worst case the cap exists for.
 */
function simulateTechnicalSession(questionCount: number): QuestionHistoryEntry[] {
  const history: QuestionHistoryEntry[] = [];
  for (let i = 0; i < questionCount; i++) {
    const decision = resolveAnswerFormat(
      { answerFormat: "CODE", codeLanguage: "python", questionType: "TECHNICAL" },
      history,
    );
    history.push(
      entry({ answerFormat: decision.answerFormat, sequenceNumber: i + 1, wasAnswered: true }),
    );
  }
  return history;
}

// ── Default to TEXT ───────────────────────────────────────────────────────────

describe("default to TEXT", () => {
  it("a question with no answerFormat at all is prose", () => {
    const decision = resolveAnswerFormat({ questionType: "TECHNICAL" }, []);
    expect(decision.answerFormat).toBe("TEXT");
    expect(decision.codeLanguage).toBeNull();
    expect(decision.override).toBeNull();
  });

  it("unrecognised, blank and wrong-typed values all fall back to TEXT", () => {
    const unusable = ["code!", "", "   ", "prose", "CODE-ish", null, undefined, 42, {}, [], true];
    for (const raw of unusable) {
      expect(normaliseAnswerFormat(raw, "TECHNICAL")).toBe("TEXT");
    }
  });

  it("accepts the format case-insensitively when it is usable", () => {
    expect(normaliseAnswerFormat("code", "TECHNICAL")).toBe("CODE");
    expect(normaliseAnswerFormat("  Code  ", "TECHNICAL")).toBe("CODE");
    expect(normaliseAnswerFormat("TEXT", "TECHNICAL")).toBe("TEXT");
  });

  it("never lets a behavioural question ask for code", () => {
    expect(normaliseAnswerFormat("CODE", "BEHAVIORAL")).toBe("TEXT");

    const decision = resolveAnswerFormat(
      { answerFormat: "CODE", codeLanguage: "python", questionType: "BEHAVIORAL" },
      [],
    );
    expect(decision.answerFormat).toBe("TEXT");
    expect(decision.codeLanguage).toBeNull();
    expect(decision.override).toBe("behavioural-not-code");
  });

  it("treats an untyped (legacy MIXED) question as prose", () => {
    expect(normaliseAnswerFormat("CODE", "MIXED")).toBe("TEXT");
  });
});

// ── One-in-three cap ──────────────────────────────────────────────────────────

describe("one-in-three technical cap", () => {
  it("allows one CODE per three technical questions", () => {
    expect(CODE_QUESTIONS_PER).toBe(3);
    expect(codeQuota(0)).toBe(0);
    expect(codeQuota(1)).toBe(0);
    expect(codeQuota(2)).toBe(0);
    expect(codeQuota(3)).toBe(1);
    expect(codeQuota(4)).toBe(1);
    expect(codeQuota(5)).toBe(1);
    expect(codeQuota(6)).toBe(2);
    expect(codeQuota(9)).toBe(3);
  });

  it("the first two technical questions of a session are always prose", () => {
    expect(canUseCodeAnswer([])).toBe(false);
    expect(canUseCodeAnswer([entry()])).toBe(false);
    expect(canUseCodeAnswer([entry(), entry({ answerFormat: "TEXT" })])).toBe(true);
  });

  it("a model that always asks for CODE still lands exactly one per three", () => {
    const history = simulateTechnicalSession(9);
    const codeIndexes = history
      .map((h, i) => (h.answerFormat === "CODE" ? i + 1 : null))
      .filter((n): n is number => n !== null);

    // The 3rd, 6th and 9th technical questions — never earlier, never more often.
    expect(codeIndexes).toEqual([3, 6, 9]);
    expect(summarizeAnswerFormats(history)).toEqual({ technicalCount: 9, codeCount: 3 });
  });

  it("never exceeds a third of the technical questions at any point in a session", () => {
    for (const total of [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 20]) {
      const { technicalCount, codeCount } = summarizeAnswerFormats(simulateTechnicalSession(total));
      expect(technicalCount).toBe(total);
      expect(codeCount).toBe(Math.floor(total / CODE_QUESTIONS_PER));
      expect(codeCount * CODE_QUESTIONS_PER).toBeLessThanOrEqual(technicalCount);
    }
  });

  it("refuses another CODE once the quota is used, and says why", () => {
    const history = simulateTechnicalSession(3); // third question is CODE
    expect(history[2]!.answerFormat).toBe("CODE");

    const decision = resolveAnswerFormat(
      { answerFormat: "CODE", questionType: "TECHNICAL" },
      history,
    );
    expect(decision.answerFormat).toBe("TEXT");
    expect(decision.override).toBe("code-quota-reached");
    expect(decision.codeLanguage).toBeNull();
  });

  it("behavioural questions neither consume nor inflate the quota", () => {
    const history: QuestionHistoryEntry[] = [
      entry({ questionType: "BEHAVIORAL" }),
      entry({ questionType: "BEHAVIORAL", answerFormat: "CODE" }), // impossible, but persisted
      entry({ questionType: "BEHAVIORAL" }),
      entry(),
      entry(),
    ];
    expect(summarizeAnswerFormats(history)).toEqual({ technicalCount: 2, codeCount: 0 });
    // Two technical questions so far → the third may be CODE.
    expect(canUseCodeAnswer(history)).toBe(true);
    expect(
      resolveAnswerFormat({ answerFormat: "CODE", questionType: "TECHNICAL" }, history)
        .answerFormat,
    ).toBe("CODE");
  });

  it("legacy MIXED rows are ignored rather than counted as technical", () => {
    const history = [entry({ questionType: "MIXED" }), entry({ questionType: "MIXED" })];
    expect(summarizeAnswerFormats(history)).toEqual({ technicalCount: 0, codeCount: 0 });
  });

  it("counts the persisted rows, so the quota survives a restart", () => {
    // Exactly what modules/interview hands in after a fresh process start.
    const persisted: PriorQuestion[] = [
      {
        questionTitle: "Reverse a linked list",
        questionType: "TECHNICAL",
        wasAnswered: true,
        answerFormat: "TEXT",
      },
      {
        questionTitle: "Explain event loop phases",
        questionType: "TECHNICAL",
        wasAnswered: true,
        answerFormat: "TEXT",
      },
      {
        questionTitle: "Write a debounce helper",
        questionType: "TECHNICAL",
        wasAnswered: true,
        answerFormat: "CODE",
      },
    ];
    expect(summarizeAnswerFormats(persisted)).toEqual({ technicalCount: 3, codeCount: 1 });
    expect(canUseCodeAnswer(persisted)).toBe(false);
    expect(
      resolveAnswerFormat({ answerFormat: "CODE", questionType: "TECHNICAL" }, persisted).override,
    ).toBe("code-quota-reached");
  });

  it("rows persisted before the column existed count as prose, not as code", () => {
    const legacy: PriorQuestion[] = [
      { questionTitle: "Design a rate limiter", questionType: "TECHNICAL", wasAnswered: true },
      { questionTitle: "What is a closure?", questionType: "TECHNICAL", wasAnswered: true },
    ];
    expect(summarizeAnswerFormats(legacy)).toEqual({ technicalCount: 2, codeCount: 0 });
    expect(canUseCodeAnswer(legacy)).toBe(true);
  });
});

// ── codeLanguage ──────────────────────────────────────────────────────────────

describe("codeLanguage", () => {
  it("is kept only for a CODE answer and trimmed of stray whitespace", () => {
    const history = simulateTechnicalSession(2); // third technical question may be CODE
    const decision = resolveAnswerFormat(
      { answerFormat: "CODE", codeLanguage: "  TypeScript  ", questionType: "TECHNICAL" },
      history,
    );
    expect(decision.answerFormat).toBe("CODE");
    expect(decision.codeLanguage).toBe("TypeScript");
  });

  it("is dropped for a TEXT answer even when the model suggested one", () => {
    const decision = resolveAnswerFormat(
      { answerFormat: "TEXT", codeLanguage: "python", questionType: "TECHNICAL" },
      [],
    );
    expect(decision.codeLanguage).toBeNull();
  });

  it("normalises unusable suggestions to null and bounds the length", () => {
    expect(normaliseCodeLanguage(undefined)).toBeNull();
    expect(normaliseCodeLanguage("")).toBeNull();
    expect(normaliseCodeLanguage("   ")).toBeNull();
    expect(normaliseCodeLanguage(7)).toBeNull();
    expect(normaliseCodeLanguage("a".repeat(80))).toHaveLength(32);
    expect(normaliseCodeLanguage("  c++  ")).toBe("c++");
  });

  it("leaves a CODE answer without a suggestion usable (null language)", () => {
    const decision = resolveAnswerFormat(
      { answerFormat: "CODE", questionType: "TECHNICAL" },
      simulateTechnicalSession(2),
    );
    expect(decision.answerFormat).toBe("CODE");
    expect(decision.codeLanguage).toBeNull();
  });
});

// ── Prompt instructions ───────────────────────────────────────────────────────

function promptState(overrides: Partial<PromptStateContext> = {}): PromptStateContext {
  return {
    jobRole: "Backend Engineer",
    domain: undefined,
    targetedCompany: undefined,
    jobSkills: ["Node.js", "PostgreSQL"],
    difficulty: "MEDIUM",
    interviewType: "TECHNICAL",
    interviewStyle: "FAANG",
    currentInput: null,
    ...overrides,
  };
}

describe("buildInterviewerPrompt — answer format", () => {
  it("asks for the field and states the quota with real counts", () => {
    const history = simulateTechnicalSession(3);
    const prompt = buildInterviewerPrompt(promptState(), "initial", [], null, history);

    expect(prompt.systemPrompt).toContain('"answerFormat": "TEXT" | "CODE"');
    expect(prompt.systemPrompt).toContain('"codeLanguage": string | null');
    expect(prompt.systemPrompt).toContain("3 technical question(s), 1 of them");
    expect(prompt.systemPrompt).toContain("allowance is used up");
    expect(prompt.systemPrompt).toContain("taken from the role and its listed skills");
  });

  it("says a CODE question is still available before the quota is spent", () => {
    const prompt = buildInterviewerPrompt(
      promptState(),
      "initial",
      [],
      null,
      simulateTechnicalSession(2),
    );
    expect(prompt.systemPrompt).toContain("2 technical question(s), 0 of them");
    expect(prompt.systemPrompt).toMatch(/still available/);
  });

  it("removes CODE entirely from a behavioural session's schema", () => {
    const prompt = buildInterviewerPrompt(
      promptState({ interviewType: "BEHAVIORAL" }),
      "initial",
      [],
      null,
      [],
    );
    expect(prompt.systemPrompt).toContain('"answerFormat": "TEXT"');
    expect(prompt.systemPrompt).not.toContain('"CODE"');
    expect(prompt.systemPrompt).toMatch(/every question in this interview is behavioral/);
  });
});

// ── Model-output tolerance ────────────────────────────────────────────────────

describe("generatedQuestionSchema answer fields", () => {
  function parseQuestion(extra: Record<string, unknown>) {
    return generatedQuestionSchema.safeParse({
      questionTitle: "Write a function that reverses a linked list",
      questionDescription: null,
      questionType: "TECHNICAL",
      topic: "linked-list",
      ...extra,
    });
  }

  it("does not reject a question over an unusable answerFormat", () => {
    for (const answerFormat of [42, {}, "code", "PROSE", null, undefined]) {
      const parsed = parseQuestion({ answerFormat, codeLanguage: "python" });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(normaliseAnswerFormat(parsed.data.answerFormat, "TECHNICAL")).toBe(
          answerFormat === "code" ? "CODE" : "TEXT",
        );
      }
    }
  });

  it("keeps a valid CODE request intact for the graph to police", () => {
    const parsed = parseQuestion({ answerFormat: "CODE", codeLanguage: "python" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(normaliseAnswerFormat(parsed.data.answerFormat, "TECHNICAL")).toBe("CODE");
    }
  });
});
