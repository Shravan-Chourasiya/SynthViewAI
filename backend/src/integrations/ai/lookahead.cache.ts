// ── Look-ahead Question Cache ─────────────────────────────────────────────────
// Stores a pre-generated question in Redis so it is ready before the candidate
// finishes reading feedback on the previous one.
//
// Key:  interview:lookahead:{interviewId}
// TTL:  10 minutes — long enough to cover any evaluation + feedback display time.
//
// The adaptive engine (Step 18/19) calls discardLookahead() before changing
// direction; the pre-generated question is then silently dropped and a fresh
// one is generated on the next question:next request.

import { redisClient } from "../../config/redis.init.js";
import type { GeneratedQuestion } from "./ai.types.js";
import { normaliseAnswerFormat, normaliseCodeLanguage } from "./answer-format.js";

const KEY_PREFIX = "interview:lookahead:";
const TTL_SECONDS = 10 * 60; // 10 minutes

function lookaheadKey(interviewId: string): string {
  return `${KEY_PREFIX}${interviewId}`;
}

/**
 * A cached question was serialised as-is, so an entry written by a build that
 * predates answerFormat comes back without it. Normalising on read means a
 * pre-deploy cache entry still delivers a usable TEXT question instead of
 * `undefined`, and can never deliver CODE for a behavioural question.
 */
function normaliseCachedQuestion(question: GeneratedQuestion): GeneratedQuestion {
  const answerFormat = normaliseAnswerFormat(question.answerFormat, question.questionType);
  return {
    ...question,
    answerFormat,
    codeLanguage: answerFormat === "CODE" ? normaliseCodeLanguage(question.codeLanguage) : null,
  };
}

export async function writeLookahead(
  interviewId: string,
  question: GeneratedQuestion,
): Promise<void> {
  await redisClient.set(lookaheadKey(interviewId), JSON.stringify(question), "EX", TTL_SECONDS);
}

export async function readLookahead(interviewId: string): Promise<GeneratedQuestion | null> {
  const raw = await redisClient.get(lookaheadKey(interviewId));
  if (!raw) return null;
  return normaliseCachedQuestion(JSON.parse(raw) as GeneratedQuestion);
}

// Atomically consume the lookahead: read + delete in one round-trip.
// Returns null if nothing was cached (cache miss or already discarded).
export async function consumeLookahead(interviewId: string): Promise<GeneratedQuestion | null> {
  const key = lookaheadKey(interviewId);
  const raw = await redisClient.getdel(key);
  if (!raw) return null;
  return normaliseCachedQuestion(JSON.parse(raw) as GeneratedQuestion);
}

// Called by the adaptive engine when it decides to change direction mid-flight.
// Safe to call even if no lookahead exists.
export async function discardLookahead(interviewId: string): Promise<void> {
  await redisClient.del(lookaheadKey(interviewId));
}
