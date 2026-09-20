import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';
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

describe('AppShell Component', () => {
  const mockUser = {
    id: 'user123',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    email: 'user@example.com',
    userrole: 'user' as const,
    accountStatus: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Components consume the store via selectors, so the mock must honor them.
  const mockAuthStore = (state: Record<string, unknown>) => {
    (useAuthStore as unknown as vi.Mock).mockImplementation((selector?: (s: unknown) => unknown) =>
      selector ? selector(state) : state,
    );
  };

  beforeEach(() => {
    mockAuthStore({
      user: mockUser,
      status: 'authenticated',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('renders children and sidebar', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppShell title="Test">
            <div>Test Children</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Check that children are rendered
    expect(screen.getByText('Test Children')).toBeInTheDocument();

    // Check that sidebar is present
    expect(screen.getByRole('banner')).toBeInTheDocument(); // Main header
    expect(screen.getByRole('navigation')).toBeInTheDocument(); // Sidebar navigation
  });

  it('displays user name in sidebar', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppShell title="Test">
            <div>Test Children</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Check that the user's name is displayed
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('displays fallback username when no name is provided', () => {
    // Mock user without first/last name — falls back to username
    mockAuthStore({
      user: { ...mockUser, firstName: null, lastName: null },
      status: 'authenticated',
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppShell title="Test">
            <div>Test Children</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Check that the username is used as the display fallback
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('handles loading state', () => {
    mockAuthStore({ user: null, status: 'loading', isAuthenticated: false, isLoading: true });

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppShell title="Test">
            <div>Test Children</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    );

    // Should render children even when loading
    expect(screen.getByText('Test Children')).toBeInTheDocument();
  });
});
