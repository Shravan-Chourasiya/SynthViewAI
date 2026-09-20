import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AdminOverviewPage } from '@/pages/admin/overview';
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
      totalUsers: 12,
      totalInterviews: 34,
      interviewsByStatus: { COMPLETED: 30, ACTIVE: 4 },
      recentSignups: 5,
      activeUsers: 8,
    }),
  },
}));

// Mock window.scrollTo to prevent errors
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

const mockAuthUser = (userrole?: string) => {
  (useAuthStore as unknown as vi.Mock).mockImplementation((selector?: (s: unknown) => unknown) => {
    const state = {
      status: 'authenticated',
      user: userrole
        ? {
            id: 'admin-user-id',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            username: 'admin',
            userrole,
            accountStatus: 'active',
            createdAt: new Date().toISOString(),
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
      <MemoryRouter initialEntries={['/admin']}>
        <AdminOverviewPage />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('Admin Overview Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the platform overview for admin users with real stats', async () => {
    mockAuthUser('admin');
    renderPage();

    expect(screen.getByText('Platform Overview')).toBeInTheDocument();
    expect(screen.queryByText('Admin access required')).not.toBeInTheDocument();

    // Stats come from the (mocked) service, not hardcoded zeros
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('34')).toBeInTheDocument();
    });
  });

  it('renders nothing for unauthenticated users', () => {
    mockAuthUser(undefined);
    renderPage();

    expect(screen.queryByText('Platform Overview')).not.toBeInTheDocument();
  });

  it('shows access denied for non-admin users', () => {
    mockAuthUser('user');
    renderPage();

    expect(screen.getByText('Admin access required')).toBeInTheDocument();
    expect(screen.getByText("Your account doesn't have administrator permissions.")).toBeInTheDocument();
  });

  it('admits owners (apex) and moderators via the role hierarchy', async () => {
    mockAuthUser('owner');
    renderPage();

    expect(screen.getByText('Platform Overview')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });
  });
});
