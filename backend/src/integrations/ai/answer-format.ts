// ── Answer Format Policy ──────────────────────────────────────────────────────
// Decides whether a generated question is answered as prose or as code.
//
// Three rules, all enforced here so the prompt, the provider parser and the graph
// cannot drift apart:
//   1. Only TECHNICAL questions may be CODE — behavioural answers are always prose.
//   2. At most one in every three technical questions is CODE: three technical
//      questions may contain one editor task, six may contain two, and so on.
//   3. Anything missing, malformed or unrecognised defaults to TEXT. A sloppy model
//      answer must never cost the candidate a question.
//
// Pure by design — no I/O, no model calls — so the rules are unit-testable without
// a provider or a database.

export type AnswerFormat = "TEXT" | "CODE";

/** One CODE question is allowed per this many technical questions. */
export const CODE_QUESTIONS_PER = 3;

/** Matches the interview_questions.code_language column width. */
const MAX_CODE_LANGUAGE_LENGTH = 32;

/**
 * The slice of a question this policy needs. Satisfied by both QuestionHistoryEntry
 * (graph memory) and PriorQuestion (persisted rows handed in by modules/interview),
 * so the quota survives a checkpoint loss or a restarted server.
 */
export interface AnswerFormatEntry {
  questionType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  answerFormat?: AnswerFormat | null;
}

export interface AnswerFormatStats {
  /** Technical questions asked so far, CODE and TEXT alike. */
  technicalCount: number;
  /** Of those, how many asked for a code answer. */
  codeCount: number;
}

/** Count the technical questions asked so far and how many of them were CODE. */
export function summarizeAnswerFormats(history: AnswerFormatEntry[]): AnswerFormatStats {
  let technicalCount = 0;
  let codeCount = 0;
  for (const entry of history) {
    // Legacy "MIXED" rows carry no per-question category, so they cannot be counted
    // as technical — counting them would inflate the quota.
    if (entry.questionType !== "TECHNICAL") continue;
    technicalCount += 1;
    if (entry.answerFormat === "CODE") codeCount += 1;
  }
  return { technicalCount, codeCount };
}

/**
 * The CODE allowance once `technicalCount` technical questions exist, this one
 * included. floor(1/3) and floor(2/3) are 0, so the first two technical questions
 * are always prose; the third opens the first editor task.
 */
export function codeQuota(technicalCount: number): number {
  return Math.floor(technicalCount / CODE_QUESTIONS_PER);
}

/**
 * True when the next question may be CODE without breaking the 1-in-3 cap.
 * Reads optimistically — it assumes the next question *is* technical, which is what
 * makes it safe to put in the prompt as a permission.
 */
export function canUseCodeAnswer(history: AnswerFormatEntry[]): boolean {
  const stats = summarizeAnswerFormats(history);
  return stats.codeCount < codeQuota(stats.technicalCount + 1);
}

/** True when the model asked for a code answer, before any rule is applied. */
function requestedCode(raw: unknown): boolean {
  return typeof raw === "string" && raw.trim().toUpperCase() === "CODE";
}

/**
 * Coerce arbitrary model output to the format allowed for `questionType`, ignoring
 * the session quota (the provider has no history). Rules 1 and 3 live here.
 */
export function normaliseAnswerFormat(
  raw: unknown,
  questionType: AnswerFormatEntry["questionType"],
): AnswerFormat {
  if (questionType !== "TECHNICAL") return "TEXT";
  return requestedCode(raw) ? "CODE" : "TEXT";
}

/** Trim and bound a suggested language; null when unusable. */
export function normaliseCodeLanguage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/\s+/g, " ").slice(0, MAX_CODE_LANGUAGE_LENGTH).trim();
  return cleaned.length > 0 ? cleaned : null;
}

export interface AnswerFormatInput {
  answerFormat?: unknown;
  codeLanguage?: unknown;
  questionType: AnswerFormatEntry["questionType"];
}

/** Why a CODE request was refused — null when it was honoured. */
export type AnswerFormatOverride = "behavioural-not-code" | "code-quota-reached";

export interface AnswerFormatDecision {
  answerFormat: AnswerFormat;
  codeLanguage: string | null;
  override: AnswerFormatOverride | null;
}

/**
 * Apply all three rules to one generated question against the session so far.
 * This is the single authority the graph uses before persisting a question.
 */
export function resolveAnswerFormat(
  input: AnswerFormatInput,
  history: AnswerFormatEntry[],
): AnswerFormatDecision {
  if (!requestedCode(input.answerFormat)) {
    return { answerFormat: "TEXT", codeLanguage: null, override: null };
  }

  if (input.questionType !== "TECHNICAL") {
    return { answerFormat: "TEXT", codeLanguage: null, override: "behavioural-not-code" };
  }

  const stats = summarizeAnswerFormats(history);
  // +1: the question being resolved is itself a technical question.
  if (stats.codeCount >= codeQuota(stats.technicalCount + 1)) {
    return { answerFormat: "TEXT", codeLanguage: null, override: "code-quota-reached" };
  }

  return {
    answerFormat: "CODE",
    codeLanguage: normaliseCodeLanguage(input.codeLanguage),
    override: null,
  };
}
