// Backend REST API request/response types.
// Field names mirror the backend contract exactly.

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string
  password: string
  username: string
  firstName?: string
  lastName?: string
}

export interface VerifyOtpRequest {
  email: string
  otp: string
}

export interface LoginRequest {
  email: string
  password: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ForgotPasswordVerifyRequest {
  email: string
  otp: string
  newPassword: string
  confirmPassword: string
}

export interface UpdatePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface UpdateProfileRequest {
  firstName?: string
  lastName?: string
  username?: string
}

// ── User ──────────────────────────────────────────────────────────────────────

export interface MeResponse {
  id: string
  email: string
  username: string
  firstName?: string | null
  lastName?: string | null
  bio?: string | null
  userrole: string
  accountStatus: string
  createdAt: string
  // Derived display helpers (computed client-side from firstName + lastName)
  name?: string
  // Backend may include these in future; typed as optional so pages compile
  role?: string
  headline?: string | null
  location?: string | null
  joinedAt?: string
  lastActiveAt?: string
}

export interface SessionResponse {
  id: string
  deviceId: string
  deviceType: string
  ipAddress: string
  userAgent: string
  isActive: boolean
  isRevoked: boolean
  isExpired: boolean
  expiryDate: string
  createdAt: string
  loginCount: number
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface NotificationResponse {
  id: string
  title: string
  body: string
  kind: 'interview' | 'report' | 'system'
  read: boolean
  createdAt: string
}

// ── Interviews ────────────────────────────────────────────────────────────────

export type BackendInterviewStatus =
  | 'DRAFT'
  | 'READY'
  | 'SCHEDULED'
  | 'INPROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ABANDONED'
  | 'EXPIRED'
  | 'TIMED_OUT'

export interface InterviewResponse {
  id: string
  userId: string
  status?: BackendInterviewStatus
  interviewStatus?: BackendInterviewStatus
  interviewTitle?: string
  interviewDescription?: string
  interviewType?: string
  interviewDifficulty?: string
  interviewDuration?: number
  interviewMetaData?: Record<string, unknown>
  createdAt: string
  updatedAt?: string
  lastActivityAt?: string
  [key: string]: unknown
}

export interface CreateInterviewResponse {
  id?: string
  interviewId?: string
}

// ── Contact ───────────────────────────────────────────────────────────────────

export interface ContactRequest {
  name: string
  email: string
  subject: string
  message: string
}
