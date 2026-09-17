import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AdminGate, AdminUnavailable, AdminHeader } from '@/pages/admin/shared';
import { useAuthStore } from '@/lib/stores/auth.store';

// Mock the auth store
vi.mock('@/lib/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

describe('Admin Shared Components', () => {
  const mockAdminUser = {
    id: '1',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    username: 'admin',
    userrole: 'admin' as const,
    createdAt: '2023-01-01T00:00:00Z',
  };

  const mockRegularUser = {
    id: '2',
    firstName: 'Regular',
    lastName: 'User',
    email: 'user@example.com',
    username: 'regular_user',
    userrole: 'user' as const,
    createdAt: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AdminGate', () => {
    it('renders children for admin users', () => {
      (useAuthStore as any).mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
        isLoading: false,
      });

      render(
        <ThemeProvider>
          <MemoryRouter>
            <AdminGate>
              <div>Protected Content</div>
            </AdminGate>
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
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
            <AdminGate>
              <div>Protected Content</div>
            </AdminGate>
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('shows access denied for non-admin users', () => {
      (useAuthStore as any).mockReturnValue({
        user: mockRegularUser,
        isAuthenticated: true,
        isLoading: false,
      });

      render(
        <ThemeProvider>
          <MemoryRouter>
            <AdminGate>
              <div>Protected Content</div>
            </AdminGate>
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(screen.getByText('Admin access required')).toBeInTheDocument();
      expect(screen.getByText("Your account doesn't have administrator permissions.")).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('AdminUnavailable', () => {
    it('renders the unavailable message', () => {
      render(
        <ThemeProvider>
          <MemoryRouter>
            <AdminUnavailable />
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(screen.getByText('Admin data is not available yet')).toBeInTheDocument();
      expect(screen.getByText('Admin access required')).toBeInTheDocument();
      expect(screen.getByText('The current backend contract does not expose administrative user or interview endpoints.')).toBeInTheDocument();
    });
  });

  describe('AdminHeader', () => {
    it('renders header with title and description', () => {
      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <AdminHeader 
              title="Test Title" 
              description="Test Description" 
            />
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByText('Admin area')).toBeInTheDocument();
    });

    it('highlights active navigation link', () => {
      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <AdminHeader 
              title="Test Title" 
              description="Test Description" 
            />
          </MemoryRouter>
        </ThemeProvider>
      );

      // Check that the "Overview" link is marked as active
      const overviewLink = screen.getByRole('link', { name: 'Overview' });
      expect(overviewLink).toHaveAttribute('aria-current', 'page');
    });
  });
});