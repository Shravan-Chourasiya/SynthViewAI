// ── Adaptation Decision Engine ────────────────────────────────────────────────
// Pure function — given performance state, pattern detections, interview config,
// and question history, returns a concrete AdaptationDecision.
//
// Every decision includes a human-readable `reason` for the audit trail.
// The engine is deterministic: same inputs → same output, always.
//
// Constraints enforced:
//   - Never escalate past the interview's configured max difficulty
//   - Never change topics if the interview type is BEHAVIORAL (single-topic)
//   - Probe-further is capped at maxFollowUps to prevent infinite probing
//   - Early termination only when conditions are unambiguous
//   - The configured duration is a hard ceiling: once elapsed time reaches it the
//     interview ends regardless of score (see computeAdaptation below)

import type { CandidatePerformanceState } from "./performance.state.js";
import type { PatternDetection } from "./detection.js";
import type { QuestionHistoryEntry } from "../ai.graph.types.js";
import type { InterviewConfig } from "../../../modules/interview/types/interview.context.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdaptationAction =
  | "follow_up" // ask a follow-up on the same topic/difficulty
  | "harder" // escalate difficulty
  | "easier" // de-escalate difficulty
  | "new_topic" // pivot to a different topic
  | "terminate"; // end the interview early

export interface AdaptationHint {
  mode: "initial" | "follow_up" | "topic_change"; // maps to InterviewerMode
  difficulty: "EASY" | "MEDIUM" | "HARD";
  topicHint?: string; // passed to the prompt when changing topics
  // Set inside the wrap-up window (soft duration threshold) so the prompt asks a
  // closing question on the current line instead of opening a new one.
  wrapUp?: boolean;
}

export interface AdaptationDecision {
  action: AdaptationAction;
  reason: string; // human-readable, stored in audit trail
  hint: AdaptationHint; // passed to the next question generator
  decidedAt: string; // ISO-8601 timestamp
}

// ── Difficulty ladder ─────────────────────────────────────────────────────────

type Difficulty = "EASY" | "MEDIUM" | "HARD";

const DIFFICULTY_ORDER: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

function escalate(d: Difficulty): Difficulty {
  const idx = DIFFICULTY_ORDER.indexOf(d);
  return DIFFICULTY_ORDER[Math.min(idx + 1, DIFFICULTY_ORDER.length - 1)] ?? d;
}

function deescalate(d: Difficulty): Difficulty {
  const idx = DIFFICULTY_ORDER.indexOf(d);
  return DIFFICULTY_ORDER[Math.max(idx - 1, 0)] ?? d;
}

// ── Thresholds ────────────────────────────────────────────────────────────────

const STRONG_STREAK_FOR_ESCALATION = 2; // consecutive strong answers → harder
const WEAK_STREAK_FOR_DEESCALATION = 2; // consecutive weak answers → easier or new_topic
const WEAK_STREAK_FOR_TOPIC_CHANGE = 3; // sustained weakness → new_topic
const EARLY_TERM_WEAK_STREAK = 5; // sustained inability to progress → terminate
const EARLY_TERM_COVERAGE_RATIO = 0.85; // 85% of duration covered + strong avg → terminate
// Soft duration threshold: past this share of the configured duration the session
// stops branching out (no new topics, no escalation) and starts wrapping up.
const WRAP_UP_RATIO = 0.9;

/** Minutes elapsed since the interview started. */
export function elapsedMinutesSince(
  timerStartedAt: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!timerStartedAt) return 0;
  const startedMs = new Date(timerStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return 0;
  const elapsed = (now.getTime() - startedMs) / 60_000;
  return elapsed > 0 ? elapsed : 0;
}

/** Configured duration in minutes, or 0 when unset/invalid (no ceiling). */
function durationMinutesOf(config: InterviewConfig): number {
  return Number.isFinite(config.durationMinutes) && config.durationMinutes > 0
    ? config.durationMinutes
    : 0;
}

// ── Decision chain (private) ──────────────────────────────────────────────────
// The rule order below is the engine's contract and must stay stable. Duration
// enforcement is layered around it by computeAdaptation() at the end of this file,
// not woven into the individual branches.

function decideAdaptation(
  state: CandidatePerformanceState,
  detection: PatternDetection,
  config: InterviewConfig,
  history: QuestionHistoryEntry[],
): AdaptationDecision {
  const now = new Date().toISOString();
  const difficulty = state.currentDifficulty;
  const canEscalate = escalate(difficulty) !== difficulty;
  const canDeescalate = deescalate(difficulty) !== difficulty;

  // Topics can only change for TECHNICAL or MIXED interviews
  const canChangeTopic = config.interviewType !== "BEHAVIORAL";

  // ── 1. Early termination — sustained inability to progress ────────────────
  if (state.weakStreak >= EARLY_TERM_WEAK_STREAK) {
    return {
      action: "terminate",
      reason: `Candidate has not progressed after ${state.weakStreak} consecutive weak answers — ending interview early`,
      hint: { mode: "follow_up", difficulty },
      decidedAt: now,
    };
  }

  // ── 2. Early termination — coverage achieved + strong performance ─────────
  // Only applies to QUESTION_COUNT sessions, which explicitly opt into a question
  // target. A DURATION session must run to its configured duration (that is what
  // the candidate chose), so the estimate-based heuristic must not end it early —
  // the hard duration cutoff in computeAdaptation() leads there instead.
  if ((config.endingCriteria ?? "DURATION") === "QUESTION_COUNT") {
    const totalAnswered = state.answeredCount;
    const estimatedTotal = Math.floor(durationMinutesOf(config) / 5); // ~1 question per 5 min
    const coverageRatio = estimatedTotal > 0 ? totalAnswered / estimatedTotal : 0;
    if (coverageRatio >= EARLY_TERM_COVERAGE_RATIO && state.averageScore >= 75) {
      return {
        action: "terminate",
        reason: `Interview coverage at ${Math.round(coverageRatio * 100)}% with strong average score ${state.averageScore} — ending early`,
        hint: { mode: "follow_up", difficulty },
        decidedAt: now,
      };
    }
  }

  // ── 3. Vague/incomplete — probe further (capped at maxFollowUps) ──────────
  if ((detection.vague || detection.incomplete) && state.probeCount < config.maxFollowUps) {
    const signal = detection.vague ? "vague" : "incomplete";
    return {
      action: "follow_up",
      reason: `Answer was ${signal} — probing further (probe ${state.probeCount + 1}/${config.maxFollowUps})`,
      hint: { mode: "follow_up", difficulty },
      decidedAt: now,
    };
  }

  // ── 4. Vague/incomplete — probe limit reached, move on ───────────────────
  if ((detection.vague || detection.incomplete) && state.probeCount >= config.maxFollowUps) {
    if (canChangeTopic) {
      return {
        action: "new_topic",
        reason: `Probe limit (${config.maxFollowUps}) reached on vague/incomplete answers — moving to new topic`,
        hint: { mode: "topic_change", difficulty },
        decidedAt: now,
      };
    }
    return {
      action: "follow_up",
      reason: `Probe limit reached but topic change not allowed for ${config.interviewType} — continuing with follow-up`,
      hint: { mode: "follow_up", difficulty },
      decidedAt: now,
    };
  }

  // ── 5. Off-topic — always move on (don't probe an off-topic answer) ───────
  if (detection.offTopic) {
    if (canChangeTopic) {
      return {
        action: "new_topic",
        reason: "Answer was off-topic — pivoting to a new topic",
        hint: { mode: "topic_change", difficulty },
        decidedAt: now,
      };
    }
    return {
      action: "follow_up",
      reason: "Answer was off-topic — asking a clearer follow-up",
      hint: { mode: "follow_up", difficulty },
      decidedAt: now,
    };
  }

  // ── 6. Strong area — escalate difficulty ─────────────────────────────────
  if (detection.strongArea && state.strongStreak >= STRONG_STREAK_FOR_ESCALATION) {
    if (canEscalate) {
      const newDiff = escalate(difficulty);
      return {
        action: "harder",
        reason: `${detection.reasons.strongArea ?? "Strong performance"} — escalating to ${newDiff}`,
        hint: { mode: "follow_up", difficulty: newDiff },
        decidedAt: now,
      };
    }
    // Already at max difficulty — change topic to keep it interesting
    if (canChangeTopic) {
      return {
        action: "new_topic",
        reason: `Strong performance but already at max difficulty (${difficulty}) — changing topic`,
        hint: { mode: "topic_change", difficulty },
        decidedAt: now,
      };
    }
  }

  // ── 7. Weak area — de-escalate or change topic ────────────────────────────
  if (detection.weakArea) {
    if (state.weakStreak >= WEAK_STREAK_FOR_TOPIC_CHANGE && canChangeTopic) {
      return {
        action: "new_topic",
        reason: `${detection.reasons.weakArea ?? "Weak performance"} — changing topic after ${state.weakStreak} weak answers`,
        hint: {
          mode: "topic_change",
          difficulty: canDeescalate ? deescalate(difficulty) : difficulty,
        },
        decidedAt: now,
      };
    }
    if (state.weakStreak >= WEAK_STREAK_FOR_DEESCALATION && canDeescalate) {
      const newDiff = deescalate(difficulty);
      return {
        action: "easier",
        reason: `${detection.reasons.weakArea ?? "Weak performance"} — de-escalating to ${newDiff}`,
        hint: { mode: "follow_up", difficulty: newDiff },
        decidedAt: now,
      };
    }
  }

  // ── 8. Default — follow-up at current difficulty ──────────────────────────
  return {
    action: "follow_up",
    reason: "No significant pattern detected — continuing with follow-up at current difficulty",
    hint: { mode: "follow_up", difficulty },
    decidedAt: now,
  };
}

// ── Wrap-up bias ──────────────────────────────────────────────────────────────
/**
 * Soft duration threshold behaviour: in the final stretch the session converges
 * instead of branching. A topic change becomes a follow-up on the current
 * question, difficulty never escalates, and the hint carries wrapUp so the prompt
 * asks a closing question rather than opening a new line of questioning.
 */
function applyWrapUp(
  decision: AdaptationDecision,
  currentDifficulty: Difficulty,
  elapsedMinutes: number,
  durationMinutes: number,
): AdaptationDecision {
  // Termination is never softened — if the session must end, it ends.
  if (decision.action === "terminate") return decision;

  const stayingOnTopic = decision.action !== "new_topic";
  const hintDifficulty =
    DIFFICULTY_ORDER.indexOf(decision.hint.difficulty) <=
    DIFFICULTY_ORDER.indexOf(currentDifficulty)
      ? decision.hint.difficulty
      : currentDifficulty;
  // A "harder" decision whose escalation we just clamped down to the current
  // difficulty is a follow-up in practice — label it honestly for the audit trail.
  const suppressedEscalation =
    decision.action === "harder" && hintDifficulty === currentDifficulty;
  const window = `${Math.floor(elapsedMinutes)}/${durationMinutes} min`;

  return {
    ...decision,
    action: stayingOnTopic && !suppressedEscalation ? decision.action : "follow_up",
    reason: !stayingOnTopic
      ? `Wrap-up window (${window}) — finishing the current question instead of changing topic (${decision.reason})`
      : suppressedEscalation
        ? `Wrap-up window (${window}) — holding difficulty at ${hintDifficulty} instead of escalating (${decision.reason})`
        : `Wrap-up window (${window}) — ${decision.reason}`,
    hint: {
      mode: "follow_up",
      difficulty: hintDifficulty,
      ...(decision.hint.topicHint && stayingOnTopic ? { topicHint: decision.hint.topicHint } : {}),
      wrapUp: true,
    },
  };
}

// ── computeAdaptation ─────────────────────────────────────────────────────────
// Public entry point, layered as:
//   1. the hard duration ceiling — score-independent, terminal;
//   2. the decision chain above (unchanged rule order);
//   3. the wrap-up bias once the session has used ~90% of its duration.
export function computeAdaptation(
  state: CandidatePerformanceState,
  detection: PatternDetection,
  config: InterviewConfig,
  history: QuestionHistoryEntry[],
  elapsedMinutes: number,
): AdaptationDecision {
  const durationMinutes = durationMinutesOf(config);
  const elapsed = Number.isFinite(elapsedMinutes) && elapsedMinutes > 0 ? elapsedMinutes : 0;

  // ── Hard duration cutoff — takes priority over every other rule ───────────
  // Reaching the configured duration ends the interview regardless of score,
  // streaks or remaining coverage. It applies to both endingCriteria modes:
  // QUESTION_COUNT sessions keep their question target and get this as a ceiling,
  // and DURATION sessions end exactly here.
  if (durationMinutes > 0 && elapsed >= durationMinutes) {
    return {
      action: "terminate",
      reason: `Configured interview duration reached — ${Math.floor(elapsed)} of ${durationMinutes} minute(s) elapsed`,
      hint: { mode: "follow_up", difficulty: state.currentDifficulty },
      decidedAt: new Date().toISOString(),
    };
  }

  const decision = decideAdaptation(state, detection, config, history);

  return durationMinutes > 0 && elapsed >= durationMinutes * WRAP_UP_RATIO
    ? applyWrapUp(decision, state.currentDifficulty, elapsed, durationMinutes)
    : decision;
}
