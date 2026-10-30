import { httpDelete, httpGet, httpGetNoRefresh, httpPatch, httpPost } from '../http'
import type {
  MeResponse,
  SessionResponse,
  RegisterRequest,
  VerifyOtpRequest,
  LoginRequest,
  ForgotPasswordRequest,
  ForgotPasswordVerifyRequest,
  UpdatePasswordRequest,
  UpdateProfileRequest,
} from '../api-types'

const A = (path: string) => `/auth${path}`
const U = (path: string) => `/usr${path}`

/** Request bodies the backend validates but the client never types itself. */
type RecoverAccountRequest = ForgotPasswordRequest
type RecoverAccountVerifyRequest = ForgotPasswordVerifyRequest
type UpdateEmailRequest = { email: string }
type UpdateEmailVerifyRequest = { email: string; otp: string }

export function register(body: RegisterRequest): Promise<void> {
  return httpPost(A('/register'), body)
}

export function verifyOtp(body: VerifyOtpRequest): Promise<void> {
  return httpPost(A('/verify-otp'), body)
}

export function login(body: LoginRequest): Promise<MeResponse> {
  return httpPost<MeResponse>(A('/login'), body)
}

export function refresh(): Promise<void> {
  return httpPost(A('/refresh'))
}

export function logout(): Promise<void> {
  return httpPost(U('/logout'))
}

export function me(): Promise<MeResponse> {
  return httpGetNoRefresh<MeResponse>(U('/me'))
}

export function sessions(): Promise<SessionResponse[]> {
  return httpGet<SessionResponse[]>(U('/sessions'))
}

export function revokeSession(id: string): Promise<void> {
  return httpDelete(U(`/session/${id}`))
}

export function revokeAllSessions(): Promise<void> {
  return httpDelete(U('/sessions'))
}

export function forgotPassword(body: ForgotPasswordRequest): Promise<void> {
  return httpPost(A('/forgot-password'), body)
}

export function forgotPasswordVerify(body: ForgotPasswordVerifyRequest): Promise<void> {
  return httpPost(A('/forgot-password/verify'), body)
}

/** Shipped account-recovery flow for a suspended account. */
export function recoverAccount(body: RecoverAccountRequest): Promise<void> {
  return httpPost(A('/recover-account'), body)
}

export function recoverAccountVerify(body: RecoverAccountVerifyRequest): Promise<void> {
  return httpPost(A('/recover-account/verify'), body)
}

/** Shipped email-change flow. */
export function updateEmail(body: UpdateEmailRequest): Promise<void> {
  return httpPost(U('/update-email'), body)
}

export function updateEmailVerify(body: UpdateEmailVerifyRequest): Promise<void> {
  return httpPost(U('/update-email/verify'), body)
}

export function updatePassword(body: UpdatePasswordRequest): Promise<void> {
  return httpPost(U('/update-password'), body)
}

export function updateProfile(body: UpdateProfileRequest): Promise<MeResponse> {
  return httpPatch<MeResponse>(U('/profile'), body)
}

export function deleteAccount(): Promise<void> {
  return httpDelete(U('/account'))
}

export const authService = {
  register,
  verifyOtp,
  login,
  refresh,
  logout,
  me,
  sessions,
  revokeSession,
  revokeAllSessions,
  forgotPassword,
  forgotPasswordVerify,
  recoverAccount,
  recoverAccountVerify,
  updateEmail,
  updateEmailVerify,
  updatePassword,
  updateProfile,
  deleteAccount,
}
