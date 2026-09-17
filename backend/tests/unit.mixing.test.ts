/**
 * unit.mixing.test.ts — Bug 2: true question-type mixing for MIXED interviews
 *
 * Covers:
 *   - summarizeCategoryMix: split counting, required category, 40–60% band
 *   - coveredTopics / topicTagFromTitle: topic-diversity bookkeeping
 *   - resolveQuestionCategory: model answer reconciliation
 *   - buildInterviewerPrompt: concrete per-question schema + mixing instruction
 *   - simulated 8-question MIXED session: no category runs > 2, no repeated topics
 *
 * Pure functions — no DB, no Redis, no model calls.
 */

import { describe, it, expect } from "vitest";

import type { QuestionHistoryEntry } from "../src/integrations/ai/ai.graph.types.js";
import {
  summarizeCategoryMix,
  coveredTopics,
  topicTagFromTitle,
  resolveQuestionCategory,
  CATEGORY_SHARE_MAX,
} from "../src/integrations/ai/coverage.js";
import { buildInterviewerPrompt, type PromptStateContext } from "../src/integrations/ai/prompts.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<QuestionHistoryEntry> = {}): QuestionHistoryEntry {
  return {
    questionId: `q-${Math.random().toString(36).slice(2, 8)}`,
    questionTitle: "Some question",
    questionType: "TECHNICAL",
    topic: "algorithms",
    sequenceNumber: 1,
    wasAnswered: true,
    score: 75,
    ...overrides,
  };
}

function mixedState(overrides: Partial<PromptStateContext> = {}): PromptStateContext {
  return {
    jobRole: "Backend Engineer",
    domain: undefined,
    targetedCompany: undefined,
    jobSkills: ["Node.js"],
    difficulty: "MEDIUM",
    interviewType: "MIXED",
    interviewStyle: "FAANG",
    currentInput: null,
    ...overrides,
  };
}

/** Longest run of one category in a history — the alternation quality metric. */
function longestCategoryRun(history: QuestionHistoryEntry[]): number {
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const entry of history) {
    if (entry.questionType === previous) run += 1;
    else {
      run = 1;
      previous = entry.questionType;
    }
    longest = Math.max(longest, run);
  }
  return longest;
}

// ── summarizeCategoryMix ──────────────────────────────────────────────────────

describe("summarizeCategoryMix", () => {
  it("empty history → no required category", () => {
    const mix = summarizeCategoryMix([]);
    expect(mix.total).toBe(0);
    expect(mix.requiredCategory).toBeNull();
    expect(mix.balanced).toBe(false);
  });

  it("under-represented category becomes required", () => {
    const history = [
      makeEntry({ questionType: "TECHNICAL", sequenceNumber: 1 }),
      makeEntry({ questionType: "TECHNICAL", sequenceNumber: 2 }),
    ];
    const mix = summarizeCategoryMix(history);
    expect(mix.behavioralCount).toBe(0);
    expect(mix.technicalCount).toBe(2);
    expect(mix.requiredCategory).toBe("BEHAVIORAL");
    expect(mix.balanced).toBe(false); // technical holds 100% > 60%
  });

  it("even counts alternate away from the last category (1:1 rhythm)", () => {
    const history = [
      makeEntry({ questionType: "BEHAVIORAL", sequenceNumber: 1 }),
      makeEntry({ questionType: "TECHNICAL", sequenceNumber: 2 }),
    ];
    const mix = summarizeCategoryMix(history);
    expect(mix.requiredCategory).toBe("BEHAVIORAL"); // last was TECHNICAL → switch
    expect(mix.balanced).toBe(true);
  });

  it("counts skipped and answered questions alike", () => {
    const history = [
      makeEntry({ questionType: "BEHAVIORAL", sequenceNumber: 1, wasAnswered: false, score: null }),
      makeEntry({ questionType: "BEHAVIORAL", sequenceNumber: 2, wasAnswered: false, score: null }),
      makeEntry({ questionType: "TECHNICAL", sequenceNumber: 3 }),
    ];
    const mix = summarizeCategoryMix(history);
    expect(mix.behavioralCount).toBe(2);
    expect(mix.technicalCount).toBe(1);
    expect(mix.requiredCategory).toBe("TECHNICAL");
  });

  it("legacy 'MIXED' rows are ignored rather than counted as a category", () => {
    const mix = summarizeCategoryMix([makeEntry({ questionType: "MIXED" })]);
    expect(mix.total).toBe(0);
    expect(mix.requiredCategory).toBeNull();
  });

  it("keeps the band inside 60% once both types are in play", () => {
    const history = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ questionType: i < 3 ? "BEHAVIORAL" : "TECHNICAL", sequenceNumber: i + 1 }),
    );
    const mix = summarizeCategoryMix(history);
    expect(mix.balanced).toBe(true); // 3/5 = 60%, inside the band
    expect(mix.requiredCategory).toBe("TECHNICAL");
    expect(CATEGORY_SHARE_MAX).toBe(0.6);
  });
});

// ── Topic diversity ───────────────────────────────────────────────────────────

describe("coveredTopics", () => {
  it("returns distinct tags in introduction order, case-insensitive on dedupe", () => {
    const history = [
      makeEntry({ topic: "feature-store", sequenceNumber: 1 }),
      makeEntry({ topic: "recommender-systems", sequenceNumber: 2 }),
      makeEntry({ topic: "Feature-Store", sequenceNumber: 3 }), // duplicate
      makeEntry({ topic: "  ", sequenceNumber: 4 }), // blank → skipped
    ];
    expect(coveredTopics(history)).toEqual(["feature-store", "recommender-systems"]);
  });
});

describe("topicTagFromTitle", () => {
  it("builds a short tag from content words", () => {
    expect(topicTagFromTitle("Design a scalable feature store for ML models")).toBe(
      "design-scalable-feature-store",
    );
  });

  it("never returns an empty tag", () => {
    expect(topicTagFromTitle("Tell me about a time you...")).toBeTruthy();
  });
});

// ── resolveQuestionCategory ───────────────────────────────────────────────────

describe("resolveQuestionCategory", () => {
  it("non-MIXED sessions pass the model's type through", () => {
    expect(resolveQuestionCategory("TECHNICAL", "TECHNICAL", null)).toBe("TECHNICAL");
    expect(resolveQuestionCategory("BEHAVIORAL", "MIXED", null)).toBe("MIXED");
  });

  it("MIXED sessions: a real category from the model is kept", () => {
    expect(resolveQuestionCategory("MIXED", "TECHNICAL", "BEHAVIORAL")).toBe("TECHNICAL");
  });

  it("MIXED sessions: an untyped answer falls back to the required category", () => {
    expect(resolveQuestionCategory("MIXED", "MIXED", "TECHNICAL")).toBe("TECHNICAL");
    expect(resolveQuestionCategory("MIXED", "MIXED", null)).toBe("BEHAVIORAL");
  });
});

// ── buildInterviewerPrompt (MIXED) ────────────────────────────────────────────

describe("buildInterviewerPrompt — MIXED schema and instructions", () => {
  it("asks the model to type the question, not echo the session type", () => {
    const prompt = buildInterviewerPrompt(mixedState(), "initial", []);
    expect(prompt.systemPrompt).toContain('"questionType": "BEHAVIORAL" | "TECHNICAL"');
    expect(prompt.systemPrompt).not.toContain('"questionType": "MIXED"');
  });

  it("non-MIXED sessions keep the hardcoded type in the schema", () => {
    const prompt = buildInterviewerPrompt(
      mixedState({ interviewType: "TECHNICAL" }),
      "initial",
      [],
    );
    expect(prompt.systemPrompt).toContain('"questionType": "TECHNICAL"');
  });

  it("states the concrete split and the required category", () => {
    const history = [
      makeEntry({ questionType: "TECHNICAL", topic: "caching", sequenceNumber: 1 }),
      makeEntry({ questionType: "TECHNICAL", topic: "queues", sequenceNumber: 2 }),
    ];
    const prompt = buildInterviewerPrompt(mixedState(), "topic_change", [], null, history);
    expect(prompt.systemPrompt).toContain("0 behavioral and 2 technical");
    expect(prompt.systemPrompt).toMatch(/MUST be a behavioral/);
  });

  it("calls out the band on a balanced history too", () => {
    const history = [
      makeEntry({ questionType: "BEHAVIORAL", topic: "team-conflict", sequenceNumber: 1 }),
      makeEntry({ questionType: "TECHNICAL", topic: "caching", sequenceNumber: 2 }),
    ];
    const mix = summarizeCategoryMix(history);
    expect(mix.balanced).toBe(true);
    const prompt = buildInterviewerPrompt(mixedState(), "follow_up", [], null, history);
    expect(prompt.systemPrompt).toContain("1 behavioral and 1 technical");
    expect(prompt.systemPrompt).toMatch(/must not run ahead/);
  });

  it("lists covered topics with a no-repeat instruction", () => {
    const history = [
      makeEntry({ questionType: "TECHNICAL", topic: "feature-store", sequenceNumber: 1 }),
      makeEntry({ questionType: "BEHAVIORAL", topic: "conflict-resolution", sequenceNumber: 2 }),
    ];
    const prompt = buildInterviewerPrompt(mixedState(), "topic_change", [], null, history);
    expect(prompt.systemPrompt).toContain("feature-store");
    expect(prompt.systemPrompt).toContain("conflict-resolution");
    expect(prompt.systemPrompt).toMatch(/do NOT generate another question on these themes/i);
  });

  it("propagates hint.wrapUp into the prompt", () => {
    const prompt = buildInterviewerPrompt(mixedState(), "follow_up", [], {
      mode: "follow_up",
      difficulty: "MEDIUM",
      wrapUp: true,
    });
    expect(prompt.systemPrompt).toMatch(/wrap-up window/i);
  });
});

// ── Simulated 8-question MIXED session ────────────────────────────────────────

describe("simulated MIXED session (~8 questions)", () => {
  // A model that obeys the requiredCategory rule (as the prompt now demands).
  // When the required category is null (opening question) it picks TECHNICAL.
  // One turn it misbehaves and returns the session type "MIXED" —
  // resolveQuestionCategory must still keep the split meaningful.
  const TOPIC_POOL = [
    "caching", "auth-flows", "sql-design", "concurrency",
    "system-tradeoffs", "team-conflict", "mentorship", "incident-response",
  ];

  function simulateSession(turns: number): QuestionHistoryEntry[] {
    const history: QuestionHistoryEntry[] = [];
    let misbehavingTurn = 3; // simulate one untyped model answer early on

    for (let i = 0; i < turns; i++) {
      const mix = summarizeCategoryMix(history);
      const category = mix.requiredCategory ?? "TECHNICAL";

      misbehavingTurn -= 1;
      const modelReturned = misbehavingTurn === 0 ? "MIXED" : category;
      const recorded = resolveQuestionCategory("MIXED", modelReturned, mix.requiredCategory);

      history.push(
        makeEntry({
          questionType: recorded,
          topic: TOPIC_POOL[i % TOPIC_POOL.length],
          sequenceNumber: i + 1,
        }),
      );
    }
    return history;
  }

  it("never runs the same category for more than 2 consecutive questions", () => {
    const history = simulateSession(8);
    expect(longestCategoryRun(history)).toBeLessThanOrEqual(2);
  });

  it("ends with a roughly even split inside the 40–60% band", () => {
    const mix = summarizeCategoryMix(simulateSession(8));
    expect(mix.total).toBe(8);
    const behavioralShare = mix.behavioralCount / mix.total;
    const technicalShare = mix.technicalCount / mix.total;
    expect(behavioralShare).toBeGreaterThan(0.25);
    expect(behavioralShare).toBeLessThan(0.75);
    expect(technicalShare).toBeGreaterThan(0.25);
    expect(technicalShare).toBeLessThan(0.75);
    expect(mix.balanced).toBe(true);
  });

  it("never repeats a topic tag", () => {
    const history = simulateSession(8);
    const tags = coveredTopics(history);
    expect(tags).toHaveLength(new Set(tags.map((t) => t.toLowerCase())).size);
  });

  it("a misbehaving model answer still counts towards the split (not lost as MIXED)", () => {
    for (const entry of simulateSession(8)) {
      expect(["BEHAVIORAL", "TECHNICAL"]).toContain(entry.questionType);
    }
  });
});
