// ── LangGraph State Schema ────────────────────────────────────────────────────
// Defines the state that flows through the interview graph nodes.
//
// PERSISTENCE DECISION (explicit, not implicit):
//
//   Persisted to Redis (survives reconnects, written by interview.context.service):
//     - config, candidateExperience, threadId, questionHistory, performanceMetrics
//     These are the fields the graph needs to resume a session after a disconnect.
//
//   Recomputed each turn (ephemeral, lives only in the graph invocation):
//     - currentInput (the answer/request that triggered this turn)
//     - routingDecision (set by the Router node, consumed by the conditional edge)
//     - generatedQuestion / evaluationResult (outputs of Interviewer / Evaluator nodes)
//     These are never written back to Redis — they are produced fresh each invocation.
//
// The mapping functions at the bottom of this file are the ONLY place where
// "what the rest of the app hands in" is translated to/from "what graph nodes see".

// ── Re-export shared types (defined in ai.graph.types.ts, no LangGraph dep) ──

export type {
  QuestionHistoryEntry,
  PriorQuestion,
  PerformanceMetrics,
  GraphTurnInput,
  GeneratedQuestionShape,
  DetectionSignal,
  EvaluationResultShape,
  InterviewerMode,
  RoutingMetadata,
} from "./ai.graph.types.js";

import type {
  QuestionHistoryEntry,
  PriorQuestion,
  PerformanceMetrics,
  GraphTurnInput,
  GeneratedQuestionShape,
  EvaluationResultShape,
  RoutingMetadata,
} from "./ai.graph.types.js";

// ── LangGraph Annotation state ────────────────────────────────────────────────

import { Annotation } from "@langchain/langgraph";

const last = <T>(_prev: T, next: T): T => next;

export const InterviewGraphAnnotation = Annotation.Root({
  // ── Persisted fields ───────────────────────────────────────────────────────
  interviewId: Annotation<string>({ reducer: last<string>, default: () => "" }),
  threadId: Annotation<string>({ reducer: last<string>, default: () => "" }),
  interviewType: Annotation<"BEHAVIORAL" | "TECHNICAL" | "MIXED">({
    reducer: last<"BEHAVIORAL" | "TECHNICAL" | "MIXED">,
    default: () => "MIXED" as const,
  }),
  interviewStyle: Annotation<"MANGOS" | "FAANG" | "MAANG" | "STARTUP" | "CUSTOM" | "REGULAR">({
    reducer: last<"MANGOS" | "FAANG" | "MAANG" | "STARTUP" | "CUSTOM" | "REGULAR">,
    default: () => "CUSTOM" as const,
  }),
  difficulty: Annotation<"EASY" | "MEDIUM" | "HARD">({
    reducer: last<"EASY" | "MEDIUM" | "HARD">,
    default: () => "MEDIUM" as const,
  }),
  durationMinutes: Annotation<number>({ reducer: last<number>, default: () => 30 }),
  maxFollowUps: Annotation<number>({ reducer: last<number>, default: () => 3 }),
  jobRole: Annotation<string | null>({ reducer: last<string | null>, default: () => null }),
  domain: Annotation<string | undefined>({ reducer: last<string | undefined>, default: () => undefined }),
  targetedCompany: Annotation<string | undefined>({ reducer: last<string | undefined>, default: () => undefined }),
  jobSkills: Annotation<string[]>({ reducer: last<string[]>, default: () => [] }),
  candidateExperience: Annotation<string>({ reducer: last<string>, default: () => "unknown" }),

  questionHistory: Annotation<QuestionHistoryEntry[]>({
    // Append-only: new entries are merged in, existing ones updated by questionId
    reducer: (
      prev: QuestionHistoryEntry[],
      next: QuestionHistoryEntry[],
    ): QuestionHistoryEntry[] => {
      const map = new Map(prev.map((e: QuestionHistoryEntry) => [e.questionId, e]));
      for (const entry of next) map.set(entry.questionId, entry);
      return Array.from(map.values());
    },
    default: () => [],
  }),

  // Session history handed in by modules/interview from the persisted
  // interview_questions rows. `last` is correct because the caller always sends
  // the complete, ordered list — which also makes repetition avoidance and the
  // behavioural/technical split survive a checkpoint loss. This is the graph's
  // only window onto what has already been asked, so it must stay in sync with
  // AiNextQuestionInput.previousQuestions.
  priorQuestions: Annotation<PriorQuestion[]>({
    reducer: last<PriorQuestion[]>,
    default: () => [],
  }),

  performanceMetrics: Annotation<PerformanceMetrics>({
    reducer: last<PerformanceMetrics>,
    default: () => ({
      averageScore: 0,
      answeredCount: 0,
      skippedCount: 0,
      timedOutCount: 0,
      topicsCovered: [],
    }),
  }),

  // ── Ephemeral fields (recomputed each turn, never written to Redis) ─────────
  currentInput: Annotation<GraphTurnInput | null>({
    reducer: last<GraphTurnInput | null>,
    default: () => null,
  }),
  routingMetadata: Annotation<RoutingMetadata | null>({
    reducer: last<RoutingMetadata | null>,
    default: () => null,
  }),
  routingDecision: Annotation<"interviewer" | "evaluator" | "end" | null>({
    reducer: last<"interviewer" | "evaluator" | "end" | null>,
    default: () => null,
  }),
  generatedQuestion: Annotation<GeneratedQuestionShape | null>({
    reducer: last<GeneratedQuestionShape | null>,
    default: () => null,
  }),
  evaluationResult: Annotation<EvaluationResultShape | null>({
    reducer: last<EvaluationResultShape | null>,
    default: () => null,
  }),
});

export type InterviewGraphState = typeof InterviewGraphAnnotation.State;

// ── Mapping functions ─────────────────────────────────────────────────────────
// These are the ONLY place where the module contract types (AiSessionInput,
// AiNextQuestionInput, AiEvaluateInput) are translated to/from graph state.
// Named explicitly so callers can't accidentally coerce shapes ad hoc.

import type {
  AiSessionInput,
  AiNextQuestionInput,
  AiEvaluateInput,
  AiNextQuestionResult,
  AiEvaluateResult,
} from "./ai.types.js";

/** Build the initial graph state from a startAiSession call. */
export function sessionInputToGraphState(
  input: AiSessionInput,
  threadId: string,
): Partial<InterviewGraphState> {
  return {
    interviewId: input.interviewId,
    threadId,
    interviewType: input.config.interviewType,
    interviewStyle: input.config.interviewStyle,
    difficulty: input.config.difficulty,
    durationMinutes: input.config.durationMinutes,
    maxFollowUps: input.config.maxFollowUps,
    jobRole: input.config.jobRole ?? null,
    domain: input.config.domain,
    targetedCompany: input.config.targetedCompany,
    jobSkills: input.config.jobSkills ?? [],
    candidateExperience: input.candidateExperience,
    questionHistory: [],
    performanceMetrics: {
      averageScore: 0,
      answeredCount: 0,
      skippedCount: 0,
      timedOutCount: 0,
      topicsCovered: [],
    },
    currentInput: { operation: "generate", sequenceNumber: 1 },
  };
}

/** Build the turn input for a generateNextQuestion call. */
export function nextQuestionInputToGraphState(
  input: AiNextQuestionInput,
): Partial<InterviewGraphState> {
  const adaptationHint = input.adaptationHint
    ? {
        mode: input.adaptationHint.mode,
        difficulty: input.adaptationHint.difficulty,
        ...(input.adaptationHint.topicHint ? { topicHint: input.adaptationHint.topicHint } : {}),
        ...(input.adaptationHint.wrapUp ? { wrapUp: input.adaptationHint.wrapUp } : {}),
      }
    : undefined;
  return {
    interviewId: input.interviewId,
    threadId: input.threadId,
    // Carry the session shape into graph state: without it the interviewer node
    // has no idea what was already asked, which is how MIXED sessions used to end
    // up all-technical and how identical questions slipped through.
    priorQuestions: input.previousQuestions.map((q) => ({
      questionTitle: q.questionTitle,
      questionType: q.questionType,
      wasAnswered: q.wasAnswered,
    })),
    currentInput: {
      operation: "generate",
      sequenceNumber: input.sequenceNumber,
      ...(adaptationHint ? { adaptationHint } : {}),
    },
  };
}

/** Build the turn input for an evaluateAnswer call. */
export function evaluateInputToGraphState(input: AiEvaluateInput): Partial<InterviewGraphState> {
  return {
    interviewId: input.interviewId,
    threadId: input.threadId,
    currentInput: {
      operation: "evaluate",
      answerData: input.answerData,
      answerType: input.answerType,
      questionTitle: input.questionTitle,
    },
  };
}

/** Extract the AiNextQuestionResult from completed graph state. */
export function graphStateToQuestionResult(state: InterviewGraphState): AiNextQuestionResult {
  if (!state.generatedQuestion) {
    throw new Error("Graph completed without producing a question");
  }
  return { question: state.generatedQuestion };
}

/** Extract the AiEvaluateResult from completed graph state. */
export function graphStateToEvaluationResult(state: InterviewGraphState): AiEvaluateResult {
  if (!state.evaluationResult) {
    throw new Error("Graph completed without producing an evaluation");
  }
  return state.evaluationResult;
}
