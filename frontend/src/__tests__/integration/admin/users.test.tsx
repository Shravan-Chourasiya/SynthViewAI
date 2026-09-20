import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AdminUsersPage } from '@/pages/admin/users';
import { useAuthStore } from '@/lib/stores/auth.store';

// Mock the auth store (selector-honoring)
vi.mock('@/lib/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

// Mock the admin service so no real HTTP calls are made
vi.mock('@/lib/services/admin.service', () => ({
  adminService: {
    getUsers: vi.fn().mockResolvedValue({ users: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
    getUserById: vi.fn().mockResolvedValue(null),
    updateUserRole: vi.fn().mockResolvedValue(undefined),
    suspendUser: vi.fn().mockResolvedValue(undefined),
    reinstateUser: vi.fn().mockResolvedValue(undefined),
    getInterviews: vi.fn().mockResolvedValue({ interviews: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
    getInterviewById: vi.fn().mockResolvedValue(null),
    getOverviewStats: vi.fn().mockResolvedValue({
      totalUsers: 0,
      totalInterviews: 0,
      interviewsByStatus: {},
      recentSignups: 0,
      activeUsers: 0,
    }),
  },
}));

const mockAuthUser = (userrole?: string) => {
  (useAuthStore as unknown as vi.Mock).mockImplementation((selector?: (s: unknown) => unknown) => {
    const state = {
      status: 'authenticated',
      user: userrole
        ? {
            id: '1',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            username: 'admin',
            userrole,
            accountStatus: 'active',
            createdAt: '2023-01-01T00:00:00Z',
          }
        : null,
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      bootstrap: vi.fn(),
    };
    return selector ? selector(state) : state;
  });
};

const renderPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/admin/users']}>
        <AdminUsersPage />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('Admin Users Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the user management page for admin users', () => {
    mockAuthUser('admin');
    renderPage();

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.queryByText('Admin access required')).not.toBeInTheDocument();
  });

  it('renders nothing for unauthenticated users', () => {
    mockAuthUser(undefined);
    renderPage();

    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
  });

  it('shows access denied for non-admin users', () => {
    mockAuthUser('user');
    renderPage();

    expect(screen.getByText('Admin access required')).toBeInTheDocument();
    expect(screen.getByText("Your account doesn't have administrator permissions.")).toBeInTheDocument();
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
  });

  it('admits owners and moderators (admin area is role-hierarchy based)', () => {
    mockAuthUser('owner');
    renderPage();
    expect(screen.getByText('User Management')).toBeInTheDocument();
  });
});
