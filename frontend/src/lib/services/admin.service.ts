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

export interface InterviewSummary {
  id: string;
  title: string;
  status: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
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
  userId?: string;
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
    if (filter.userId) params.append('userId', filter.userId);
    if (filter.sortBy) params.append('sortBy', filter.sortBy);
    if (filter.sortOrder) params.append('sortOrder', filter.sortOrder);

    // Resolves to: { interviews, total, page, limit, totalPages }
    return httpGet<PaginatedResponse<InterviewSummary>>(`/admin/interviews?${params.toString()}`);
  }

  /**
   * Get interview by ID
   */
  async getInterviewById(id: string) {
    return httpGet<Record<string, unknown>>(`/admin/interviews/${id}`);
  }

  /**
   * Get admin overview statistics
   */
  async getOverviewStats(period: string = '30d') {
    return httpGet<AdminOverviewStats>(`/admin/overview?period=${encodeURIComponent(period)}`);
  }
}

export const adminService = new AdminService();