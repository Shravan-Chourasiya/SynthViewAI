import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';
import { useAuthStore } from '@/lib/stores/auth-store';
import { interviewService } from '@/lib/services';
import { createTestQueryClient } from '@/__tests__/test-utils';

vi.mock('@/lib/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}));

// The shell asks for resumable sessions to badge the sidebar link.
vi.mock('@/lib/services', () => ({
  interviewService: { resumable: vi.fn().mockResolvedValue([]) },
  notificationService: { list: vi.fn().mockResolvedValue([]) },
}));

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

const mockUser = {
  id: 'user123',
  name: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  username: 'testuser',
  email: 'user@example.com',
  userrole: 'user' as const,
  accountStatus: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAuthStore = (state: Record<string, unknown>) => {
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector?: (s: unknown) => unknown) => (selector ? selector(state) : state),
  );
};

const renderShell = (route = '/dashboard') =>
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<div>Test Children</div>} />
              <Route path="/analytics" element={<div>Analytics Children</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );

describe('AppShell Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore({
      user: mockUser,
      status: 'authenticated',
      isLoading: false,
      _clear: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('renders routed children and the sidebar navigation', () => {
    renderShell();

    expect(screen.getByText('Test Children')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('derives the page title from the current route', () => {
    renderShell('/dashboard');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard');
  });

  it('displays the signed-in user in the sidebar', () => {
    renderShell();

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
  });

  it('falls back to the username when the name is empty', () => {
    mockAuthStore({
      user: { ...mockUser, name: undefined, firstName: '', lastName: '' },
      status: 'authenticated',
      isLoading: false,
      _clear: vi.fn(),
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('offers a sign-in link instead of the account block when signed out', () => {
    mockAuthStore({
      user: null,
      status: 'unauthenticated',
      isLoading: false,
      _clear: vi.fn(),
      logout: vi.fn(),
    });

    renderShell();

    // The shell still frames the page; only the account block is swapped.
    expect(screen.getByText('Test Children')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('counts resumable sessions on the sidebar badge', async () => {
    vi.mocked(interviewService.resumable).mockResolvedValue([
      { id: 'i1' },
      { id: 'i2' },
    ] as never);

    renderShell();

    expect(await screen.findByText('2')).toBeInTheDocument();
  });
});
