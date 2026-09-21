// ── Interview LangGraph ───────────────────────────────────────────────────────
// Real node implementations for the interview graph.
//
//   router     — detects operation + sub-mode, sets routingDecision + routingMetadata
//   interviewer — builds prompt, calls model, checks for repetition
//   evaluator  — builds prompt, calls model, handles edge cases
//
// The graph is compiled once at module load and reused across all invocations.

import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { InterviewGraphAnnotation } from "./graph.state.js";
import type {
  InterviewGraphState,
  InterviewerMode,
  RoutingMetadata,
  DetectionSignal,
  QuestionHistoryEntry,
  GeneratedQuestionShape,
} from "./graph.state.js";
import { callGenerateWithFallback, callEvaluateWithFallback } from "./provider.js";
import { buildInterviewerPrompt, buildEvaluatorPrompt } from "./prompts.js";
import { trimHistory } from "./context.manager.js";
import {
  normalizeTitle,
  resolveQuestionCategory,
  summarizeCategoryMix,
  topicTagFromTitle,
} from "./coverage.js";
import type { QuestionCategory } from "./coverage.js";
import { detectSemanticRepeat } from "./similarity.js";
import type { RepeatMatch } from "./similarity.js";
import { embedTexts } from "./embeddings.js";
import { logger } from "../../utils/logger.js";

// ── Node: router ──────────────────────────────────────────────────────────────
// Reads currentInput.operation and history to determine:
//   - Which node to invoke (interviewer / evaluator / end)
//   - The sub-mode for the interviewer (initial / follow_up / topic_change)
//
// Malformed state (null currentInput, unknown operation) → route to "end"
// with mode "fallback" — never throws, never crashes the graph.

async function routerNode(state: InterviewGraphState): Promise<Partial<InterviewGraphState>> {
  const op = state.currentInput?.operation;

  if (!op || (op !== "generate" && op !== "evaluate" && op !== "end")) {
    const metadata: RoutingMetadata = {
      mode: "fallback",
      reason: `Malformed or missing operation: ${String(op)}`,
    };
    logger.warn(
      { interviewId: state.interviewId, op },
      "[graph] router — malformed state, routing to end",
    );
    return { routingDecision: "end", routingMetadata: metadata };
  }

  if (op === "end") {
    const metadata: RoutingMetadata = { mode: "end", reason: "Session end requested" };
    return { routingDecision: "end", routingMetadata: metadata };
  }

  if (op === "evaluate") {
    const metadata: RoutingMetadata = {
      mode: "evaluate",
      reason: "Answer submitted for evaluation",
    };
    logger.info({ interviewId: state.interviewId }, "[graph] router → evaluator");
    return { routingDecision: "evaluator", routingMetadata: metadata };
  }

  // op === "generate" — determine sub-mode
  // If the adaptive engine provided a hint, use it directly.
  const hint = state.currentInput?.adaptationHint;
  if (hint) {
    const metadata: RoutingMetadata = {
      mode: hint.mode,
      reason: `Adaptive engine decision: ${hint.mode} at ${hint.difficulty}${
        hint.topicHint ? ` (topic: ${hint.topicHint})` : ""
      }`,
    };
    logger.info(
      { interviewId: state.interviewId, mode: hint.mode, difficulty: hint.difficulty },
      "[graph] router → interviewer (adaptive)",
    );
    return { routingDecision: "interviewer", routingMetadata: metadata };
  }

  const answeredCount = state.questionHistory.filter(
    (h: QuestionHistoryEntry) => h.wasAnswered,
  ).length;
  const totalAsked = state.questionHistory.length;

  let mode: InterviewerMode;
  let reason: string;

  if (totalAsked === 0) {
    mode = "initial";
    reason = "No questions asked yet — generating opening question";
  } else if (state.currentInput?.sequenceNumber !== undefined && answeredCount > 0) {
    // If the adaptive engine sets a topic_change flag in the future, it will
    // pass it via currentInput. For now, follow_up is the default after the first question.
    mode = "follow_up";
    reason = `Follow-up after ${answeredCount} answered question(s)`;
  } else {
    mode = "follow_up";
    reason = "Continuing interview";
  }

  const metadata: RoutingMetadata = { mode, reason };
  logger.info({ interviewId: state.interviewId, mode, reason }, "[graph] router → interviewer");
  return { routingDecision: "interviewer", routingMetadata: metadata };
}

// ── Node: interviewer ─────────────────────────────────────────────────────────
// Generates the next question. Three quality guards run against session history:
//   - repetition: an already-asked question title must not be returned again
//   - semantic repetition: a reworded repeat of an earlier question is rejected
//     too — a title comparison cannot see one, so this guard compares meaning via
//     similarity.ts, and it is the reason this node's guard is async
//   - type balance: in a MIXED interview the question must use the category the
//     mix requires (behavioural vs technical), so the session really alternates
// Any guard triggers one retry with the rejected question added to the avoid list,
// then the result is accepted — a turn is never failed over question quality.
//
// Guards run cheapest-first: the title and category checks cost nothing locally, so
// only a question that clears them pays for an embedding call.
//
// Session history comes from two places, deliberately:
//   - priorQuestions: the persisted rows the interview module hands in (ordered,
//     and restart-safe) — the source for counts and the avoid-list
//   - questionHistory: what this graph remembers, which is the ONLY place the
//     generated subdomain tags AND question embeddings exist (neither is persisted
//     to Postgres, because the rows the interview module hands back carry titles)

const MAX_QUESTION_RETRIES = 1;

/** Why a generated question was rejected — drives logging and the retry prompt. */
type GuardFailure = "repetition" | "question-type-imbalance" | "semantic-repetition";

interface GuardContext {
  /** Normalised titles already asked this session. */
  askedTitles: Set<string>;
  /** Category a MIXED session must use next, or null when either is acceptable. */
  requiredCategory: QuestionCategory | null;
  /** History the semantic check compares against — includes questions rejected this turn. */
  comparisonHistory: QuestionHistoryEntry[];
}

interface GuardVerdict {
  failure: GuardFailure | null;
  /** Set when the failure is a semantic repeat — which earlier question, and how close. */
  match: RepeatMatch | null;
  /** The candidate's embedding, cached on the accepted question for later turns. */
  embedding: number[] | null;
  /** True when embeddings were needed but unavailable, so only lexical tiers ran. */
  degraded: boolean;
}

/**
 * Run all three guards against one candidate question. Never throws: the semantic
 * tier degrades to its lexical fallback rather than failing the turn.
 */
async function assessQuestion(
  candidate: GeneratedQuestionShape,
  context: GuardContext,
): Promise<GuardVerdict> {
  const clean: GuardVerdict = { failure: null, match: null, embedding: null, degraded: false };

  if (context.askedTitles.has(normalizeTitle(candidate.questionTitle))) {
    return { ...clean, failure: "repetition" };
  }

  if (context.requiredCategory !== null && candidate.questionType !== context.requiredCategory) {
    return { ...clean, failure: "question-type-imbalance" };
  }

  const result = await detectSemanticRepeat({
    candidate: {
      questionTitle: candidate.questionTitle,
      questionDescription: candidate.questionDescription,
    },
    history: context.comparisonHistory,
    embed: embedTexts,
  });

  return {
    failure: result.match ? "semantic-repetition" : null,
    match: result.match,
    embedding: result.embedding,
    degraded: result.degraded,
  };
}

/**
 * Guard-rejection log fields. Repetition failures carry what they collided with and
 * how close the two were, so a threshold can be tuned from real transcripts.
 */
function rejectionLog(
  verdict: GuardVerdict,
  candidate: GeneratedQuestionShape,
  requiredCategory: QuestionCategory | null,
): Record<string, unknown> {
  return {
    reason: verdict.failure,
    title: candidate.questionTitle,
    questionType: candidate.questionType,
    requiredCategory,
    ...(verdict.match
      ? {
          similarTo: verdict.match.questionTitle,
          similarity: Number(verdict.match.score.toFixed(3)),
          similarityMethod: verdict.match.method,
        }
      : {}),
  };
}

async function interviewerNode(state: InterviewGraphState): Promise<Partial<InterviewGraphState>> {
  const mode = (state.routingMetadata?.mode ?? "follow_up") as InterviewerMode;
  // Use adaptive hint difficulty if provided, otherwise use state difficulty
  const hint = state.currentInput?.adaptationHint;
  const effectiveDiff = hint?.difficulty ?? state.difficulty;
  const providerName = "groq";

  // Subdomain tags and question embeddings issued earlier in this session, keyed by
  // normalised title so they can be re-attached to the persisted rows. Both are
  // session-only artefacts of this graph, which is why they are re-attached here
  // instead of being expected on the priorQuestions rows.
  const topicByTitle = new Map<string, string>();
  const embeddingByTitle = new Map<string, number[]>();
  for (const entry of state.questionHistory) {
    const title = normalizeTitle(entry.questionTitle);
    if (entry.topic) topicByTitle.set(title, entry.topic);
    if (entry.embedding?.length) embeddingByTitle.set(title, entry.embedding);
  }

  // Restart-safe history when the caller supplied it; otherwise fall back to the
  // graph's own memory so the guards still work for direct graph callers.
  const sessionHistory: QuestionHistoryEntry[] =
    state.priorQuestions.length > 0
      ? state.priorQuestions.map((q, index) => {
          const title = normalizeTitle(q.questionTitle);
          const topic = topicByTitle.get(title);
          const embedding = embeddingByTitle.get(title);
          return {
            questionId: `prior-${index + 1}`,
            questionTitle: q.questionTitle,
            questionType: q.questionType,
            ...(topic ? { topic } : {}),
            ...(embedding ? { embedding } : {}),
            sequenceNumber: index + 1,
            wasAnswered: q.wasAnswered,
            score: null,
          };
        })
      : state.questionHistory;

  const trimmedHistory = trimHistory(sessionHistory, providerName);

  // The category this question must use — null when either is acceptable.
  const requiredCategory =
    state.interviewType === "MIXED" ? summarizeCategoryMix(sessionHistory).requiredCategory : null;

  const sequenceNumber = state.currentInput?.sequenceNumber ?? sessionHistory.length + 1;

  const input = {
    interviewId: state.interviewId,
    config: {
      interviewType: state.interviewType,
      interviewStyle: state.interviewStyle,
      difficulty: effectiveDiff,
      durationMinutes: state.durationMinutes,
      maxFollowUps: state.maxFollowUps,
      ...(state.jobRole ? { jobRole: state.jobRole } : {}),
      ...(state.jobSkills.length ? { jobSkills: state.jobSkills } : {}),
    },
    sequenceNumber,
    previousQuestions: trimmedHistory.map((h: QuestionHistoryEntry) => ({
      questionTitle: h.questionTitle,
      questionType: h.questionType,
      wasAnswered: h.wasAnswered,
    })),
  };

  const askedTitles = new Set(sessionHistory.map((h) => normalizeTitle(h.questionTitle)));

  // Questions a guard rejected during THIS turn. They serve two purposes: they go
  // into the retry prompt's avoid list, and they join the comparison history so a
  // retry cannot simply hand back a near-duplicate of what was just rejected.
  const rejected: QuestionHistoryEntry[] = [];
  const guardContext: GuardContext = {
    askedTitles,
    requiredCategory,
    comparisonHistory: sessionHistory,
  };

  const recordRejection = (candidate: GeneratedQuestionShape, verdict: GuardVerdict): void => {
    rejected.push({
      questionId: `guard-reject-${rejected.length + 1}`,
      questionTitle: candidate.questionTitle,
      questionType: candidate.questionType,
      sequenceNumber,
      wasAnswered: false,
      score: null,
      ...(verdict.embedding?.length ? { embedding: verdict.embedding } : {}),
    });
    // A rejected title is now off-limits by title too — the cheap check catches a
    // verbatim repeat of it without another embedding call.
    guardContext.askedTitles.add(normalizeTitle(candidate.questionTitle));
    guardContext.comparisonHistory = [...sessionHistory, ...rejected];
  };

  let prompt = buildInterviewerPrompt(state, mode, trimmedHistory, hint ?? null, sessionHistory);
  let generated = await callGenerateWithFallback(prompt, input);
  let verdict = await assessQuestion(generated, guardContext);

  if (verdict.failure) {
    logger.warn(
      { interviewId: state.interviewId, ...rejectionLog(verdict, generated, requiredCategory) },
      "[graph] interviewer — rejected question, retrying",
    );

    for (let i = 0; i < MAX_QUESTION_RETRIES; i++) {
      // Re-build the prompt with every rejected question in the avoid list so the
      // retry cannot hand back the same title, the same theme, or the same category.
      recordRejection(generated, verdict);
      const extendedHistory: QuestionHistoryEntry[] = [...sessionHistory, ...rejected];
      prompt = buildInterviewerPrompt(
        state,
        mode,
        trimHistory(extendedHistory, providerName),
        hint ?? null,
        extendedHistory,
      );
      generated = await callGenerateWithFallback(prompt, input);
      verdict = await assessQuestion(generated, guardContext);
      if (!verdict.failure) break;
    }

    // Guard exhaustion: accept the degraded result rather than crashing the turn —
    // the candidate sees a repeat or a less even mix instead of a broken session.
    // The next turn recomputes the balance from history, so the mix self-corrects.
    if (verdict.failure) {
      logger.warn(
        { interviewId: state.interviewId, ...rejectionLog(verdict, generated, requiredCategory) },
        "[graph] interviewer — guard retry exhausted, accepting question",
      );
    }
  }

  if (verdict.degraded) {
    logger.warn(
      { interviewId: state.interviewId },
      "[graph] interviewer — semantic repetition check degraded to lexical similarity",
    );
  }

  // A MIXED session must record a real per-question category — see
  // resolveQuestionCategory for why the session-level "MIXED" is never recorded.
  const questionType = resolveQuestionCategory(
    state.interviewType,
    generated.questionType,
    requiredCategory,
  );
  if (state.interviewType === "MIXED" && generated.questionType !== questionType) {
    logger.warn(
      { interviewId: state.interviewId, title: generated.questionTitle },
      `[graph] interviewer — model did not type the question, recording ${questionType}`,
    );
  }

  const topic = generated.topic ?? topicTagFromTitle(generated.questionTitle);
  const recorded: GeneratedQuestionShape = { ...generated, questionType, topic };

  logger.info(
    { interviewId: state.interviewId, mode, title: recorded.questionTitle, questionType, topic },
    "[graph] interviewer — question generated",
  );

  return {
    generatedQuestion: recorded,
    // Remember what was asked (with its subdomain tag and its embedding) so the next
    // turn can avoid repeating the theme — including in different words. Session-
    // scoped by design: losing this checkpoint weakens repetition avoidance (the
    // next turn just re-embeds), it never breaks correctness.
    questionHistory: [
      {
        questionId: `generated-${sequenceNumber}`,
        questionTitle: recorded.questionTitle,
        questionType: recorded.questionType,
        ...(recorded.topic ? { topic: recorded.topic } : {}),
        ...(verdict.embedding?.length ? { embedding: verdict.embedding } : {}),
        sequenceNumber,
        wasAnswered: false,
        score: null,
      },
    ],
  };
}

// ── Node: evaluator ───────────────────────────────────────────────────────────
// Scores the candidate's answer. Handles edge cases before calling the model:
//   - Empty answer → score 0, signal "incomplete", skip model call
//   - Answer is a question back to the interviewer → signal "incomplete"
//   - Off-topic detection is left to the model (it has the question context)

const QUESTION_PATTERN =
  /^(what|how|why|when|where|who|can you|could you|would you|is it|are there|do you|does|did|will|should|shall)\b/i;

async function evaluatorNode(state: InterviewGraphState): Promise<Partial<InterviewGraphState>> {
  const answerData = state.currentInput?.answerData ?? "";
  const trimmed = answerData.trim();

  // Edge case: empty answer
  if (!trimmed) {
    logger.info({ interviewId: state.interviewId }, "[graph] evaluator — empty answer, scoring 0");
    return {
      evaluationResult: {
        score: 0,
        correctness: 0,
        relevance: 0,
        clarity: 0,
        technicalDepth: 0,
        feedback: "No answer was provided.",
        strengths: [],
        weaknesses: ["No answer provided"],
        detectionSignals: ["incomplete" as DetectionSignal],
      },
    };
  }

  // Edge case: answer is itself a question
  const isQuestion = QUESTION_PATTERN.test(trimmed) && trimmed.endsWith("?");
  const trimmedHistory = trimHistory(state.questionHistory, "groq");
  const prompt = buildEvaluatorPrompt(state, trimmedHistory);

  if (isQuestion) {
    // Still call the model — it may have useful feedback — but pre-inject the signal
    logger.info(
      { interviewId: state.interviewId },
      "[graph] evaluator — answer appears to be a question",
    );
    const result = await callEvaluateWithFallback(prompt, state.interviewId);
    const signals: DetectionSignal[] = Array.from(
      new Set<DetectionSignal>([...result.detectionSignals, "incomplete"]),
    );
    return { evaluationResult: { ...result, detectionSignals: signals } };
  }

  const result = await callEvaluateWithFallback(prompt, state.interviewId);
  logger.info(
    { interviewId: state.interviewId, score: result.score, signals: result.detectionSignals },
    "[graph] evaluator — answer scored",
  );
  return { evaluationResult: result };
}

// ── Conditional edge: after router ───────────────────────────────────────────

function routerEdge(state: InterviewGraphState): "interviewer" | "evaluator" | typeof END {
  if (state.routingDecision === "interviewer") return "interviewer";
  if (state.routingDecision === "evaluator") return "evaluator";
  return END;
}

// ── Graph assembly ────────────────────────────────────────────────────────────

const checkpointer = new MemorySaver();

const graph = new StateGraph(InterviewGraphAnnotation)
  .addNode("router", routerNode)
  .addNode("interviewer", interviewerNode)
  .addNode("evaluator", evaluatorNode)
  .addEdge(START, "router")
  .addConditionalEdges("router", routerEdge, ["interviewer", "evaluator", END])
  .addEdge("interviewer", END)
  .addEdge("evaluator", END);

/** Compiled graph — invoke via interviewGraph.invoke(state, { configurable: { thread_id } }) */
export const interviewGraph = graph.compile({ checkpointer });
