// ── Semantic repetition detection ─────────────────────────────────────────────
// The interviewer must not ask the same question twice. Two layers already exist
// and both only catch LITERAL repeats:
//
//   - the exact-title guard in graph.ts compares normalised title strings, so any
//     reworded question slips straight past it
//   - the "topic" tags in coverage.ts depend on the model reporting a consistent,
//     honest subdomain label — and when it omits one, topicTagFromTitle() derives a
//     tag from the title words, which is exactly as rewording-sensitive as the
//     string compare it was meant to back up
//
// This module closes that hole with a real similarity check. It is split into
// three tiers, cheapest first, so a normal turn pays as little as possible:
//
//   1. content-key equality — stop-words removed, remaining words sorted. Pure
//      string work, no I/O. Catches "Design a rate limiter" vs
//      "How would you design a rate limiter?" (same content words, different
//      phrasing) with zero false positives on questions that test different
//      things, because one differing content word changes the key.
//   2. lexical similarity — blended token containment + character-trigram
//      overlap. Still no I/O. Only fires above LEXICAL_REPEAT_THRESHOLD, which is
//      deliberately conservative: its job is to skip the embedding call for
//      near-verbatim repeats, not to make the final call. Its recall is poor by
//      construction (bag-of-words cannot see "feature store" ≈ "recommendation
//      pipeline"), which is precisely why tier 3 exists.
//   3. embedding cosine — the only tier that actually understands meaning. Vectors
//      are computed by embeddings.ts and cached on the session history, so each
//      question is embedded at most once per interview.
//
// Tiers are cumulative, never alternatives: a question rejected on tier 2 is a
// repeat, but a question that clears tier 2 is not yet cleared overall.

import type { QuestionHistoryEntry } from "./ai.graph.types.js";
import { normalizeTitle } from "./coverage.js";

// ── Thresholds ────────────────────────────────────────────────────────────────

/**
 * Blended lexical similarity at/above which a question is treated as a repeat
 * without spending an embedding call.
 *
 * Measured on a labelled corpus of 25 question pairs (10 rewordings, 12 distinct
 * questions, 3 borderline): reworded pairs scored at most 0.879 (a near-verbatim
 * pair) and distinct pairs at most 0.787, so this tier only ever fires on text
 * that changed almost none of its words. That is intentional — bag-of-words
 * cannot see that a memory leak and a slowly-growing service are the same
 * question, so this tier exists to skip the embedding call in the obvious case,
 * not to make the final judgement.
 *
 * It is also the whole detector when embeddings are unavailable (no Mistral key,
 * or a failed request) — weak by construction, and deliberately logged when it
 * happens rather than failing quietly.
 */
export const LEXICAL_REPEAT_THRESHOLD = 0.85;

/**
 * Cosine similarity between question embeddings at/above which a question is
 * treated as a repeat.
 *
 * Calibrated on the same labelled corpus. Measured distribution:
 *   reworded pairs:  min 0.829, median 0.885, max 0.944
 *   distinct pairs:  max 0.875 (2nd 0.872, 3rd 0.870)
 * The two sets overlap between 0.829 and 0.875 because the collisions there are
 * the same sentence frame with a different subject ("explain how <X> works in a
 * distributed system", "how would you design <Y>?"), which cosine cannot tell
 * apart from a genuine rewording. No threshold is simultaneously precise and
 * sensitive, so this one is chosen by cost, not by score:
 *   - a missed repeat is candidate-visible — the candidate is asked the same
 *     question twice, which is the failure this whole layer exists to prevent
 *   - a false positive costs one extra generation call, reusing the retry path
 *     that already exists and is bounded by MAX_QUESTION_RETRIES, and the
 *     candidate never sees anything wrong
 * 0.84 catches 9/10 rewordings for 3/12 legitimate questions re-asked — the
 * trade the asymmetry above calls for. 0.82 would catch one more rewording, but
 * the nearest legitimate pair ("how would you design <X>?" vs "... <Y>?") scored
 * 0.817, so it would leave almost no margin on the most common question shape in a
 * technical interview. Re-tune from real transcripts: this corpus is small and
 * assembled for calibration, not sampled from production.
 *
 * Known residual: two questions that share a broad theme but not a wording ("design
 * a real-time recommender" vs "design a scalable feature store", measured 0.794)
 * are accepted here by design — they are different questions, and the topic-tag
 * layer in coverage.ts is what keeps a session off a single subdomain.
 */
export const EMBEDDING_REPEAT_THRESHOLD = 0.84;

/**
 * How many prior questions a candidate is compared against. An interview is
 * ~10–20 questions, so this only ever truncates a marathon session; the opening
 * question is always kept because it anchors the whole interview's theme.
 */
export const MAX_COMPARED_QUESTIONS = 24;

/**
 * Longest question text sent for embedding. Descriptions are short by prompt
 * design; the cap only defends against a runaway model response.
 */
const MAX_EMBED_TEXT_LENGTH = 600;

// ── Text normalisation ────────────────────────────────────────────────────────

/**
 * Words carrying no topical signal. Interrogatives and interview boilerplate are
 * included because they appear in nearly every question, making them actively
 * harmful for a similarity measure — they inflate the score of unrelated pairs.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "than",
  "so",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "onto",
  "to",
  "with",
  "within",
  "without",
  "about",
  "between",
  "over",
  "under",
  "up",
  "down",
  "out",
  "off",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "do",
  "does",
  "did",
  "done",
  "have",
  "has",
  "had",
  "will",
  "would",
  "shall",
  "should",
  "can",
  "could",
  "may",
  "might",
  "must",
  "you",
  "your",
  "yours",
  "me",
  "my",
  "we",
  "our",
  "i",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "there",
  "here",
  "how",
  "what",
  "why",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "tell",
  "explain",
  "describe",
  "walk",
  "give",
  "show",
  "share",
  "talk",
  "through",
  "example",
  "examples",
  "time",
  "question",
  "questions",
  "please",
  "using",
  "use",
  "used",
  "would",
  "like",
  "want",
  "need",
  "get",
  "got",
  "also",
  "more",
  "most",
  "some",
  "any",
  "all",
  "every",
  "ever",
  "one",
  "two",
]);

/** Content words of a text, in order, normalised and stop-word filtered. */
function contentWords(text: string): string[] {
  return normalizeTitle(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Order-insensitive identity of a question's content words. Two questions with
 * the same content words are the same question asked differently.
 */
export function contentKey(text: string): string {
  return [...new Set(contentWords(text))].sort().join(" ");
}

/** Overlap of content-word sets relative to the smaller question. */
function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

/** Sørensen–Dice over character trigrams — catches inflection and word order. */
function trigramDice(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

function trigrams(text: string): Set<string> {
  const compact = normalizeTitle(text)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const padded = ` ${compact} `;
  const grams = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

/**
 * Blended lexical similarity in [0, 1]. Word overlap and character overlap are
 * averaged rather than maxed so that a question sharing many words but no phrasing
 * (and vice versa) cannot reach the threshold on one signal alone.
 */
export function lexicalSimilarity(a: string, b: string): number {
  return (
    0.5 * containment(new Set(contentWords(a)), new Set(contentWords(b))) + 0.5 * trigramDice(a, b)
  );
}

// ── Embedding maths ───────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Comparison set ────────────────────────────────────────────────────────────

/** The text a question is judged on — title, plus the clarifying note if present. */
export function questionText(question: {
  questionTitle: string;
  questionDescription?: string | null;
}): string {
  const text = question.questionDescription
    ? `${question.questionTitle}. ${question.questionDescription}`
    : question.questionTitle;
  return text.slice(0, MAX_EMBED_TEXT_LENGTH);
}

/**
 * The prior questions worth comparing against: the most recent
 * MAX_COMPARED_QUESTIONS plus the opening question, deduplicated by title.
 */
export function selectComparableHistory(history: QuestionHistoryEntry[]): QuestionHistoryEntry[] {
  if (history.length <= MAX_COMPARED_QUESTIONS) return history;
  const opening = history[0];
  const recent = history.slice(-MAX_COMPARED_QUESTIONS);
  const seen = new Set<string>();
  const selected: QuestionHistoryEntry[] = [];
  for (const entry of opening ? [opening, ...recent] : recent) {
    const key = normalizeTitle(entry.questionTitle);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(entry);
  }
  return selected;
}

// ── Detection ─────────────────────────────────────────────────────────────────

export type RepeatMethod = "identical-content" | "lexical" | "embedding";

export interface RepeatMatch {
  method: RepeatMethod;
  /** Similarity that triggered the match — always >= the threshold for its method. */
  score: number;
  /** Title of the earlier question this candidate duplicates. */
  questionTitle: string;
  sequenceNumber: number;
}

export interface SemanticRepeatResult {
  match: RepeatMatch | null;
  /**
   * The candidate's embedding, or null when it was never computed (a free tier
   * decided the outcome) or the embedding provider was unavailable. Callers cache
   * it on the accepted question so the next turn does not pay for it again.
   */
  embedding: number[] | null;
  /**
   * True when the embedding tier was needed but produced nothing, so the verdict
   * rests on the lexical tiers alone. Never fatal — the turn continues.
   */
  degraded: boolean;
}

/** Embeds texts in one batch; null at a position means that text could not be embedded. */
export type EmbedTexts = (texts: string[]) => Promise<(number[] | null)[]>;

function bestLexicalMatch(
  candidateText: string,
  history: QuestionHistoryEntry[],
): RepeatMatch | null {
  const candidateKey = contentKey(candidateText);
  let best: RepeatMatch | null = null;

  for (const entry of history) {
    const priorText = questionText(entry);

    // Tier 1 — same content words, different phrasing. Exact, so no threshold.
    if (candidateKey.length > 0 && contentKey(priorText) === candidateKey) {
      return {
        method: "identical-content",
        score: 1,
        questionTitle: entry.questionTitle,
        sequenceNumber: entry.sequenceNumber,
      };
    }

    // Tier 2 — near-verbatim rewording.
    const score = lexicalSimilarity(candidateText, priorText);
    if (score >= LEXICAL_REPEAT_THRESHOLD && (!best || score > best.score)) {
      best = {
        method: "lexical",
        score,
        questionTitle: entry.questionTitle,
        sequenceNumber: entry.sequenceNumber,
      };
    }
  }

  return best;
}

/**
 * Decide whether a freshly generated question repeats an earlier one in the same
 * session. Never throws and never blocks on a provider indefinitely — a failure in
 * the embedding tier degrades to the lexical tiers, because a possibly-repeated
 * question is a far better outcome than a failed turn.
 */
export async function detectSemanticRepeat(params: {
  candidate: { questionTitle: string; questionDescription?: string | null };
  /** Session history — entries may carry a cached `embedding` from an earlier turn. */
  history: QuestionHistoryEntry[];
  /** Omitted in tests and when no embedding provider is configured. */
  embed?: EmbedTexts;
  embeddingThreshold?: number;
}): Promise<SemanticRepeatResult> {
  const history = selectComparableHistory(params.history);
  const candidateText = questionText(params.candidate);
  if (history.length === 0 || candidateText.trim().length === 0) {
    return { match: null, embedding: null, degraded: false };
  }

  const lexical = bestLexicalMatch(candidateText, history);
  if (lexical) return { match: lexical, embedding: null, degraded: false };

  if (!params.embed) return { match: null, embedding: null, degraded: true };

  // One batched request covering the candidate plus every prior question whose
  // embedding is not already cached on the session history.
  const uncached = history.filter((entry) => !entry.embedding?.length);
  let vectors: (number[] | null)[];
  try {
    vectors = await params.embed([candidateText, ...uncached.map((entry) => questionText(entry))]);
  } catch {
    vectors = [];
  }

  const candidateEmbedding = vectors[0] ?? null;
  if (!candidateEmbedding) return { match: null, embedding: null, degraded: true };

  const vectorsByEntry = new Map<QuestionHistoryEntry, number[] | null>();
  let next = 1;
  let degraded = false;
  for (const entry of history) {
    if (entry.embedding?.length) {
      vectorsByEntry.set(entry, entry.embedding);
      continue;
    }
    const vector = vectors[next++] ?? null;
    if (!vector) degraded = true;
    vectorsByEntry.set(entry, vector);
  }

  const threshold = params.embeddingThreshold ?? EMBEDDING_REPEAT_THRESHOLD;
  let best: RepeatMatch | null = null;
  for (const entry of history) {
    const vector = vectorsByEntry.get(entry);
    if (!vector) continue;
    const score = cosineSimilarity(candidateEmbedding, vector);
    if (!best || score > best.score) {
      best = {
        method: "embedding",
        score,
        questionTitle: entry.questionTitle,
        sequenceNumber: entry.sequenceNumber,
      };
    }
  }

  if (best && best.score >= threshold) {
    return { match: best, embedding: candidateEmbedding, degraded };
  }
  return { match: null, embedding: candidateEmbedding, degraded };
}
