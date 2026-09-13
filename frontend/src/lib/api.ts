// Facade that keeps the existing `api.*` call-site shape while delegating to
// the typed service modules. Callers that already use `api.xxx()` continue to
// work without changes; new code should import from the service modules directly.

import { ApiError } from "./http";
import * as authSvc from "./services/auth.service";
import * as interviewSvc from "./services/interview.service";
import { ENDPOINTS } from "./constants/endpoints";
import { normalizeInterview } from "./normalizers/interview";
import type {
  MeResponse,
  SessionResponse,
} from "./types/api";
import type {
  Interview,
  InterviewConfig,
  InterviewReport,
  Session,
  TimelineEvent,
  User,
} from "./types";

export { ApiError };

// ── Normalizers ───────────────────────────────────────────────────────────────

let pendingEmailValue = "";

function pendingEmail(): string {
  return pendingEmailValue;
}

function normalizeUser(u: MeResponse): User {
  return {
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username,
    email: u.email,
    joinedAt: u.createdAt ?? new Date().toISOString(),
    role: u.userrole === "admin" ? "admin" : "candidate",
  };
}

function normalizeSession(s: SessionResponse): Session {
  return {
    id: s.id,
    device: s.deviceType,
    location: s.ipAddress,
    lastActive: s.createdAt,
    current: s.isActive && !s.isRevoked && !s.isExpired,
  };
}

// ── api facade ────────────────────────────────────────────────────────────────

export const api = {
  // ── Auth ───────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<User> {
    await authSvc.login({ email, password, deviceType: "desktop" });
    return normalizeUser(await authSvc.me());
  },

  async register(name: string, username: string, email: string, password: string): Promise<void> {
    const [firstName, ...rest] = name.trim().split(/\s+/);
    pendingEmailValue = email;
    await authSvc.register({
      email,
      password,
      username,
      firstName,
      ...(rest.length > 0 ? { lastName: rest.join(" ") } : {}),
    });
  },

  async verifyEmail(email: string, otp: string): Promise<void> {
    return authSvc.verifyOtp({ email, otp });
  },

  async resendCode(): Promise<void> {
    // Re-trigger registration OTP by calling forgot-password flow is wrong;
    // the backend re-sends on a dedicated resend endpoint — use verifyOtp path
    // with empty otp to trigger resend if backend supports it, otherwise
    // the caller should use forgotPassword. For now mirror old behaviour:
    return authSvc.forgotPassword({ email: pendingEmail() });
  },

  async requestPasswordReset(email: string): Promise<void> {
    pendingEmailValue = email;
    return authSvc.forgotPassword({ email });
  },

  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    return authSvc.forgotPasswordVerify({
      email,
      otp,
      newPassword,
      confirmPassword: newPassword,
    });
  },

  async me(): Promise<User> {
    return normalizeUser(await authSvc.me());
  },

  async logout(): Promise<void> {
    return authSvc.logout();
  },

  // ── Sessions ───────────────────────────────────────────────────────────────

  async listSessions(): Promise<Session[]> {
    const data = await authSvc.sessions();
    return data.map(normalizeSession);
  },

  async revokeSession(id: string): Promise<void> {
    return authSvc.revokeSession(id);
  },

  async revokeOtherSessions(): Promise<void> {
    return authSvc.revokeAllSessions();
  },

  // ── Interviews ─────────────────────────────────────────────────────────────

  async listInterviews(): Promise<Interview[]> {
    const data = await interviewSvc.listInterviews();
    return data.map(normalizeInterview);
  },

  async getInterview(id: string): Promise<Interview | null> {
    try {
      return normalizeInterview(await interviewSvc.getInterview(id));
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === "INTERVIEW_NOT_FOUND" ||
          err.code === "RESOURCE_NOT_FOUND")
      )
        return null;
      throw err;
    }
  },

  async createInterview(config: InterviewConfig): Promise<string> {
    const data = await interviewSvc.createInterview(config);
    return data.id ?? data.interviewId ?? "";
  },

  async cancelInterview(id: string): Promise<void> {
    return interviewSvc.cancelInterview(id);
  },

  async startInterview(id: string): Promise<void> {
    return interviewSvc.startInterview(id);
  },

  async getReport(id: string): Promise<InterviewReport> {
    const data = await interviewSvc.getInterviewReport(id);
    return data as unknown as InterviewReport;
  },

  async getMetrics(id: string): Promise<unknown> {
    return interviewSvc.getInterviewMetrics(id);
  },

  async getHistory(id: string): Promise<TimelineEvent[]> {
    return interviewSvc.getInterviewHistory(id);
  },

  // ── Profile ────────────────────────────────────────────────────────────────

  async updateProfile(
    patch: Pick<User, "name">,
  ): Promise<User> {
    const [firstName, ...rest] = patch.name.trim().split(/\s+/);
    return normalizeUser(
      await authSvc.updateProfile({
        firstName,
        lastName: rest.join(" "),
      }),
    );
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await authSvc.me();
    return authSvc.updatePassword({
      email: user.email,
      currentPassword,
      newPassword,
    });
  },

  async deleteAccount(): Promise<void> {
    return authSvc.deleteAccount();
  },
};

// Re-export ENDPOINTS so callers that do `import { ENDPOINTS } from '@/lib/api'`
// continue to work.
export { ENDPOINTS };
