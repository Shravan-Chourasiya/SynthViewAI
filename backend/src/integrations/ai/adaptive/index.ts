// ── Adaptive Engine — Public Interface ───────────────────────────────────────
// Single import point for all adaptive engine types and functions.
// modules/interview imports from here; never from the sub-modules directly.

export type { CandidatePerformanceState, TopicScore } from "./performance.state.js";
export {
  initialPerformanceState,
  updatePerformanceState,
  updateSkipCount,
  updateTimeoutCount,
} from "./performance.state.js";

export type { PatternDetection } from "./detection.js";
export { detectPatterns } from "./detection.js";

export type { AdaptationAction, AdaptationHint, AdaptationDecision } from "./adaptation.js";
export { computeAdaptation, elapsedMinutesSince } from "./adaptation.js";
