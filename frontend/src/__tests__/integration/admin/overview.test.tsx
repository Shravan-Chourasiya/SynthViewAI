import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AdminOverviewPage } from '@/pages/admin/overview';
import { useAuthStore } from '@/lib/stores/auth.store';

// Mock the auth store
vi.mock('@/lib/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

// Mock window.scrollTo to prevent errors
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

describe('Admin Overview Page', () => {
  it('renders admin overview page with admin gate for admin users', async () => {
    // Mock admin user
    (useAuthStore as unknown as vi.Mock).mockReturnValue({
      user: {
        id: 'admin-user-id',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/admin/overview']}>
          <AdminOverviewPage />
        </MemoryRouter>
      </ThemeProvider>
    );

    // Wait for any async operations to complete
    await waitFor(() => {
      // Check that admin-specific content is rendered when user is admin
      expect(screen.queryByText('Administrator access required')).not.toBeInTheDocument();
      // Should show admin overview content
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  it('renders nothing for unauthenticated users', () => {
    // Mock unauthenticated state
    (useAuthStore as unknown as vi.Mock).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/admin/overview']}>
          <AdminOverviewPage />
        </MemoryRouter>
      </ThemeProvider>
    );

    // For unauthenticated users, the AuthGate component redirects to login
    // So we'd expect the login page or redirect behavior, not the admin content
    expect(screen.getByText('Administrator access required')).toBeInTheDocument();
  });

  it('shows access denied for non-admin users', () => {
    // Mock regular user (non-admin)
    (useAuthStore as unknown as vi.Mock).mockReturnValue({
      user: {
        id: 'regular-user-id',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'USER', // Not an admin
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/admin/overview']}>
          <AdminOverviewPage />
        </MemoryRouter>
      </ThemeProvider>
    );

    // Should show access denied message immediately
    expect(screen.getByText('Administrator access required')).toBeInTheDocument();
    expect(screen.getByText("Your account doesn't have administrator permissions.")).toBeInTheDocument();
  });
});