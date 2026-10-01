import { httpGet, httpPatch, httpPost } from '../http';

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userrole: string;
  isActive: boolean;
  accountStatus: 'active' | 'suspended' | 'disabled' | 'deleted'; // Added accountStatus property
  createdAt: string;
  updatedAt: string;
  interviewCount: number;
  lastInterviewAt?: string;
}

/**
 * A row of the admin interview list.
 *
 * There is no candidate identity here by design — the backend returns an
 * anonymized `candidateRef` instead of a name, email or user id, so the list can
 * never render one even by accident.
 */
export interface InterviewSummary {
  id: string;
  title: string;
  status: string;
  /** Stable anonymized handle for the candidate, e.g. `C-1A2B3C4D5E`. */
  candidateRef: string;
  jobRole: string | null;
  company: string | null;
  difficulty: string | null;
  durationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Session structure and scores as returned by `GET /admin/interviews/:id/metrics`.
 *
 * Mirrors `AdminInterviewMetrics` in the backend service. Note what is absent:
 * no answers, no transcripts, no evaluation feedback, no candidate identity.
 */
export interface AdminInterviewMetrics {
  session: {
    ref: string;
    candidateRef: string;
    title: string;
    status: string;
    outcome: 'completed' | 'ended_early' | 'time_expired' | 'in_progress' | 'not_started';
    type: string;
    companyStyle: string;
    difficulty: string;
    durationMinutes: number;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    jobRole: string | null;
    domain: string | null;
    targetedCompany: string | null;
    experienceLevel: string | null;
    topics: string[];
    adaptive: boolean;
    endingCriteria: string | null;
    questionTarget: number | null;
    verdict: string | null;
  };
  aggregate: {
    overallScore: number | null;
    technicalScore: number | null;
    communicationScore: number | null;
    problemSolvingScore: number | null;
    confidenceScore: number | null;
    questionsAnswered: number;
    questionsSkipped: number;
    questionsEvaluated: number;
    totalDurationSeconds: number;
  } | null;
  categoryBreakdown: {
    category: 'BEHAVIORAL' | 'TECHNICAL';
    questions: number;
    scored: number;
    averageScore: number | null;
  }[];
  difficultyProgression: { sequenceNumber: number; difficulty: string | null }[];
  questions: {
    sequenceNumber: number;
    title: string;
    type: 'BEHAVIORAL' | 'TECHNICAL' | 'MIXED';
    difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null;
    state: string;
    score: number | null;
    scores: {
      correctness: number | null;
      relevance: number | null;
      clarity: number | null;
      technicalDepth: number | null;
    };
    timeTakenSeconds: number | null;
  }[];
}

export interface AdminOverviewStats {
  totalUsers: number;
  totalInterviews: number;
  interviewsByStatus: Record<string, number>;
  recentSignups: number;
  activeUsers: number;
}

export interface PaginatedResponse<T> {
  users?: T[];
  interviews?: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserListFilter {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InterviewListFilter {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  /** Job role from the session's configuration metadata. */
  jobRole?: string;
  /** Company the session was targeted at. */
  company?: string;
  /** `YYYY-MM-DD` — inclusive lower bound on creation date. */
  from?: string;
  /** `YYYY-MM-DD` — inclusive upper bound on creation date. */
  to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class AdminService {
  /**
   * Get paginated list of users
   */
  async getUsers(filter: UserListFilter = {}) {
    const params = new URLSearchParams();
    if (filter.page !== undefined) params.append('page', filter.page.toString());
    if (filter.limit !== undefined) params.append('limit', filter.limit.toString());
    if (filter.search) params.append('search', filter.search);
    if (filter.role) params.append('role', filter.role);
    if (filter.sortBy) params.append('sortBy', filter.sortBy);
    if (filter.sortOrder) params.append('sortOrder', filter.sortOrder);

    // httpGet unwraps the `{ success, data }` envelope, so this resolves
    // directly to the paginated payload: { users, total, page, limit, totalPages }
    return httpGet<PaginatedResponse<UserSummary>>(`/admin/users?${params.toString()}`);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string) {
    return httpGet<UserSummary>(`/admin/users/${id}`);
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, newRole: string) {
    return httpPatch<void>(`/admin/users/${userId}/role`, { newRole });
  }

  /**
   * Suspend a user
   */
  async suspendUser(userId: string, reason?: string) {
    return httpPost<void>(`/admin/users/${userId}/suspend`, { reason });
  }

  /**
   * Reinstate a user
   */
  async reinstateUser(userId: string) {
    return httpPost<void>(`/admin/users/${userId}/reinstate`);
  }

  /**
   * Get paginated list of interviews
   */
  async getInterviews(filter: InterviewListFilter = {}) {
    const params = new URLSearchParams();
    if (filter.page !== undefined) params.append('page', filter.page.toString());
    if (filter.limit !== undefined) params.append('limit', filter.limit.toString());
    if (filter.search) params.append('search', filter.search);
    if (filter.status) params.append('status', filter.status);
    if (filter.jobRole) params.append('jobRole', filter.jobRole);
    if (filter.company) params.append('company', filter.company);
    if (filter.from) params.append('from', filter.from);
    if (filter.to) params.append('to', filter.to);
    if (filter.sortBy) params.append('sortBy', filter.sortBy);
    if (filter.sortOrder) params.append('sortOrder', filter.sortOrder);

    // Resolves to: { interviews, total, page, limit, totalPages }
    return httpGet<PaginatedResponse<InterviewSummary>>(`/admin/interviews?${params.toString()}`);
  }

  /**
   * Scores and metrics for one session — the admin "Interview Report".
   *
   * The backend projects this server-side and writes an audit entry for the
   * access before responding; there is nothing to filter here, and nothing to
   * filter out. `admin` role or above only.
   */
  async getInterviewMetrics(id: string) {
    return httpGet<AdminInterviewMetrics>(`/admin/interviews/${encodeURIComponent(id)}/metrics`);
  }

  /**
   * Get admin overview statistics
   */
  async getOverviewStats(period: string = '30d') {
    return httpGet<AdminOverviewStats>(`/admin/overview?period=${encodeURIComponent(period)}`);
  }
}

export const adminService = new AdminService();