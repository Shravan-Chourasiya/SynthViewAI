// ── Coverage: question-category mix + topic tags ──────────────────────────────
// Pure helpers used when building the interviewer prompt. Keeping the mixing
// rules here (instead of inline in prompts.ts) means they are deterministic and
// unit-testable without invoking a model.
//
// Why this exists: a MIXED interview must actually alternate behavioural and
// technical questions, and must not keep circling one subdomain with different
// titles (e.g. "real-time recommender", "scalable feature store",
// "nearest-neighbour retrieval" are all the same ML-systems theme). The model
// gets concrete numbers instead of a vague "alternate" instruction.

import type { QuestionHistoryEntry } from "./ai.graph.types.js";

export type QuestionCategory = "BEHAVIORAL" | "TECHNICAL";

// Target band for a MIXED session — neither category may hold more than 60% of
// the questions asked, so the session stays roughly even (40–60% either way).
export const CATEGORY_SHARE_MAX = 0.6;

const MAX_TOPIC_TAG_LENGTH = 40;

export interface CategoryMix {
  behavioralCount: number;
  technicalCount: number;
  total: number;
  /** Category the next question must use, or null when either is acceptable. */
  requiredCategory: QuestionCategory | null;
  /** True when both categories sit inside the 40–60% band. */
  balanced: boolean;
}

/** The per-question category of a history entry, or null for legacy "MIXED" rows. */
export function categoryOf(
  questionType: QuestionHistoryEntry["questionType"],
): QuestionCategory | null {
  return questionType === "BEHAVIORAL" || questionType === "TECHNICAL" ? questionType : null;
}

export function oppositeCategory(category: QuestionCategory): QuestionCategory {
  return category === "BEHAVIORAL" ? "TECHNICAL" : "BEHAVIORAL";
}

/** Normalised title, used to match a persisted question with its generated entry. */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Category to record for a generated question.
 *
 * A MIXED session must never record the session-level "MIXED" type: the whole point
 * of per-question typing is that every asked question counts towards the split. When
 * the model fails to type its own question, fall back to the category the mix
 * required, so the recorded history stays meaningful instead of silently dropping
 * the question from the balance.
 */
export function resolveQuestionCategory(
  interviewType: "BEHAVIORAL" | "TECHNICAL" | "MIXED",
  returned: "BEHAVIORAL" | "TECHNICAL" | "MIXED",
  requiredCategory: QuestionCategory | null,
): "BEHAVIORAL" | "TECHNICAL" | "MIXED" {
  if (interviewType !== "MIXED") return returned;
  if (returned === "BEHAVIORAL" || returned === "TECHNICAL") return returned;
  return requiredCategory ?? "BEHAVIORAL";
}

/**
 * Category split so far (asked + answered questions) and the category the next
 * question must use.
 *
 * Rules, in order:
 *   1. No questions yet → either category is acceptable (opening question).
 *   2. One category leads → the next question must be the under-represented one.
 *   3. Counts are even → alternate away from the immediately preceding question,
 *      which keeps a 1:1 rhythm instead of two behavioural questions in a row.
 */
export function summarizeCategoryMix(history: QuestionHistoryEntry[]): CategoryMix {
  let behavioralCount = 0;
  let technicalCount = 0;
  let lastCategory: QuestionCategory | null = null;

  for (const entry of history) {
    const category = categoryOf(entry.questionType);
    if (!category) continue;
    if (category === "BEHAVIORAL") behavioralCount += 1;
    else technicalCount += 1;
    lastCategory = category;
  }

  const total = behavioralCount + technicalCount;
  const behavioralShare = total > 0 ? behavioralCount / total : 0;
  const technicalShare = total > 0 ? technicalCount / total : 0;
  const balanced =
    total > 0 && behavioralShare <= CATEGORY_SHARE_MAX && technicalShare <= CATEGORY_SHARE_MAX;

  let requiredCategory: QuestionCategory | null;
  if (total === 0) requiredCategory = null;
  else if (behavioralCount > technicalCount) requiredCategory = "TECHNICAL";
  else if (technicalCount > behavioralCount) requiredCategory = "BEHAVIORAL";
  else requiredCategory = lastCategory ? oppositeCategory(lastCategory) : "BEHAVIORAL";

  return { behavioralCount, technicalCount, total, requiredCategory, balanced };
}

/**
 * Distinct topic tags covered so far, in the order they were introduced.
 * Entries without a tag are skipped.
 */
export function coveredTopics(history: QuestionHistoryEntry[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of history) {
    const tag = entry.topic?.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

/**
 * Coarse subdomain tag derived from a title. Used only as a fallback when the
 * model omits "topic", so history always carries something to avoid. The model's
 * own tag is preferred because it groups themes the title alone cannot.
 */
export function topicTagFromTitle(title: string): string {
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "you",
    "your", "how", "what", "why", "when", "would", "do", "does", "did", "is",
    "are", "be", "me", "i", "tell", "about", "explain", "describe", "walk",
    "through", "give", "example", "time", "question",
  ]);

  const words = normalizeTitle(title)
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/[\s-]+/)
    .filter((word) => word.length > 1 && !stopWords.has(word))
    .slice(0, 4);

  const tag = words.join("-").slice(0, MAX_TOPIC_TAG_LENGTH).replace(/-+$/, "");
  return tag || "general";
}