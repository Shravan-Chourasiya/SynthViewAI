import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminUsersPage from '@/pages/admin/users';
import { adminService } from '@/lib/services';
import { renderWithProviders } from '@/__tests__/test-utils';

vi.mock('@/lib/services', () => ({
  adminService: {
    users: vi.fn(),
    stats: vi.fn(),
    interviews: vi.fn(),
    setStatus: vi.fn(),
    setRole: vi.fn(),
  },
}));

const ROWS = [
  {
    id: 'u1',
    name: 'Ada Lovelace',
    username: 'ada',
    email: 'ada@example.com',
    role: 'candidate' as const,
    status: 'active' as const,
    interviews: 7,
    avgScore: 82,
    joinedAt: '2026-01-04T00:00:00.000Z',
    lastActiveAt: '2026-02-01T00:00:00.000Z',
  },
  {
    id: 'u2',
    name: 'Grace Hopper',
    username: 'grace',
    email: 'grace@example.com',
    role: 'reviewer' as const,
    status: 'suspended' as const,
    interviews: 2,
    avgScore: null,
    joinedAt: '2026-01-11T00:00:00.000Z',
    lastActiveAt: '2026-01-20T00:00:00.000Z',
  },
];

describe('Admin Users Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminService.users).mockResolvedValue(ROWS);
  });

  it('lists accounts returned by the admin service', async () => {
    renderWithProviders(<AdminUsersPage />, { route: '/admin/users' });

    expect(await screen.findByRole('heading', { name: 'Users.' })).toBeInTheDocument();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('grace@example.com')).toBeInTheDocument();
    expect(screen.getByText('2 shown')).toBeInTheDocument();
    expect(adminService.users).toHaveBeenCalledWith({ search: '', role: 'all', status: 'all' });
  });

  it('exposes search and filter controls', async () => {
    renderWithProviders(<AdminUsersPage />, { route: '/admin/users' });

    expect(await screen.findByLabelText('Search users')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by role')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
  });

  it('shows an empty state rather than a fake row', async () => {
    vi.mocked(adminService.users).mockResolvedValue([]);

    renderWithProviders(<AdminUsersPage />, { route: '/admin/users' });

    expect(await screen.findByText('No users match')).toBeInTheDocument();
    expect(screen.getByText('0 shown')).toBeInTheDocument();
  });

  it('asks the service again when the search term changes', async () => {
    const { container } = renderWithProviders(<AdminUsersPage />, { route: '/admin/users' });
    const input = await screen.findByLabelText('Search users');

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(input, { target: { value: 'ada' } });

    await waitFor(() => {
      expect(adminService.users).toHaveBeenLastCalledWith({ search: 'ada', role: 'all', status: 'all' });
    });
    expect(container).toBeTruthy();
  });
});
