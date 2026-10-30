import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { RequireAdmin } from '@/components/route-guards';
import { useAuthStore } from '@/lib/stores/auth-store';

// Mock the auth store
vi.mock('@/lib/stores/auth-store');

// Redirect targets need real routes: a <Navigate> that lands on a router with
// no matching element re-renders the guard and redirects forever.
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/admin']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          <Route path="/admin" element={ui} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
};

const PrivilegedComponent = () => <div>Privileged Content</div>;

const setUser = (userrole?: string) => {
  vi.mocked(useAuthStore).mockImplementation((selector) => {
    const mockState = {
      status: 'authenticated' as const,
      user: userrole
        ? {
            id: 'user-1',
            email: 'user@example.com',
            username: 'user',
            userrole,
            accountStatus: 'active',
            createdAt: '2024-01-01T00:00:00.000Z',
          }
        : null,
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      bootstrap: vi.fn(),
    };
    return selector ? selector(mockState as never) : mockState;
  });
};

// The admin area must be reachable by the whole privileged tier:
// moderator < admin < owner (see @/lib/roles, mirrored from the backend).
describe('RequireAdmin Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admits an owner (apex of the hierarchy)', () => {
    setUser('owner');
    renderWithProviders(
      <RequireAdmin>
        <PrivilegedComponent />
      </RequireAdmin>,
    );
    expect(screen.getByText('Privileged Content')).toBeInTheDocument();
  });

  it('admits an admin', () => {
    setUser('admin');
    renderWithProviders(
      <RequireAdmin>
        <PrivilegedComponent />
      </RequireAdmin>,
    );
    expect(screen.getByText('Privileged Content')).toBeInTheDocument();
  });

  it('admits a moderator, which inherits admin-area access', () => {
    setUser('moderator');
    renderWithProviders(
      <RequireAdmin>
        <PrivilegedComponent />
      </RequireAdmin>,
    );
    expect(screen.getByText('Privileged Content')).toBeInTheDocument();
  });

  it('redirects a plain user to the dashboard', () => {
    setUser('user');
    renderWithProviders(
      <RequireAdmin>
        <PrivilegedComponent />
      </RequireAdmin>,
    );
    expect(screen.queryByText('Privileged Content')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('redirects when the role is missing or unknown', () => {
    setUser(undefined);
    renderWithProviders(
      <RequireAdmin>
        <PrivilegedComponent />
      </RequireAdmin>,
    );
    expect(screen.queryByText('Privileged Content')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('shows the route fallback while the session is still resolving', () => {
    vi.mocked(useAuthStore).mockImplementation((selector) => {
      const mockState = {
        status: 'loading' as const,
        user: null,
        pendingEmail: null,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        bootstrap: vi.fn(),
      };
      return selector ? selector(mockState as never) : mockState;
    });

    renderWithProviders(
      <RequireAdmin>
        <PrivilegedComponent />
      </RequireAdmin>,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('Privileged Content')).not.toBeInTheDocument();
  });
});
