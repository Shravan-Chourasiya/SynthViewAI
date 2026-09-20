// Facade that keeps the existing `api.*` call-site shape while delegating to
// the typed service modules. Callers that already use `api.xxx()` continue to
// work without changes; new code should import from the service modules directly.

import { ApiError } from "./http";
import { canAccessAdmin } from "./roles";
import * as authSvc from "./services/auth.service";
import * as interviewSvc from "./services/interview.service";
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
    role: canAccessAdmin(u.userrole) ? "admin" : "candidate",
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

type BackendReport = {
  interviewId: string;
  overallScore: string | number;
  technicalScore: string | number;
  communicationScore: string | number;
  problemSolvingScore: string | number;
  confidenceScore: string | number;
  feedback?: string;
  strengths?: string[];
  weaknesses?: string[];
  difficultyProgression?: string[];
};

type ReportHistory = {
  questions?: Array<{
    questionTitle?: string;
    questionType?: string;
    answerData?: string | null;
    evaluationData?: {
      score?: number;
      feedback?: string;
      strengths?: string[];
      weaknesses?: string[];
    } | null;
  }>;
};

function asNumber(value: string | number | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function signalForScore(score: number): InterviewReport["questions"][number]["evaluation"]["signal"] {
  if (score >= 80) return "strong";
  if (score >= 60) return "good";
  if (score >= 40) return "vague";
  return "weak";
}

/** Convert the database report and history API contracts into the report-page model. */
function normalizeReport(data: BackendReport, history: ReportHistory | null): InterviewReport {
  const questions = (history?.questions ?? [])
    .filter((question) => question.evaluationData)
    .map((question) => {
      const evaluation = question.evaluationData!;
      const score = asNumber(evaluation.score);
      return {
        question: question.questionTitle ?? "Interview question",
        answer: question.answerData ?? "No answer recorded.",
        level: question.questionType ?? "Interview",
        evaluation: {
          score,
          signal: signalForScore(score),
          feedback: evaluation.feedback ?? "No written feedback was recorded.",
          strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths : [],
          weaknesses: Array.isArray(evaluation.weaknesses) ? evaluation.weaknesses : [],
        },
      };
    });
  const strengths = Array.isArray(data.strengths) ? data.strengths : [];
  const weaknesses = Array.isArray(data.weaknesses) ? data.weaknesses : [];

  return {
    interviewId: data.interviewId,
    overallScore: asNumber(data.overallScore),
    categoryScores: [
      { label: "Technical", value: asNumber(data.technicalScore) },
      { label: "Communication", value: asNumber(data.communicationScore) },
      { label: "Problem solving", value: asNumber(data.problemSolvingScore) },
      { label: "Confidence", value: asNumber(data.confidenceScore) },
    ],
    strengths,
    weaknesses,
    summary: data.feedback || `This report is based on ${questions.length} evaluated answer${questions.length === 1 ? "" : "s"}.`,
    recommendations: weaknesses.map((gap) => ({ gap, resource: "Review this area and practise a focused follow-up response." })),
    difficultyProgression: Array.isArray(data.difficultyProgression) ? data.difficultyProgression : [],
    questions,
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
    const data = await interviewSvc.getInterviewReport(id) as unknown as BackendReport;
    // A report can exist before every history read succeeds. Preserve the
    // aggregate report and render its question section empty in that case.
    let history: ReportHistory | null = null;
    try {
      history = await interviewSvc.getInterviewHistory(id) as unknown as ReportHistory;
    } catch {
      history = null;
    }
    return normalizeReport(data, history);
  },

  async getMetrics(id: string): Promise<unknown> {
    const data = await interviewSvc.getInterviewMetrics(id) as { activeSeconds?: number; report?: { overallScore?: string | number; questionsAnswered?: number; totalDuration?: number } | null };
    const report = data.report;
    const history = await interviewSvc.getInterviewHistory(id) as unknown as { questions?: Array<{ sequenceNumber: number; questionType: string; answeredAt?: string | null; questionCreatedAt?: string; timeTakenSeconds?: number | null; evaluationData?: { score?: number } | null }> };
    const questions = history.questions ?? [];
    const scored = questions.filter((question) => question.evaluationData);
    const byType = new Map<string, number[]>();
    for (const question of scored) {
      const score = asNumber(question.evaluationData?.score);
      byType.set(question.questionType, [...(byType.get(question.questionType) ?? []), score]);
    }
    const typeLabels = [
      ["BEHAVIORAL", "Behavioral"],
      ["TECHNICAL", "Technical"],
      ["MIXED", "Follow-up"],
    ] as const;
    return {
      interviewId: id,
      overall: asNumber(report?.overallScore),
      questionScores: scored.map((question) => ({ label: `Q${question.sequenceNumber}`, value: asNumber(question.evaluationData?.score) })),
      topics: typeLabels.map(([type, label]) => {
        const values = byType.get(type) ?? [];
        return { label, value: values.length ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length) : 0 };
      }),
      timePerQuestion: questions.filter((question) => question.answeredAt).map((question) => question.timeTakenSeconds ?? (question.questionCreatedAt ? Math.max(0, Math.round((new Date(question.answeredAt!).getTime() - new Date(question.questionCreatedAt).getTime()) / 1000)) : 0)),
      activeSeconds: data.activeSeconds ?? 0,
    };
  },

  async getHistory(id: string): Promise<TimelineEvent[]> {
    const data = await interviewSvc.getInterviewHistory(id) as unknown as { questions?: Array<{ questionId: string; sequenceNumber: number; questionTitle: string; questionType: string; answeredAt?: string | null; evaluationData?: unknown }> };
    return (data.questions ?? []).flatMap((question) => {
      const at = question.answeredAt ?? new Date().toISOString();
      const events: TimelineEvent[] = [{ id: `${question.questionId}-asked`, type: "question_delivered", label: `Question ${question.sequenceNumber}`, detail: question.questionTitle, at }];
      if (question.answeredAt) events.push({ id: `${question.questionId}-answered`, type: "answer_submitted", label: "Answer submitted", detail: `${question.questionType} response recorded.`, at: question.answeredAt });
      if (question.evaluationData) events.push({ id: `${question.questionId}-evaluated`, type: "evaluation_completed", label: "Answer evaluated", detail: "AI evaluation completed.", at });
      return events;
    });
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