// WebSocket payload types for every event in both directions.
// Field names and literal unions mirror the backend contract exactly.
// Import EVENT_VERSION and SOCKET_EVENTS from ../constants/socket-events — never inline strings.

import type { EVENT_VERSION } from "../constants/socket-events";
import type { BackendInterviewStatus } from "./api";

// ── Base ──────────────────────────────────────────────────────────────────────

interface WsBase {
  eventVersion: typeof EVENT_VERSION;
  event: string;
}

// ── Client → Server payloads ──────────────────────────────────────────────────

export interface JoinPayload extends WsBase {
  event: "interview:join";
  interviewId: string;
}

export interface LeavePayload extends WsBase {
  event: "interview:leave";
  interviewId: string;
}

export interface HeartbeatAckPayload extends WsBase {
  event: "heartbeat:ack";
}

export interface AnswerSubmitPayload extends WsBase {
  event: "answer:submit";
  interviewId: string;
  questionId: string;
  answerData: string;
  answerType: "TEXT" | "AUDIO" | "VIDEO";
}

export interface CodeSubmitPayload extends WsBase {
  event: "code:submit";
  interviewId: string;
  questionId: string;
  language: string;
  code: string;
}

export interface NextQuestionPayload extends WsBase {
  event: "question:next";
  interviewId: string;
}

export interface CancelPayload extends WsBase {
  event: "interview:cancel";
  interviewId: string;
}

// ── Server → Client payloads ──────────────────────────────────────────────────

export interface JoinedPayload extends WsBase {
  event: "interview:joined";
  interviewId: string;
  reconnected: boolean;
  timerStartedAt: string;
  durationMinutes: number;
}

export interface LeftPayload extends WsBase {
  event: "interview:left";
  interviewId: string;
}

export interface StateChangePayload extends WsBase {
  event: "interview:state_change";
  interviewId: string;
  status: BackendInterviewStatus;
  timestamp: string;
}

export interface QuestionDeliveredPayload extends WsBase {
  event: "question:delivered";
  interviewId: string;
  questionId: string;
  sequenceNumber: number;
  totalQuestions: number | null;
  questionTitle: string;
  questionDescription?: string | null;
  questionType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  deliveredAt: string;
  timeoutSeconds: number;
}

export interface AiStatusPayload extends WsBase {
  event: "ai:status";
  interviewId: string;
  questionId: string;
  stage: "thinking" | "generating" | "evaluating";
  timestamp: string;
}

export interface EvaluationFeedbackPayload extends WsBase {
  event: "evaluation:feedback";
  interviewId: string;
  questionId: string;
  answerId: string;
  score: number;
  correctness: number;
  relevance: number;
  clarity: number;
  technicalDepth: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  timestamp: string;
}

export interface TimerExpiredPayload extends WsBase {
  event: "timer:expired";
  interviewId: string;
  expiredAt: string;
}

export interface HeartbeatPingPayload extends WsBase {
  event: "heartbeat:ping";
  timestamp: string;
}

export interface WsErrorPayload extends WsBase {
  event: "ws:error";
  code:
    | "AUTH_UNAUTHORIZED"
    | "AUTH_SESSION_EXPIRED"
    | "AUTH_FORBIDDEN"
    | "INTERVIEW_NOT_FOUND"
    | "INTERVIEW_INVALID_STATE"
    | "QUESTION_NOT_FOUND"
    | "ANSWER_REJECTED"
    | "CONTEXT_MISSING"
    | "INTERNAL_ERROR";
  message: string;
  interviewId?: string;
  timestamp: string;
}
