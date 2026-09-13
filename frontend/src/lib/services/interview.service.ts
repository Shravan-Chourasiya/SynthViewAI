import { httpGet, httpPost } from "../http";
import { ENDPOINTS } from "../constants/endpoints";
import type {
  InterviewResponse,
  CreateInterviewResponse,
  InterviewMetricsResponse,
  InterviewReportResponse,
  AnswerRequest,
} from "../types/api";
import type { InterviewConfig, TimelineEvent } from "../types";

const TARGET_COMPANIES = new Set([
  "Google",
  "Microsoft",
  "Amazon",
  "Meta",
  "Apple",
  "Netflix",
  "OpenAI",
  "Nvidia",
  "TCS",
  "Infosys",
  "JPMorgan",
  "Wipro",
  "Deloitte",
  "Adobe",
  "Anthropic",
]);

// ── List ──────────────────────────────────────────────────────────────────────

export function listInterviews(): Promise<InterviewResponse[]> {
  return httpGet<InterviewResponse[]>(ENDPOINTS.interviews.list);
}

// ── Resumable ─────────────────────────────────────────────────────────────────

export function resumableInterviews(): Promise<InterviewResponse[]> {
  return httpGet<InterviewResponse[]>(ENDPOINTS.interviews.resumable);
}

// ── Create ────────────────────────────────────────────────────────────────────

export function createInterview(
  body: InterviewConfig,
): Promise<CreateInterviewResponse> {
  const experience =
    body.experienceLevel === "Senior"
      ? "senior"
      : body.experienceLevel === "Mid-level"
        ? "mid-level"
        : "fresher";
  const difficulty = body.difficulty === "Easy" || body.difficulty === "Hard" ? body.difficulty.toUpperCase() : "MEDIUM";
  const interviewType = body.type === "Behavioral" ? "BEHAVIORAL" : body.type === "Technical" ? "TECHNICAL" : "MIXED";
  const minimumDuration = interviewType === "BEHAVIORAL" ? 20 : interviewType === "TECHNICAL" ? 30 : 40;

  return httpPost<CreateInterviewResponse>(ENDPOINTS.interviews.create, {
    jobrole: body.roleTitle,
    experience,
    jobSkills: body.topics,
    difficulty,
    interviewStyle: "FAANG",
    interviewType,
    duration: Math.max(body.durationMin, minimumDuration),
    maxFollowUps: Math.max(0, Math.min(5, body.rounds)),
    isScheduled: false,
    ...(body.company && TARGET_COMPANIES.has(body.company)
      ? { targetedCompany: body.company }
      : {}),
  });
}

// ── Get by ID ─────────────────────────────────────────────────────────────────

export function getInterview(id: string): Promise<InterviewResponse> {
  return httpGet<InterviewResponse>(ENDPOINTS.interviews.byId(id));
}

// ── History ───────────────────────────────────────────────────────────────────

export function getInterviewHistory(id: string): Promise<TimelineEvent[]> {
  return httpGet<TimelineEvent[]>(ENDPOINTS.interviews.history(id));
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export function getInterviewMetrics(
  id: string,
): Promise<InterviewMetricsResponse> {
  return httpGet<InterviewMetricsResponse>(ENDPOINTS.interviews.metrics(id));
}

// ── Report ────────────────────────────────────────────────────────────────────

export function getInterviewReport(
  id: string,
): Promise<InterviewReportResponse> {
  return httpGet<InterviewReportResponse>(ENDPOINTS.interviews.report(id));
}

// ── Start ─────────────────────────────────────────────────────────────────────

export function startInterview(id: string): Promise<void> {
  return httpPost(ENDPOINTS.interviews.start(id));
}

// ── Pause ─────────────────────────────────────────────────────────────────────

export function pauseInterview(id: string): Promise<void> {
  return httpPost(ENDPOINTS.interviews.pause(id));
}

// ── Resume ────────────────────────────────────────────────────────────────────

export function resumeInterview(id: string): Promise<void> {
  return httpPost(ENDPOINTS.interviews.resume(id));
}

// ── Cancel ────────────────────────────────────────────────────────────────────

export function cancelInterview(id: string): Promise<void> {
  return httpPost(ENDPOINTS.interviews.cancel(id));
}

// ── End ───────────────────────────────────────────────────────────────────────

export function endInterview(id: string): Promise<void> {
  return httpPost(ENDPOINTS.interviews.end(id));
}

// ── Submit answer ─────────────────────────────────────────────────────────────

export function submitAnswer(
  interviewId: string,
  body: AnswerRequest,
): Promise<void> {
  return httpPost(ENDPOINTS.interviews.answer(interviewId, body.questionId), body);
}
