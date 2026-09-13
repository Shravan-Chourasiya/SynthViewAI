import { httpDelete, httpGet, httpPatch, httpPost } from "../http";
import { ENDPOINTS } from "../constants/endpoints";
import type {
  MeResponse,
  SessionResponse,
  RegisterRequest,
  VerifyOtpRequest,
  LoginRequest,
  ForgotPasswordRequest,
  ForgotPasswordVerifyRequest,
  RecoverAccountRequest,
  RecoverAccountVerifyRequest,
  UpdatePasswordRequest,
  UpdateEmailRequest,
  UpdateEmailVerifyRequest,
  UpdateProfileRequest,
} from "../types/api";

// ── Register ──────────────────────────────────────────────────────────────────

export function register(body: RegisterRequest): Promise<void> {
  return httpPost(ENDPOINTS.auth.register, body);
}

// ── Verify OTP ────────────────────────────────────────────────────────────────

export function verifyOtp(body: VerifyOtpRequest): Promise<void> {
  return httpPost(ENDPOINTS.auth.verifyOtp, body);
}

// ── Login ─────────────────────────────────────────────────────────────────────

export function login(body: LoginRequest): Promise<void> {
  return httpPost(ENDPOINTS.auth.login, body);
}

// ── Refresh ───────────────────────────────────────────────────────────────────

export function refresh(): Promise<void> {
  return httpPost(ENDPOINTS.auth.refresh);
}

// ── Logout ────────────────────────────────────────────────────────────────────

export function logout(): Promise<void> {
  return httpPost(ENDPOINTS.auth.logout);
}

// ── Me ────────────────────────────────────────────────────────────────────────

export function me(): Promise<MeResponse> {
  return httpGet<MeResponse>(ENDPOINTS.auth.me);
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function sessions(): Promise<SessionResponse[]> {
  return httpGet<SessionResponse[]>(ENDPOINTS.auth.sessions);
}

export function revokeSession(id: string): Promise<void> {
  return httpDelete(ENDPOINTS.auth.session(id));
}

export function revokeAllSessions(): Promise<void> {
  return httpDelete(ENDPOINTS.auth.deleteSessions);
}

// ── Recover account ───────────────────────────────────────────────────────────

export function recoverAccount(body: RecoverAccountRequest): Promise<void> {
  return httpPost(ENDPOINTS.auth.recoverAccount, body);
}

export function recoverAccountVerify(
  body: RecoverAccountVerifyRequest,
): Promise<void> {
  return httpPost(ENDPOINTS.auth.recoverAccountVerify, body);
}

// ── Forgot password ───────────────────────────────────────────────────────────

export function forgotPassword(body: ForgotPasswordRequest): Promise<void> {
  return httpPost(ENDPOINTS.auth.forgotPassword, body);
}

export function forgotPasswordVerify(
  body: ForgotPasswordVerifyRequest,
): Promise<void> {
  return httpPost(ENDPOINTS.auth.forgotPasswordVerify, body);
}

// ── Update password ───────────────────────────────────────────────────────────

export function updatePassword(body: UpdatePasswordRequest): Promise<void> {
  return httpPost(ENDPOINTS.auth.updatePassword, body);
}

// ── Update email ──────────────────────────────────────────────────────────────

export function updateEmail(body: UpdateEmailRequest): Promise<void> {
  return httpPost(ENDPOINTS.auth.updateEmail, body);
}

export function updateEmailVerify(body: UpdateEmailVerifyRequest): Promise<void> {
  return httpPost(ENDPOINTS.auth.updateEmailVerify, body);
}

export function updateProfile(body: UpdateProfileRequest): Promise<MeResponse> {
  return httpPatch<MeResponse>(ENDPOINTS.auth.profile, body);
}

// ── Delete account ────────────────────────────────────────────────────────────

export function deleteAccount(): Promise<void> {
  return httpDelete(ENDPOINTS.auth.deleteAccount);
}
