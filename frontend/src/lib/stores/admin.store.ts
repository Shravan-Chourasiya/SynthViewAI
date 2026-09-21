import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { adminService, UserSummary, InterviewSummary, AdminOverviewStats, UserListFilter, InterviewListFilter, PaginatedResponse } from '../services/admin.service';

interface AdminState {
  // Users state
  users: UserSummary[];
  userPagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  selectedUser: UserSummary | null;
  usersLoading: boolean;
  usersError: string | null;
  
  // Interviews state
  interviews: InterviewSummary[];
  interviewPagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  selectedInterview: any; // More specific type would be needed based on backend
  interviewsLoading: boolean;
  interviewsError: string | null;
  
  // Overview state
  overviewStats: AdminOverviewStats | null;
  overviewLoading: boolean;
  overviewError: string | null;
  
  // Actions
  loadUsers: (filter?: UserListFilter) => Promise<void>;
  loadUserById: (id: string) => Promise<void>;
  updateUserRole: (userId: string, newRole: string) => Promise<void>;
  suspendUser: (userId: string, reason?: string) => Promise<void>;
  reinstateUser: (userId: string) => Promise<void>;
  loadInterviews: (filter?: InterviewListFilter) => Promise<void>;
  loadInterviewById: (id: string) => Promise<void>;
  loadOverviewStats: (period?: string) => Promise<void>;
  resetSelectedUser: () => void;
  resetSelectedInterview: () => void;
}

export const useAdminStore = create<AdminState>()(
  devtools((set, get) => ({
    // Initial state
    users: [],
    userPagination: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    },
    selectedUser: null,
    usersLoading: false,
    usersError: null,
    
    interviews: [],
    interviewPagination: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    },
    selectedInterview: null,
    interviewsLoading: false,
    interviewsError: null,
    
    overviewStats: null,
    overviewLoading: false,
    overviewError: null,
    
    // Actions
    loadUsers: async (filter = {}) => {
      set({ usersLoading: true, usersError: null });
      try {
        const response = await adminService.getUsers({
          page: 1,
          limit: 10,
          ...filter
        });
        
        set({
          users: response.users ?? [],
          userPagination: {
            total: response.total,
            page: response.page,
            limit: response.limit,
            totalPages: response.totalPages,
          },
          usersLoading: false,
        });
      } catch (error: any) {
        set({ 
          usersError: error.message || 'Failed to load users',
          usersLoading: false 
        });
      }
    },
    
    loadUserById: async (id: string) => {
      set({ usersLoading: true, usersError: null });
      try {
        // Service already unwraps the `{ success, data }` envelope
        const user = await adminService.getUserById(id);
        set({ 
          selectedUser: user,
          usersLoading: false 
        });
      } catch (error: any) {
        set({ 
          usersError: error.message || 'Failed to load user',
          usersLoading: false 
        });
      }
    },
    
    updateUserRole: async (userId: string, newRole: string) => {
      try {
        await adminService.updateUserRole(userId, newRole);
        // Optionally refresh the user list or update the specific user in the store
        const { loadUsers } = get();
        loadUsers({ page: get().userPagination.page, limit: get().userPagination.limit });
      } catch (error: any) {
        set({ usersError: error.message || 'Failed to update user role' });
      }
    },
    
    suspendUser: async (userId: string, reason?: string) => {
      try {
        await adminService.suspendUser(userId, reason);
        const { loadUsers } = get();
        loadUsers({ page: get().userPagination.page, limit: get().userPagination.limit });
      } catch (error: any) {
        set({ usersError: error.message || 'Failed to suspend user' });
      }
    },
    
    reinstateUser: async (userId: string) => {
      try {
        await adminService.reinstateUser(userId);
        const { loadUsers } = get();
        loadUsers({ page: get().userPagination.page, limit: get().userPagination.limit });
      } catch (error: any) {
        set({ usersError: error.message || 'Failed to reinstate user' });
      }
    },
    
    loadInterviews: async (filter = {}) => {
      set({ interviewsLoading: true, interviewsError: null });
      try {
        const response = await adminService.getInterviews({
          page: 1,
          limit: 10,
          ...filter
        });
        
        set({
          interviews: response.interviews ?? [],
          interviewPagination: {
            total: response.total,
            page: response.page,
            limit: response.limit,
            totalPages: response.totalPages,
          },
          interviewsLoading: false,
        });
      } catch (error: any) {
        set({ 
          interviewsError: error.message || 'Failed to load interviews',
          interviewsLoading: false 
        });
      }
    },
    
    loadInterviewById: async (id: string) => {
      set({ interviewsLoading: true, interviewsError: null });
      try {
        // Service already unwraps the `{ success, data }` envelope
        const interview = await adminService.getInterviewById(id);
        set({ 
          selectedInterview: interview,
          interviewsLoading: false 
        });
      } catch (error: any) {
        set({ 
          interviewsError: error.message || 'Failed to load interview',
          interviewsLoading: false 
        });
      }
    },
    
    loadOverviewStats: async (period = '30d') => {
      set({ overviewLoading: true, overviewError: null });
      try {
        // Service already unwraps the `{ success, data }` envelope
        const stats = await adminService.getOverviewStats(period);
        set({ 
          overviewStats: stats,
          overviewLoading: false 
        });
      } catch (error: any) {
        set({ 
          overviewError: error.message || 'Failed to load overview stats',
          overviewLoading: false 
        });
      }
    },
    
    resetSelectedUser: () => set({ selectedUser: null }),
    resetSelectedInterview: () => set({ selectedInterview: null }),
  }))
);