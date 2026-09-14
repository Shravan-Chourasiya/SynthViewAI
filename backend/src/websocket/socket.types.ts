import type { Server, Socket } from "socket.io";

// ── Protocol version ──────────────────────────────────────────────────────────
// Bump this when a breaking change is made to any event shape.
// Both sides must agree on the version; mismatches should be surfaced as errors.
export const EVENT_VERSION = 1 as const;
export type EventVersion = typeof EVENT_VERSION;

// ── Shared base ───────────────────────────────────────────────────────────────
// Every payload (in both directions) carries these two fields so the receiver
// can always identify the event type and protocol version without inspecting
// the Socket.IO event name string.
interface BasePayload {
  eventVersion: EventVersion;
  event: string;
}

// ── Dedicated error shape ─────────────────────────────────────────────────────
// Errors are ALWAYS emitted on the "ws:error" event name — never mixed into the
// normal event stream — so the client can distinguish failures from state updates
// with a single event-name check rather than inspecting payload fields.
//
// code    — machine-readable, matches ErrorCodes constants where applicable
// message — human-readable, for logging / dev UI only; do not branch on it
export interface WsError extends BasePayload {
  event: "ws:error";
  code: WsErrorCode;
  message: string;
  interviewId?: string; // present when the error is scoped to an interview
  timestamp: string; // ISO-8601
}

export type WsErrorCode =
  | "AUTH_UNAUTHORIZED"
  | "AUTH_SESSION_EXPIRED"
  | "AUTH_FORBIDDEN"
  | "INTERVIEW_NOT_FOUND"
  | "INTERVIEW_INVALID_STATE"
  | "QUESTION_NOT_FOUND"
  | "ANSWER_REJECTED"
  | "CONTEXT_MISSING"
  | "INTERNAL_ERROR";

// ── Socket data (attached per-socket after auth / join) ───────────────────────
export interface SocketAuthData {
  userId: string;
  sessionId: string;
}

export interface SocketInterviewData {
  interviewId?: string;
}

export type SocketData = SocketAuthData & SocketInterviewData;

// ── Typed server / socket aliases ─────────────────────────────────────────────
export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT → SERVER EVENTS
// ─────────────────────────────────────────────────────────────────────────────

// Payload types for every event the client can send
export interface JoinInterviewPayload extends BasePayload {
  event: "interview:join";
  interviewId: string;
}

export interface LeaveInterviewPayload extends BasePayload {
  event: "interview:leave";
  interviewId: string;
}

// Client acknowledges a server-initiated ping (application-level liveness)
export interface HeartbeatAckPayload extends BasePayload {
  event: "heartbeat:ack";
}

// Submit a text or audio/video answer for the current question
export interface SubmitAnswerPayload extends BasePayload {
  event: "answer:submit";
  interviewId: string;
  questionId: string;
  answerData: string; // transcript text or media URL
  answerType: "TEXT" | "AUDIO" | "VIDEO";
}

// Submit code for a coding question
export interface SubmitCodePayload extends BasePayload {
  event: "code:submit";
  interviewId: string;
  questionId: string;
  language: string; // e.g. "python", "typescript", "java"
  code: string;
}

// Ask the server to deliver the next question
export interface RequestNextQuestionPayload extends BasePayload {
  event: "question:next";
  interviewId: string;
}

// Candidate voluntarily cancels the interview mid-session
export interface CancelInterviewPayload extends BasePayload {
  event: "interview:cancel";
  interviewId: string;
}

export interface EndInterviewPayload extends BasePayload {
  event: "interview:end";
  interviewId: string;
}

export interface ClientToServerEvents {
  "interview:join": (payload: JoinInterviewPayload) => void;
  "interview:leave": (payload: LeaveInterviewPayload) => void;
  "heartbeat:ack": (payload: HeartbeatAckPayload) => void;
  "answer:submit": (payload: SubmitAnswerPayload) => void;
  "code:submit": (payload: SubmitCodePayload) => void;
  "question:next": (payload: RequestNextQuestionPayload) => void;
  "interview:cancel": (payload: CancelInterviewPayload) => void;
  "interview:end": (payload: EndInterviewPayload) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER → CLIENT EVENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Connection / session ──────────────────────────────────────────────────────

export interface InterviewJoinedPayload extends BasePayload {
  event: "interview:joined";
  interviewId: string;
  reconnected: boolean;
  // Sent on join so the client can derive the countdown without a separate fetch
  timerStartedAt: string; // ISO-8601
  durationMinutes: number;
  // Persisted ANSWERED/EVALUATED question ids, used only for honest client copy.
  answeredQuestionIds: string[];
}

export interface InterviewLeftPayload extends BasePayload {
  event: "interview:left";
  interviewId: string;
}

export interface AnswerAcceptedPayload extends BasePayload {
  event: "answer:accepted";
  interviewId: string;
  questionId: string;
}

// ── Interview state changes ───────────────────────────────────────────────────
// Emitted whenever the interview transitions to a new status (INPROGRESS,
// SCHEDULED, COMPLETED, TIMED_OUT, CANCELLED, ABANDONED).
// The client should treat this as the authoritative source of truth for status.
export interface InterviewStateChangePayload extends BasePayload {
  event: "interview:state_change";
  interviewId: string;
  status:
    | "DRAFT"
    | "READY"
    | "SCHEDULED"
    | "INPROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | "ABANDONED"
    | "EXPIRED"
    | "TIMED_OUT";
  timestamp: string; // ISO-8601
}

// ── Question lifecycle ────────────────────────────────────────────────────────

export interface QuestionDeliveredPayload extends BasePayload {
  event: "question:delivered";
  interviewId: string;
  questionId: string;
  sequenceNumber: number; // 1-based display index
  totalQuestions: number | null;
  questionTitle: string;
  questionDescription?: string;
  questionType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  // Client starts its own 5-min countdown from this timestamp
  deliveredAt: string; // ISO-8601
  timeoutSeconds: number; // always 300 (QUESTION_TIMEOUT_MS / 1000) for now
}

// ── AI processing status ──────────────────────────────────────────────────────
// Emitted while the AI engine is working so the client can show a progress state.
// stage progression: thinking → generating → evaluating
export interface AiStatusPayload extends BasePayload {
  event: "ai:status";
  interviewId: string;
  questionId: string;
  stage: "thinking" | "generating" | "evaluating";
  timestamp: string; // ISO-8601
}

// ── Evaluation feedback ───────────────────────────────────────────────────────
// Emitted after the AI has scored an answer. The client may display this
// immediately or buffer it until the interview ends — that is a UI decision.
export interface EvaluationFeedbackPayload extends BasePayload {
  event: "evaluation:feedback";
  interviewId: string;
  questionId: string;
  answerId: string;
  // False when adaptive/system completion has already decided no next question exists.
  shouldAdvance: boolean;
  score: number; // 0–100
  correctness: number; // 0–100
  relevance: number; // 0–100
  clarity: number; // 0–100
  technicalDepth: number; // 0–100
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  timestamp: string; // ISO-8601
}

// ── Timer ─────────────────────────────────────────────────────────────────────
// Emitted by the maintenance job when the wall-clock duration is exceeded.
// The client derives the countdown from timerStartedAt + durationMinutes
// (received in interview:joined) — no per-tick events are sent.
export interface TimerExpiredPayload extends BasePayload {
  event: "timer:expired";
  interviewId: string;
  expiredAt: string; // ISO-8601
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
// Server-initiated application-level ping; client must respond with heartbeat:ack
export interface HeartbeatPingPayload extends BasePayload {
  event: "heartbeat:ping";
  timestamp: string; // ISO-8601 — client echoes this back in the ack
}

export interface ServerToClientEvents {
  // Connection / session
  "interview:joined": (payload: InterviewJoinedPayload) => void;
  "interview:left": (payload: InterviewLeftPayload) => void;
  "answer:accepted": (payload: AnswerAcceptedPayload) => void;
  // State
  "interview:state_change": (payload: InterviewStateChangePayload) => void;
  // Question lifecycle
  "question:delivered": (payload: QuestionDeliveredPayload) => void;
  // AI
  "ai:status": (payload: AiStatusPayload) => void;
  // Evaluation
  "evaluation:feedback": (payload: EvaluationFeedbackPayload) => void;
  // Timer
  "timer:expired": (payload: TimerExpiredPayload) => void;
  // Heartbeat
  "heartbeat:ping": (payload: HeartbeatPingPayload) => void;
  // Errors — always on this dedicated event name, never mixed into the stream
  "ws:error": (payload: WsError) => void;
}
