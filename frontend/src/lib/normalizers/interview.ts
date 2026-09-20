import type { InterviewResponse } from "../types/api";
import type { Difficulty, Interview, InterviewStatus, InterviewStyle, InterviewType } from "../types";

type BackendInterview = InterviewResponse & {
  interviewStatus?: InterviewResponse["status"];
  interviewDifficulty?: string;
  interviewType?: string;
  interviewCompanyStyle?: string;
  interviewDuration?: number;
  interviewMetaData?: { jobRole?: string; domain?: string; experience?: string; jobSkills?: string[]; targetedCompany?: string; targetedCompanyOther?: string; endingCriteria?: "QUESTION_COUNT" | "DURATION"; questionCount?: number; isAdaptive?: boolean };
  /** The backend stores the score inside the interviewOutcome jsonb, not as a
   * flat column — the dashboard reads `score` off every row. */
  interviewOutcome?: { finalScore?: number } | null;
  interviewQuestionsGeneratedCount?: number | null;
  interviewQuestionsAnsweredCount?: number | null;
};

function normalizeStatus(status: InterviewResponse["status"]): InterviewStatus {
  if (status === "INPROGRESS") return "IN_PROGRESS";
  if (status === "DRAFT") return "CREATED";
  if (status === "SCHEDULED") return "READY";
  if (status === "TIMED_OUT") return "ABANDONED";
  if (status === "EXPIRED") return "EXPIRED";
  return status as InterviewStatus;
}

function normalizeDifficulty(value: string | undefined): Difficulty {
  if (value?.toLowerCase() === "easy") return "Easy";
  if (value?.toLowerCase() === "hard") return "Hard";
  if (value?.toLowerCase() === "adaptive") return "Adaptive";
  return "Medium";
}

function normalizeType(value: string | undefined): InterviewType {
  if (value?.toLowerCase() === "behavioral") return "Behavioral";
  if (value?.toLowerCase() === "technical") return "Technical";
  // Reserved for legacy rows only: the current backend enum has no CODING value.
  if (value?.toLowerCase() === "coding") return "Coding";
  return "Mixed";
}

function normalizeStyle(value: string | undefined): InterviewStyle {
  if (value === "FAANG" || value === "MAANG" || value === "STARTUP" || value === "REGULAR") return value;
  return "REGULAR";
}

export function normalizeInterview(value: InterviewResponse): Interview {
  const raw = value as BackendInterview & Partial<Interview>;
  const finalScore = raw.interviewOutcome?.finalScore;
  const generated = raw.interviewQuestionsGeneratedCount ?? 0;
  const answered = raw.interviewQuestionsAnsweredCount ?? 0;
  return {
    ...(raw as Interview),
    id: raw.id,
    userId: raw.userId,
    status: normalizeStatus(raw.interviewStatus ?? raw.status),
    difficulty: raw.interviewMetaData?.isAdaptive ? "Adaptive" : normalizeDifficulty(raw.interviewDifficulty),
    type: normalizeType(raw.interviewType),
    interviewStyle: normalizeStyle(raw.interviewCompanyStyle),
    roleTitle: raw.interviewMetaData?.jobRole ?? "Software Engineer",
    domain: raw.interviewMetaData?.domain ?? raw.interviewMetaData?.jobRole ?? "Software Engineering",
    company: raw.interviewMetaData?.targetedCompany ?? raw.interviewMetaData?.targetedCompanyOther,
    experienceLevel: raw.interviewMetaData?.experience === "senior" ? "Senior" : raw.interviewMetaData?.experience === "mid-level" ? "Mid-level" : raw.interviewMetaData?.experience === "junior" ? "Junior" : "Entry",
    rounds: raw.rounds ?? 1,
    topics: raw.interviewMetaData?.jobSkills ?? [],
    targetedCompany: raw.interviewMetaData?.targetedCompany,
    targetedCompanyOther: raw.interviewMetaData?.targetedCompanyOther,
    endingCriteria: raw.interviewMetaData?.endingCriteria ?? "DURATION",
    questionCount: raw.interviewMetaData?.questionCount,
    durationMin: raw.interviewDuration ?? 0,
    createdAt: raw.createdAt,
    lastActivityAt: raw.lastActivityAt ?? raw.createdAt,
    // Score lives in interviewOutcome.finalScore; progress derives from the
    // answered/generated question counters (0..1).
    progress: raw.progress ?? (generated > 0 ? Math.min(1, answered / generated) : 0),
    score: raw.score ?? (typeof finalScore === "number" ? finalScore : null),
    currentRound: raw.currentRound ?? 1,
    currentQuestion: raw.currentQuestion ?? 0,
  };
}
