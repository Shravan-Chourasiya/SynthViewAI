import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminInterviewsPage from '@/pages/admin/interviews';
import { interviewService } from '@/lib/services';
import { renderWithProviders } from '@/__tests__/test-utils';

vi.mock('@/lib/services', () => ({
  interviewService: { list: vi.fn() },
  adminService: { stats: vi.fn(), users: vi.fn(), interviews: vi.fn() },
}));

const row = {
  id: 'i1',
  code: 'ABC123',
  roleTitle: 'Backend Engineer',
  company: 'Acme',
  field: 'Engineering',
  type: 'technical' as const,
  difficulty: 'medium' as const,
  experienceLevel: 'mid' as const,
  status: 'completed' as const,
  topics: ['SQL'],
  questionCount: 6,
  rounds: 1,
  durationMinutes: 30,
  score: 78,
  band: 'good' as const,
  summary: null,
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-02T00:00:00.000Z',
  completedAt: '2026-02-02T00:00:00.000Z',
  progress: 100,
  currentRound: 1,
  answeredCount: 6,
  candidateId: 'u1',
};

describe('Admin Interviews Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interviewService.list).mockResolvedValue({
      items: [row],
      total: 1,
      page: 1,
      pageSize: 8,
      totalPages: 1,
    });
  });

  it('renders sessions from the interview service', async () => {
    renderWithProviders(<AdminInterviewsPage />, { route: '/admin/interviews' });

    expect(await screen.findByRole('heading', { name: 'All interviews.' })).toBeInTheDocument();
    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
    expect(interviewService.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: '', status: 'all', type: 'all', page: 1 }),
    );
  });

  it('exposes the search and status filters', async () => {
    renderWithProviders(<AdminInterviewsPage />, { route: '/admin/interviews' });

    expect(await screen.findByLabelText('Search interviews')).toBeInTheDocument();
  });

  it('asks for the filtered slice when the search changes', async () => {
    renderWithProviders(<AdminInterviewsPage />, { route: '/admin/interviews' });
    const input = await screen.findByLabelText('Search interviews');

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(input, { target: { value: 'backend' } });

    await waitFor(() => {
      expect(interviewService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'backend', page: 1 }),
      );
    });
  });

  it('shows an empty state when no session matches', async () => {
    vi.mocked(interviewService.list).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 8,
      totalPages: 0,
    });

    renderWithProviders(<AdminInterviewsPage />, { route: '/admin/interviews' });

    expect(await screen.findByText('No sessions match')).toBeInTheDocument();
  });
});
