// ── AI Integration Contract ───────────────────────────────────────────────────
// This file defines the stable shapes that the interview module depends on.
// The stub implementation returns these exact shapes; the real LangGraph
// implementation will satisfy the same interfaces — no migration needed.

import { z } from "zod";
import type { InterviewConfig } from "../../modules/interview/types/interview.context.js";

// ── Question generation (used by provider.ts / question.generator.ts) ─────────

export interface GenerateQuestionInput {
  interviewId: string;
  config: InterviewConfig;
  sequenceNumber: number;
  previousQuestions: PreviousQuestion[];
}

export interface PreviousQuestion {
  questionTitle: string;
  questionType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  wasAnswered: boolean;
}

export interface GeneratedQuestion {
  questionTitle: string;
  questionDescription: string | null;
  questionType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
}

// ── Module contract — the only surface modules/interview calls into ────────────
// These are the four operations the AI module exposes as plain async functions.
// modules/interview imports exclusively from integrations/ai/index.ts, which
// re-exports these types and the implementing functions.

// startAiSession — called once when an interview transitions to INPROGRESS.
// Returns a threadId that is stored in InterviewContext.aiContext and passed
// back on every subsequent call so the graph can resume the same thread.
export const aiSessionInputSchema = z.object({
  interviewId: z.string().uuid(),
  config: z.object({
    interviewType: z.enum(["BEHAVIORAL", "TECHNICAL", "MIXED"]),
    interviewStyle: z.enum(["MANGOS", "FAANG", "MAANG", "STARTUP", "CUSTOM", "REGULAR"]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    durationMinutes: z.number().int().positive(),
    maxFollowUps: z.number().int().nonnegative(),
    jobRole: z.string().optional(),
    domain: z.string().optional(),
    targetedCompany: z.string().optional(),
    jobSkills: z.array(z.string()).optional(),
  }),
  candidateExperience: z.string(),
});
export type AiSessionInput = z.infer<typeof aiSessionInputSchema>;

export interface AiSessionResult {
  threadId: string; // opaque ID — stored in Redis context, passed back on every call
}

// generateNextQuestion — called to produce the next question for the candidate.
export const aiNextQuestionInputSchema = z.object({
  interviewId: z.string().uuid(),
  threadId: z.string(),
  sequenceNumber: z.number().int().positive(),
  previousQuestions: z.array(
    z.object({
      questionTitle: z.string(),
      questionType: z.enum(["BEHAVIORAL", "TECHNICAL", "MIXED"]),
      wasAnswered: z.boolean(),
    }),
  ),
  adaptationHint: z
    .object({
      mode: z.enum(["initial", "follow_up", "topic_change"]),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
      topicHint: z.string().optional(),
    })
    .optional(),
});
export type AiNextQuestionInput = z.infer<typeof aiNextQuestionInputSchema>;

export interface AiNextQuestionResult {
  question: GeneratedQuestion;
}

// evaluateAnswer — called after an answer is persisted (never for timed-out answers).
export const aiEvaluateInputSchema = z.object({
  interviewId: z.string().uuid(),
  threadId: z.string(),
  questionId: z.string().uuid(),
  answerId: z.string().uuid(),
  questionTitle: z.string(),
  answerData: z.string(),
  answerType: z.enum(["TEXT", "AUDIO", "VIDEO"]),
});
export type AiEvaluateInput = z.infer<typeof aiEvaluateInputSchema>;

import type { DetectionSignal } from "./graph.state.js";

export interface AiEvaluateResult {
  score: number; // 0–100
  correctness: number;
  relevance: number;
  clarity: number;
  technicalDepth: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  detectionSignals: DetectionSignal[];
}

// ── Output validation schemas ─────────────────────────────────────────────────
// Used to validate raw LLM JSON before it reaches adaptive logic, persistence,
// or downstream graph nodes. Validation failure throws MALFORMED_RESPONSE so
// the existing provider fallback loop retries/cycles — no second fallback system.

export const generatedQuestionSchema = z.object({
  questionTitle: z.string().min(1),
  questionDescription: z.string().nullable(),
  questionType: z.enum(["BEHAVIORAL", "TECHNICAL", "MIXED"]),
});

const detectionSignalSchema = z.enum([
  "strong",
  "weak",
  "vague",
  "incomplete",
  "off_topic",
  "none",
]);

export const aiEvaluateResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  correctness: z.number().int().min(0).max(100),
  relevance: z.number().int().min(0).max(100),
  clarity: z.number().int().min(0).max(100),
  technicalDepth: z.number().int().min(0).max(100),
  feedback: z.string().min(1),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  detectionSignals: z.array(detectionSignalSchema).min(1),
});

// endAiSession — called when the interview reaches a terminal state.
// Allows the graph to flush any pending state / LangSmith traces.
export const aiEndSessionInputSchema = z.object({
  interviewId: z.string().uuid(),
  threadId: z.string(),
  reason: z.enum(["COMPLETED", "CANCELLED", "ABANDONED", "TIMED_OUT"]),
});
export type AiEndSessionInput = z.infer<typeof aiEndSessionInputSchema>;
