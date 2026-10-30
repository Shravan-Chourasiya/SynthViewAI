import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { RequireAuth } from '@/components/route-guards';
import { useAuthStore } from '@/lib/stores/auth-store';

// Mock the auth store
vi.mock('@/lib/stores/auth-store');

// The guard redirects to /login, so /login must be a real route: rendering
// <Navigate> inside a router that falls back to the guarded element again
// re-triggers the redirect on every commit and never settles.
const renderGuarded = (initialEntries: string[] = ['/dashboard']) =>
  render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <ProtectedContent />
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

const ProtectedContent = () => <div>Protected Content</div>;

const mockStateWith = (overrides: Record<string, unknown>) => {
  vi.mocked(useAuthStore).mockImplementation((selector) => {
    const mockState = {
      status: 'unauthenticated',
      user: null,
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      bootstrap: vi.fn(),
      ...overrides,
    };
    return selector ? selector(mockState as never) : mockState;
  });
};

describe('RequireAuth Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the route fallback while status is idle', () => {
    mockStateWith({ status: 'idle' });

    renderGuarded();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows the route fallback while status is loading', () => {
    mockStateWith({ status: 'loading' });

    renderGuarded();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to login when user is unauthenticated', () => {
    mockStateWith({ status: 'unauthenticated' });

    renderGuarded();

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    mockStateWith({
      status: 'authenticated',
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
    });

    renderGuarded();

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('bootstraps the session once while idle', () => {
    const bootstrap = vi.fn();
    mockStateWith({ status: 'idle', bootstrap });

    renderGuarded();

    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it('does not flash a redirect while loading', () => {
    mockStateWith({ status: 'loading' });

    renderGuarded();

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
