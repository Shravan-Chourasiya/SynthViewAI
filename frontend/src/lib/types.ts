// Domain types for SynthView AI. These normalize backend responses for the UI.

/** "Coding" is reserved: the backend interview-type enum is BEHAVIORAL | TECHNICAL | MIXED,
 * so no picker offers it and the create service maps it to MIXED. */
export type InterviewType = "Behavioral" | "Technical" | "Coding" | "Mixed";
export type Difficulty = "Easy" | "Medium" | "Hard" | "Adaptive";
export type ExperienceLevel = "Entry" | "Junior" | "Mid-level" | "Senior";
export type InterviewStyle = "FAANG" | "MAANG" | "STARTUP" | "REGULAR";
export type EndingCriteria = "QUESTION_COUNT" | "DURATION";
export type SignalTone = "strong" | "good" | "vague" | "weak";

export const INTERVIEW_STATUSES = [
  "CREATED",
  "READY",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "ABANDONED",
  "EXPIRED",
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  role: "candidate" | "admin";
}

export interface InterviewConfig {
  domain: string;
  roleTitle: string;
  /** Legacy/read-model fields; not collected or sent by the creation wizard. */
  company?: string;
  targetedCompany?: string;
  targetedCompanyOther?: string;
  experienceLevel: ExperienceLevel;
  difficulty: Difficulty;
  type: InterviewType;
  durationMin: number;
  /** Read-only compatibility value for existing interview displays. */
  rounds: number;
  topics: string[];
  interviewStyle: InterviewStyle;
  endingCriteria: EndingCriteria;
  questionCount?: number;
}

export interface Interview extends InterviewConfig {
  id: string;
  userId: string;
  status: InterviewStatus;
  createdAt: string;
  lastActivityAt: string;
  /** 0..1 */
  progress: number;
  score: number | null;
  currentRound: number;
  currentQuestion: number;
}

/** "code" is reserved for the codebox integration, which is not built. The backend only
 * emits text questions, so the live room renders every question as text by default. */
export type QuestionKind = "text" | "code";

export interface Question {
  id: string;
  index: number;
  kind: QuestionKind;
  category: InterviewType;
  topic: string;
  difficulty: Exclude<Difficulty, "Adaptive">;
  text: string;
  /** Reserved for the code editor's seed content. Code execution (codebox) is not
   * built, so nothing renders this field and the live room shows text questions only. */
  starter?: string;
  isFollowUp?: boolean;
}

export interface Evaluation {
  score: number;
  signal: SignalTone;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  improvedAnswer?: string;
}

export interface Recommendation {
  gap: string;
  resource: string;
}

export interface InterviewReport {
  interviewId: string;
  overallScore: number;
  categoryScores: { label: string; value: number }[];
  strengths: string[];
  weaknesses: string[];
  summary: string;
  recommendations: Recommendation[];
  difficultyProgression: string[];
  questions: {
    question: string;
    answer: string;
    level: string;
    evaluation: Evaluation;
  }[];
}

export type TimelineEventType =
  | "created"
  | "started"
  | "question_delivered"
  | "answer_submitted"
  | "evaluation_completed"
  | "difficulty_changed"
  | "topic_changed"
  | "followup_generated"
  | "code_submitted"
  | "resumed"
  | "cancelled"
  | "completed";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  label: string;
  detail: string;
  at: string;
}

export interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: "Active" | "Suspended";
  joinedAt: string;
  interviewCount: number;
}

/* ---------------- display metadata ---------------- */

export type BadgeVariant =
  | "default"
  | "strong"
  | "good"
  | "vague"
  | "weak"
  | "neutral"
  | "outline";

export const STATUS_META: Record<
  InterviewStatus,
  { label: string; variant: BadgeVariant }
> = {
  CREATED: { label: "Created", variant: "neutral" },
  READY: { label: "Ready", variant: "good" },
  IN_PROGRESS: { label: "In Progress", variant: "default" },
  COMPLETED: { label: "Completed", variant: "strong" },
  CANCELLED: { label: "Cancelled", variant: "weak" },
  ABANDONED: { label: "Abandoned", variant: "weak" },
  EXPIRED: { label: "Expired", variant: "weak" },
};

export const DIFFICULTY_META: Record<Difficulty, { variant: BadgeVariant }> = {
  Easy: { variant: "strong" },
  Medium: { variant: "vague" },
  Hard: { variant: "weak" },
  Adaptive: { variant: "default" },
};
