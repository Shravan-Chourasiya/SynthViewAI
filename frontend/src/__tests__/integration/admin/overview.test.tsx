import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminOverviewPage from '@/pages/admin/index';
import { adminService } from '@/lib/services';
import { renderWithProviders } from '@/__tests__/test-utils';

vi.mock('@/lib/services', () => ({
  adminService: {
    stats: vi.fn(),
    users: vi.fn(),
    interviews: vi.fn(),
  },
}));

const STATS = {
  kpis: [
    { label: 'Total accounts', value: 12, delta: '+3 this week', hint: 'all time' },
    { label: 'Sessions run', value: 34, delta: '+8 this week', hint: 'all time' },
    { label: 'Live now', value: 2, delta: 'steady', hint: 'in the last hour' },
    { label: 'Average score', value: 72, delta: '+4', hint: 'last 30 days' },
  ],
  signups: [
    { label: 'W1', users: 3, interviews: 4 },
    { label: 'W2', users: 5, interviews: 7 },
  ],
  statusMix: [
    { status: 'Completed', count: 30 },
    { status: 'In progress', count: 4 },
  ],
  scoreBands: [
    { band: 'Strong', count: 10 },
    { band: 'Good', count: 14 },
    { band: 'Vague', count: 6 },
  ],
  topRoles: [{ role: 'Backend Engineer', count: 11, avgScore: 78 }],
};

describe('Admin Overview Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminService.stats).mockResolvedValue(STATS);
  });

  it('renders the platform overview from the service, not hardcoded values', async () => {
    renderWithProviders(<AdminOverviewPage />, { route: '/admin' });

    expect(
      await screen.findByRole('heading', { name: 'Platform overview.' }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('34')).toBeInTheDocument();
    });
    expect(screen.getByText('Total accounts')).toBeInTheDocument();
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(adminService.stats).toHaveBeenCalledTimes(1);
  });

  it('shows the session mix total from the status rows', async () => {
    renderWithProviders(<AdminOverviewPage />, { route: '/admin' });

    expect(await screen.findByText('34 sessions')).toBeInTheDocument();
  });

  it('reports a load failure instead of inventing statistics', async () => {
    vi.mocked(adminService.stats).mockRejectedValue(new Error('boom'));

    renderWithProviders(<AdminOverviewPage />, { route: '/admin' });

    expect(
      await screen.findByText('Could not load platform statistics.'),
    ).toBeInTheDocument();
  });
});
