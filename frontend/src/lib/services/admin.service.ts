import { api } from '../api';

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userrole: string;
  isActive: boolean;
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
  users: T[];
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

    const response = await api.get(`/admin/users?${params.toString()}`);
    return response.data as PaginatedResponse<UserSummary>;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string) {
    const response = await api.get(`/admin/users/${id}`);
    return response.data as { data: UserSummary };
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, newRole: string) {
    const response = await api.patch(`/admin/users/${userId}/role`, { newRole });
    return response.data;
  }

  /**
   * Suspend a user
   */
  async suspendUser(userId: string, reason?: string) {
    const response = await api.post(`/admin/users/${userId}/suspend`, { reason });
    return response.data;
  }

  /**
   * Reinstate a user
   */
  async reinstateUser(userId: string) {
    const response = await api.post(`/admin/users/${userId}/reinstate`);
    return response.data;
  }

  /**
   * Get paginated list of interviews
   */
  async getInterviews(filter: InterviewListFilter = {}) {
    const params = new URLSearchParams();
    if (filter.page !== undefined) params.append('page', filter.page.toString());
    if (filter.limit !== undefined) params.append('limit', filter.limit.toString());
    if (filter.status) params.append('status', filter.status);
    if (filter.userId) params.append('userId', filter.userId);
    if (filter.sortBy) params.append('sortBy', filter.sortBy);
    if (filter.sortOrder) params.append('sortOrder', filter.sortOrder);

    const response = await api.get(`/admin/interviews?${params.toString()}`);
    return response.data as PaginatedResponse<InterviewSummary>;
  }

  /**
   * Get interview by ID
   */
  async getInterviewById(id: string) {
    const response = await api.get(`/admin/interviews/${id}`);
    return response.data;
  }

  /**
   * Get admin overview statistics
   */
  async getOverviewStats(period: string = '30d') {
    const params = new URLSearchParams({ period });
    const response = await api.get(`/admin/overview?${params.toString()}`);
    return response.data as { data: AdminOverviewStats };
  }
}

export const adminService = new AdminService();