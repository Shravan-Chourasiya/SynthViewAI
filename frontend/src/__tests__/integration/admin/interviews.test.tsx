import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AdminInterviewsPage } from '@/pages/admin/interviews';
import { useAuthStore } from '@/lib/stores/auth.store';

// Mock the auth store
vi.mock('@/lib/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

describe('Admin Interviews Page', () => {
  const mockUser = {
    id: '1',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    username: 'admin',
    userrole: 'admin' as const,
    createdAt: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders admin interviews page with admin gate for admin users', () => {
    (useAuthStore as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AdminInterviewsPage />
        </MemoryRouter>
      </ThemeProvider>
    );

    // Check that the page renders with the correct title
    expect(screen.getByText('Interview Monitoring')).toBeInTheDocument();
    
    // Check that the admin unavailable message is shown
    expect(screen.getByText('Admin data is not available yet')).toBeInTheDocument();
    expect(screen.getByText('Admin access required')).toBeInTheDocument();
  });

  it('renders nothing for unauthenticated users', () => {
    (useAuthStore as any).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AdminInterviewsPage />
        </MemoryRouter>
      </ThemeProvider>
    );

    // Should not render any content for unauthenticated users
    expect(screen.queryByText('Interview Monitoring')).not.toBeInTheDocument();
  });

  it('shows access denied for non-admin users', () => {
    const regularUser = {
      ...mockUser,
      userrole: 'user' as const,
    };

    (useAuthStore as any).mockReturnValue({
      user: regularUser,
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AdminInterviewsPage />
        </MemoryRouter>
      </ThemeProvider>
    );

    // Should show access denied message
    expect(screen.getByText('Admin access required')).toBeInTheDocument();
    expect(screen.getByText("Your account doesn't have administrator permissions.")).toBeInTheDocument();
  });
});