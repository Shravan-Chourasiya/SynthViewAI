import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { RequireAdmin } from '@/components/require-auth';
import { useAuthStore } from '@/lib/stores/auth.store';

// Mock the auth store
vi.mock('@/lib/stores/auth.store');

const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/admin']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
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
    return selector ? selector(mockState) : mockState;
  });
};

// The admin area must be reachable by the whole privileged tier:
// moderator < admin < owner (see @/lib/roles).
describe('RequireAdmin Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admits an owner (apex of the hierarchy)', () => {
    setUser('owner');
    renderWithProviders(<RequireAdmin><PrivilegedComponent /></RequireAdmin>);
    expect(screen.getByText('Privileged Content')).toBeInTheDocument();
  });

  it('admits an admin', () => {
    setUser('admin');
    renderWithProviders(<RequireAdmin><PrivilegedComponent /></RequireAdmin>);
    expect(screen.getByText('Privileged Content')).toBeInTheDocument();
  });

  it('admits a moderator, which inherits admin-area access', () => {
    setUser('moderator');
    renderWithProviders(<RequireAdmin><PrivilegedComponent /></RequireAdmin>);
    expect(screen.getByText('Privileged Content')).toBeInTheDocument();
  });

  it('redirects a plain user to the dashboard', () => {
    setUser('user');
    renderWithProviders(<RequireAdmin><PrivilegedComponent /></RequireAdmin>);
    expect(screen.queryByText('Privileged Content')).not.toBeInTheDocument();
  });

  it('redirects when the role is missing or unknown', () => {
    setUser(undefined);
    renderWithProviders(<RequireAdmin><PrivilegedComponent /></RequireAdmin>);
    expect(screen.queryByText('Privileged Content')).not.toBeInTheDocument();
  });
});
