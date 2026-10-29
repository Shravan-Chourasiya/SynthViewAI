// ── Answer Submission Rules ───────────────────────────────────────────────────
// An answer reaches the service through three doors — the HTTP route, answer:submit
// and code:submit — so the rules that decide what a submission is live here, once.
//
// Three outcomes, in this order:
//   duplicate — a replay of an already-persisted answer, returned untouched
//   skip      — an empty answer, which counts as a skip rather than a zero score
//   persist   — a real answer, after the storage ceiling has been checked
//
// Pure by design: no DB, no Redis, no AI, so the rules are unit-testable without a
// database and the service stays a thin adapter around them.

import { StatusCodes } from "http-status-codes";
import { AppError } from "../../utils/AppError.js";
import { ErrorCodes } from "../../constants/errorCodes.js";

/**
 * Ceiling for interview_answers.answer_data.
 *
 * The column is `text`, so this is a product limit rather than a storage one: it
 * bounds what the evaluator prompt has to carry (code answers are much longer than
 * prose) while leaving room for a realistic solution. Enforced here, before the
 * insert, so an oversized payload never reaches Postgres or the AI pipeline.
 */
export const MAX_ANSWER_CHARS = 20_000;

/** Matches the interview_answers.answer_language column width. */
const MAX_ANSWER_LANGUAGE_CHARS = 32;

export type AnswerType = "TEXT" | "AUDIO" | "VIDEO";

export interface AnswerSubmissionPayload {
  questionId: string;
  answerData: string;
  answerType: AnswerType;
  /**
   * Language a code answer was written in (e.g. "python"). Only code submissions
   * set this — prose answers leave it undefined and store null.
   */
  answerLanguage?: string | null;
}

/** An answer with nothing but whitespace is a skip, not a zero-scored answer. */
export function isBlankAnswer(answerData: string): boolean {
  return answerData.trim().length === 0;
}

/** Trim and bound a suggested language; null when unusable. */
export function normaliseAnswerLanguage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/\s+/g, " ").slice(0, MAX_ANSWER_LANGUAGE_CHARS).trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Throws a 422 when an answer exceeds the storage ceiling. */
export function assertAnswerWithinLimit(answerData: string): void {
  if (answerData.length <= MAX_ANSWER_CHARS) return;
  throw new AppError(
    `Answer exceeds the ${MAX_ANSWER_CHARS.toLocaleString("en-US")} character limit`,
    StatusCodes.UNPROCESSABLE_ENTITY,
    ErrorCodes.VALIDATION_FAILED,
    { isOperational: true },
  );
}

export type SubmissionDecision =
  | { kind: "duplicate"; answerId: string }
  | { kind: "skip" }
  | {
      kind: "persist";
      answerData: string;
      answerType: AnswerType;
      answerLanguage: string | null;
    };

/**
 * Decide what a submission means. Throws for an oversized answer — deliberately,
 * because that is a client error the candidate can fix (trim the solution) rather
 * than something to store and evaluate.
 */
export function decideSubmission(
  existingAnswerId: string | null,
  payload: AnswerSubmissionPayload,
): SubmissionDecision {
  // Idempotency first: a re-delivered submission must return the answer already on
  // record. Checking before anything else also means a retry can never trigger a
  // second row or a second evaluation.
  if (existingAnswerId) return { kind: "duplicate", answerId: existingAnswerId };

  // Empty answer = skip. An empty code submission lands here too, which is what
  // keeps the "empty answer counts as a skip" behaviour across both submit paths.
  if (isBlankAnswer(payload.answerData)) return { kind: "skip" };

  assertAnswerWithinLimit(payload.answerData);

  return {
    kind: "persist",
    answerData: payload.answerData,
    answerType: payload.answerType,
    // Code is stored as itself; the language travels beside it instead of being
    // prefixed into the text, so the evaluator and any future runner can trust the field.
    answerLanguage: normaliseAnswerLanguage(payload.answerLanguage),
  };
}
