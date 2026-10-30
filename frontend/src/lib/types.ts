export type InterviewStatus = 'draft' | 'scheduled' | 'in-progress' | 'completed' | 'abandoned'

export type InterviewType = 'behavioral' | 'technical' | 'mixed'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

export type ExperienceLevel = 'intern' | 'junior' | 'mid' | 'senior' | 'staff' | 'lead'

/** Functional signal mapping — strong=green, good=blue, vague=amber, weak=red. */
export type SignalBand = 'strong' | 'good' | 'vague' | 'weak'

export type UserRole = 'candidate' | 'reviewer' | 'admin'

export type UserStatus = 'active' | 'invited' | 'suspended'

export type QuestionKind = 'behavioral' | 'technical' | 'situational' | 'mcq' | 'rating' | 'structured' | 'code'

export interface User {
  id: string
  name: string
  username: string
  email: string
  role: UserRole
  status: UserStatus
  headline: string
  location: string
  joinedAt: string
  lastActiveAt: string
}

export interface Interview {
  id: string
  code: string
  roleTitle: string
  company: string | null
  field: string
  type: InterviewType
  difficulty: Difficulty
  experienceLevel: ExperienceLevel
  status: InterviewStatus
  topics: string[]
  questionCount: number
  rounds: number
  durationMinutes: number
  score: number | null
  band: SignalBand | null
  summary: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  /** 0..1 */
  progress: number
  currentRound: number
  answeredCount: number
  candidateId: string
}

export interface Question {
  id: string
  interviewId: string
  index: number
  kind: QuestionKind
  prompt: string
  topic: string
  difficulty: Difficulty
  answer: string | null
  score: number | null
  band: SignalBand | null
  /** Short signal headline, e.g. "Strong technical understanding". */
  headline: string | null
  feedback: string | null
  strengths: string[]
  improvements: string[]
  /** Adaptive decision readout, e.g. "Difficulty increased". */
  decision: string | null
  durationSeconds: number
  options?: string[]
  /**
   * Answer surface, straight from the question row (`answerFormat`). The backend
   * decides it per question; `CODE` renders the code editor instead of prose and
   * is the only signal that maps a question onto `kind: 'code'`.
   * Absent on older payloads — those render as prose.
   */
  answerFormat?: 'TEXT' | 'CODE' | null
  /** Language recorded alongside a code answer, when one was chosen. */
  codeLanguage?: string | null
  /** Clarifying note seeded into the code editor as its placeholder. */
  starter?: string | null
}

export interface SkillScore {
  skill: string
  score: number
}

export interface ScorePoint {
  index: number
  label: string
  score: number
  difficulty: Difficulty
}

export interface InterviewReport {
  interviewId: string
  overallScore: number
  band: SignalBand
  headline: string
  summary: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  skills: SkillScore[]
  progression: ScorePoint[]
  topics: { topic: string; score: number }[]
  shareToken: string
  generatedAt: string
  questions: Question[]
}

export interface LobbyCheck {
  id: 'camera' | 'microphone'
  label: string
  status: 'idle' | 'checking' | 'ready' | 'error'
  detail: string
}

export interface DeviceSession {
  id: string
  device: string
  browser: string
  os: string
  location: string
  ip: string
  current: boolean
  createdAt: string
  lastActiveAt: string
}

export interface AppNotification {
  id: string
  title: string
  body: string
  kind: 'interview' | 'report' | 'system'
  read: boolean
  createdAt: string
}

export type LiveStatus = 'idle' | 'listening' | 'evaluating' | 'generating'

export type InterviewEvent =
  | { type: 'status'; status: LiveStatus }
  | { type: 'question'; question: Question }
  | { type: 'transcript'; text: string; final: boolean }
  | {
      type: 'evaluation'
      questionId: string
      score: number
      band: SignalBand
      headline: string
      decision: string
    }
  | { type: 'timer'; elapsedSeconds: number }
  | { type: 'connection'; state: 'connected' | 'reconnecting' | 'offline' }
  | { type: 'complete' }

export interface ContactPayload {
  name: string
  email: string
  topic: string
  message: string
}

export interface AnalyticsKpi {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down' | 'flat'
  hint: string
}

export interface AnalyticsSummary {
  kpis: AnalyticsKpi[]
  scoreOverTime: { label: string; score: number; benchmark: number }[]
  byCategory: { category: string; score: number; attempts: number }[]
  byDifficulty: { difficulty: string; score: number; attempts: number }[]
  skills: { skill: string; score: number; delta: number }[]
  strengths: string[]
  gaps: string[]
}

export interface AdminUserRow {
  id: string
  name: string
  username: string
  email: string
  role: UserRole
  status: UserStatus
  interviews: number
  avgScore: number | null
  joinedAt: string
  lastActiveAt: string
}

export interface PlatformStats {
  kpis: AnalyticsKpi[]
  signups: { label: string; users: number; interviews: number }[]
  statusMix: { status: string; count: number }[]
  scoreBands: { band: string; count: number }[]
  topRoles: { role: string; count: number; avgScore: number }[]
}

export interface NewInterviewDraft {
  field: string
  roleTitle: string
  company: string | null
  companyChoice: string
  type: InterviewType | null
  topics: string[]
  experienceLevel: ExperienceLevel
  difficulty: Difficulty | null
  durationMinutes: number
  rounds: number
}

export interface InterviewFilters {
  search?: string
  status?: InterviewStatus | 'all'
  type?: InterviewType | 'all'
  sort?: 'recent' | 'score' | 'role'
  page?: number
  pageSize?: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
