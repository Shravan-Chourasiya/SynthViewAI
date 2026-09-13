// REST API request/response payload types.
// Field names and literal unions mirror the backend contract exactly.
// Do not invent fields that the backend does not send/accept.

// ── Response envelope ─────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  statusCode: number;
  message: string;
  error: {
    code: ErrorCode;
    [key: string]: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Error codes ───────────────────────────────────────────────────────────────

export type ErrorCode =
  | "ROUTE_NOT_FOUND"
  | "RESOURCE_NOT_FOUND"
  | "VALIDATION_FAILED"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_UNAUTHORIZED"
  | "AUTH_FORBIDDEN"
  | "AUTH_SESSION_EXPIRED"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERVIEW_INVALID_STATE"
  | "INTERVIEW_NOT_FOUND"
  | "ANSWER_REJECTED"
  | "QUESTION_NOT_COMPLETED"
  | "INTERNAL_SERVER_ERROR"
  | "RESOURCE_ALREADY_EXISTS"
  | "RESOURCE_CONFLICT";

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceType: "desktop" | "mobile" | "tablet";
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordVerifyRequest {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface RecoverAccountRequest {
  email: string;
}

export interface RecoverAccountVerifyRequest {
  email: string;
  otp: string;
}

export interface UpdatePasswordRequest {
  email: string;
  currentPassword: string;
  newPassword: string;
}

export interface UpdateEmailRequest {
  email: string;
}

export interface UpdateEmailVerifyRequest {
  email: string;
  otp: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
}

// ── User / Session ────────────────────────────────────────────────────────────

// Shape returned by getMeService; role is `userrole` to mirror the backend.
export interface MeResponse {
  id: string;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  userrole: string;
  accountStatus: string;
  createdAt: string;
}

// Shape returned by getSessionsService
export interface SessionResponse {
  id: string;
  deviceId: string;
  deviceType: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  isRevoked: boolean;
  isExpired: boolean;
  expiryDate: string;
  createdAt: string;
  loginCount: number;
  failedLoginAttempts: number;
  totalSessionCount: number;
  activeSessionCount: number;
}

// ── Interviews ────────────────────────────────────────────────────────────────

export type BackendInterviewStatus =
  | "DRAFT"
  | "READY"
  | "SCHEDULED"
  | "INPROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "ABANDONED"
  | "EXPIRED"
  | "TIMED_OUT";

export interface InterviewResponse {
  id: string;
  userId: string;
  status: BackendInterviewStatus;
  createdAt: string;
  lastActivityAt?: string;
  [key: string]: unknown;
}

export interface CreateInterviewResponse {
  id?: string;
  interviewId?: string;
}

export interface InterviewMetricsResponse {
  [key: string]: unknown;
}

export interface InterviewReportResponse {
  interviewId: string;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  confidenceScore: number;
  questionsAnswered: number;
  feedback?: string;
  [key: string]: unknown;
}

export interface AnswerRequest {
  questionId: string;
  answerData: string;
  answerType: "TEXT" | "AUDIO" | "VIDEO";
}
