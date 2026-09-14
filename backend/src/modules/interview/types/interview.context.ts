// Shape of the in-memory interview session stored in Redis.
// Key: interview:context:{interviewId}   TTL: interviewDuration + 10 min buffer

import type {
  CandidatePerformanceState,
  AdaptationDecision,
  AdaptationHint,
} from "../../../integrations/ai/adaptive/index.js";

export type { CandidatePerformanceState, AdaptationDecision, AdaptationHint };

export interface InterviewConfig {
  interviewType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  interviewStyle: "MANGOS" | "FAANG" | "MAANG" | "STARTUP" | "CUSTOM" | "REGULAR";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  durationMinutes: number;
  maxFollowUps: number;
  endingCriteria?: "QUESTION_COUNT" | "DURATION";
  questionCount?: number;
  jobRole?: string;
  domain?: string;
  targetedCompany?: string;
  jobSkills?: string[];
}

export interface CandidateIdentity {
  userId: string;
  experience: string;
}

export interface QuestionState {
  currentIndex: number; // 0-based, incremented as questions are served
  totalQuestions: number | null; // null until the AI engine resolves the count
  currentQuestionId: string | null; // DB UUID of the question the candidate is answering right now
}

// LangGraph thread reference — stored once on session start, passed back on every AI call
export interface AiContext {
  threadId: string;
}

export interface InterviewContext {
  interviewId: string;
  candidateIdentity: CandidateIdentity;
  config: InterviewConfig;
  questionState: QuestionState;
  timerStartedAt: string; // ISO-8601, stamped once on start
  aiContext: AiContext;
  performanceState: CandidatePerformanceState;
  adaptationHistory: AdaptationDecision[]; // one entry per question, for audit
  // Set after each adaptation decision; consumed (and cleared) by the next
  // generateAndDeliverQuestionService call so the hint survives a lookahead miss.
  pendingAdaptationHint?: AdaptationHint;
}
