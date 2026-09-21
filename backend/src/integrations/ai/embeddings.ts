// ── Question embeddings ───────────────────────────────────────────────────────
// Supplies the vector half of the semantic repetition check in similarity.ts.
//
// Provider choice is forced by what is actually available: Groq exposes no
// embeddings endpoint at all, Mistral does (mistral-embed, 1024 dimensions) and
// the Mistral SDK is already a dependency, so this reuses the existing provider
// relationship rather than adding a vendor or a local model.
//
// Cost control: embeddings are requested in ONE batched call per generated
// question, and only for texts the session has not already embedded (cached on
// QuestionHistoryEntry.embedding). Everything is best-effort — a missing key, a
// timeout, or an API failure returns nulls, and the caller degrades to the
// lexical tiers instead of failing the turn.

import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { withTimeout } from "./provider.js";
import type { EmbedTexts } from "./similarity.js";

/**
 * Deliberately tighter than the generation timeout (8s in provider.ts): this is an
 * optional quality check running *before* a question is accepted, so it must never
 * dominate a turn that the candidate is waiting on. Exceeding it costs accuracy on
 * one question, not a stuck interview.
 */
export const EMBED_TIMEOUT_MS = 2_500;

/** Upper bound on inputs per request — MAX_COMPARED_QUESTIONS plus the candidate. */
const MAX_BATCH = 32;

// A missing key is a configuration fact, not a per-turn event; warn once so a long
// interview does not flood the logs with the same sentence per question.
let warnedMissingKey = false;

/**
 * Embed a batch of texts. Result positions line up with the input positions; a
 * null at a position means "no vector available for this text", never an error.
 */
export const embedTexts: EmbedTexts = async (texts) => {
  if (texts.length === 0) return [];

  const apiKey = env.MISTRAL_API_KEY;
  if (!apiKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      logger.warn(
        "[ai] MISTRAL_API_KEY not set — question embeddings disabled, repetition checks use lexical similarity only",
      );
    }
    return texts.map(() => null);
  }

  // Positional padding: results must stay index-aligned with the caller's input.
  const vectors: (number[] | null)[] = texts.map(() => null);
  const batch = texts.slice(0, MAX_BATCH);

  try {
    const { Mistral } = await import("@mistralai/mistralai");
    const client = new Mistral({ apiKey });
    const response = await withTimeout(
      client.embeddings.create({ model: env.MISTRAL_EMBED_MODEL, inputs: batch }),
      EMBED_TIMEOUT_MS,
    );

    for (const item of response.data) {
      const index = item.index ?? 0;
      if (index < 0 || index >= batch.length) continue;
      if (item.embedding && item.embedding.length > 0) vectors[index] = item.embedding;
    }

    const embedded = vectors.filter((vector) => vector !== null).length;
    // Counts only — question text is interviewer output and is never logged here.
    logger.info(
      { model: env.MISTRAL_EMBED_MODEL, requested: batch.length, embedded },
      "[ai] question embeddings computed",
    );
    return vectors;
  } catch (err) {
    logger.warn(
      {
        reason: err instanceof Error ? err.message : String(err),
        requested: batch.length,
      },
      "[ai] embedding request failed — repetition checks fall back to lexical similarity",
    );
    return texts.map(() => null);
  }
};
