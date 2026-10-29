// ── Shared AI sub-types ───────────────────────────────────────────────────────
// Plain TypeScript interfaces with no external dependencies.
// Imported by graph.state.ts, context.manager.ts, prompts.ts, and tests.
// Keeping these separate means tests never transitively load @langchain/langgraph.

import type { AnswerFormat } from "./answer-format.js";

export interface QuestionHistoryEntry {
  questionId: string;
  questionTitle: string;
  /**
   * Per-question category. For MIXED interviews the model returns the actual
   * category of each question, so this holds "BEHAVIORAL" | "TECHNICAL" instead
   * of echoing the session's overall MIXED type — that is what lets the prompt
   * count the split and alternate. "MIXED" is only expected on legacy rows
   * written before per-question typing existed.
   */
  questionType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  /** Short subdomain tag (e.g. "feature-store") used for topic-diversity checks. */
  topic?: string;
  /**
   * How this question was answered — prose or code. Carried in session history so
   * the one-in-three CODE quota can be counted without another database read.
   */
  answerFormat?: AnswerFormat | null;
  /**
   * Semantic vector for this question's text, used to catch a question that has
   * been asked again in different words (see similarity.ts). A per-session working
   * set only: it lives in the graph checkpoint for the duration of the interview
   * and is never written to Postgres — the persisted interview_questions rows the
   * interview module hands back carry titles, not vectors, so a cold session
   * simply re-embeds.
   */
  embedding?: number[];
  sequenceNumber: number;
  wasAnswered: boolean;
  score: number | null;
  /**
   * Truncated excerpt of the candidate's answer to this question, used by the
   * interviewer prompt to generate a grounded follow-up. Not persisted to
   * Postgres (same lifecycle as embedding/topic — session-scoped only).
   */
  answerExcerpt?: string;
}

/**
 * One previously asked question as handed in by modules/interview, sourced from
 * the persisted interview_questions rows. Deliberately without score/questionId:
 * this is the session-shape summary the graph needs to keep questions balanced
 * and non-repetitive, and it survives a graph checkpoint loss.
 */
export interface PriorQuestion {
  questionTitle: string;
  questionType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  wasAnswered: boolean;
  /**
   * Persisted answer format of this question. Optional so callers written before
   * the column existed still typecheck; an absent value counts as TEXT.
   */
  answerFormat?: AnswerFormat | null;
}

export interface PerformanceMetrics {
  averageScore: number;
  answeredCount: number;
  skippedCount: number;
  timedOutCount: number;
  topicsCovered: string[];
}

export interface GraphTurnInput {
  operation: "generate" | "evaluate" | "end";
  sequenceNumber?: number;
  answerData?: string;
  answerType?: "TEXT" | "AUDIO" | "VIDEO";
  /**
   * Format of the question being answered. The evaluator switches to the code
   * rubric when this is "CODE"; absent means prose.
   */
  answerFormat?: "TEXT" | "CODE";
  /** Language the code answer was written in, when known. */
  answerLanguage?: string | null;
  questionTitle?: string;
  endReason?: "COMPLETED" | "CANCELLED" | "ABANDONED" | "TIMED_OUT";
  // Adaptation hint — set by the adaptive engine, consumed by router + interviewer
  adaptationHint?: {
    mode: "initial" | "follow_up" | "topic_change";
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topicHint?: string;
  };
}

export interface GeneratedQuestionShape {
  questionTitle: string;
  questionDescription: string | null;
  /** Per-question category — see QuestionHistoryEntry.questionType. */
  questionType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  /** Short subdomain tag returned by the model, null/undefined when unavailable. */
  topic?: string | null;
  /**
   * Whether the candidate answers in prose or in a code editor. Absent means TEXT —
   * the graph always sets this explicitly once the session quota is applied.
   */
  answerFormat?: AnswerFormat;
  /** Suggested language for a CODE answer (e.g. "python"); null for TEXT questions. */
  codeLanguage?: string | null;
}

export type DetectionSignal = "strong" | "weak" | "vague" | "incomplete" | "off_topic" | "none";

export interface EvaluationResultShape {
  score: number;
  correctness: number;
  relevance: number;
  clarity: number;
  technicalDepth: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  detectionSignals: DetectionSignal[];
}

export type InterviewerMode = "initial" | "follow_up" | "topic_change";

export interface RoutingMetadata {
  mode: InterviewerMode | "evaluate" | "end" | "fallback";
  reason: string;
}
