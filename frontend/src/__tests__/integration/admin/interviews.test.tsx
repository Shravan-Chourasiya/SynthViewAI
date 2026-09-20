import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AdminInterviewsPage } from '@/pages/admin/interviews';
import { useAuthStore } from '@/lib/stores/auth.store';
import { adminService } from '@/lib/services/admin.service';

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
      <MemoryRouter initialEntries={['/admin/interviews']}>
        <AdminInterviewsPage />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('Admin Interviews Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the interview monitoring page for admin users', () => {
    mockAuthUser('admin');
    renderPage();

    expect(screen.getByText('Interview Monitoring')).toBeInTheDocument();
    expect(screen.queryByText('Admin access required')).not.toBeInTheDocument();
  });

  it('renders nothing for unauthenticated users', () => {
    mockAuthUser(undefined);
    renderPage();

    expect(screen.queryByText('Interview Monitoring')).not.toBeInTheDocument();
  });

  it('shows access denied for non-admin users', () => {
    mockAuthUser('user');
    renderPage();

    expect(screen.getByText('Admin access required')).toBeInTheDocument();
    expect(screen.getByText("Your account doesn't have administrator permissions.")).toBeInTheDocument();
  });

  it('sends the search term to the API so the search box actually filters', async () => {
    mockAuthUser('admin');
    renderPage();

    // The search input used to be wired only to local state, so typing never
    // triggered a request and the box looked broken.
    const search = await screen.findByPlaceholderText(/search by title/i);
    fireEvent.change(search, { target: { value: 'flutter' } });

    await waitFor(() => {
      expect(adminService.getInterviews).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'flutter' }),
      );
    });
  });

  it('sends the status filter and resets back to the ALL sentinel', async () => {
    mockAuthUser('admin');
    renderPage();

    // 'ALL' must not reach the API as a status value.
    await waitFor(() => {
      expect(adminService.getInterviews).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined }),
      );
    });

    fireEvent.change(screen.getByPlaceholderText(/filter by user id/i), {
      target: { value: 'user-123' },
    });

    await waitFor(() => {
      expect(adminService.getInterviews).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
      );
    });
  });
});
