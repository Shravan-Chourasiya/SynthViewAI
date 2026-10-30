/**
 * lobby.test.tsx - pre-flight gate for the live room
 *
 * The lobby reads the interview through the API and gates "Start interview" on
 * the camera and microphone checks, so a candidate never enters the room blind.
 */

import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderRoute } from '@/__tests__/test-utils';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/lib/services', () => ({
  interviewService: { get: vi.fn(), start: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: LobbyPage } = await import('@/pages/interviews/lobby');
const { interviewService } = await import('@/lib/services');

const interview = {
  id: 'interview-123',
  code: 'ABC123',
  roleTitle: 'Frontend Engineer',
  field: 'Engineering',
  company: 'Acme',
  type: 'technical',
  difficulty: 'medium',
  experienceLevel: 'mid',
  status: 'scheduled',
  topics: ['react'],
  questionCount: 5,
  rounds: 1,
  durationMinutes: 30,
  score: null,
  band: null,
  summary: null,
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  completedAt: null,
  progress: 0,
  currentRound: 1,
  answeredCount: 0,
  candidateId: 'u1',
};

const renderLobby = () =>
  renderRoute(<LobbyPage />, {
    path: '/interviews/:id/lobby',
    params: [{ pattern: ':id', value: 'interview-123' }],
  });

describe('Interview Lobby', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    vi.mocked(interviewService.get).mockResolvedValue(interview as never);
  });

  it('renders the interview summary the candidate is about to sit', async () => {
    renderLobby();

    expect(await screen.findByText('Your room is ready.')).toBeInTheDocument();
    expect(screen.getByText('Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('30 minutes')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('blocks the start button until the environment checks pass', async () => {
    renderLobby();

    const start = await screen.findByRole('button', { name: /start interview/i });
    expect(start).toBeDisabled();
    expect(screen.getByText(/checks required/i)).toBeInTheDocument();
  });

  it('unlocks the start button once both checks pass', async () => {
    renderLobby();

    fireEvent.click(await screen.findByRole('button', { name: /run all checks/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start interview/i })).toBeEnabled();
    });
    expect(screen.getByText(/all checks passed/i)).toBeInTheDocument();
  });

  it('surfaces a denied permission instead of pretending the check passed', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
      new Error('Permission denied'),
    );

    renderLobby();

    fireEvent.click(await screen.findByRole('button', { name: /run all checks/i }));

    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /start interview/i })).toBeDisabled();
  });

  it('opens the rules dialog and only enters the room after the countdown', async () => {
    renderLobby();

    fireEvent.click(await screen.findByRole('button', { name: /run all checks/i }));
    const start = await screen.findByRole('button', { name: /start interview/i });
    await waitFor(() => expect(start).toBeEnabled());

    fireEvent.click(start);

    expect(await screen.findByText('Before you begin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm in 7s/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /not yet/i }));

    await waitFor(() => {
      expect(screen.queryByText('Before you begin')).not.toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('reports a missing interview rather than an empty lobby', async () => {
    vi.mocked(interviewService.get).mockResolvedValue(null);

    renderLobby();

    expect(await screen.findByText('That session no longer exists')).toBeInTheDocument();
  });

  it('offers the resume copy for an in-progress session', async () => {
    vi.mocked(interviewService.get).mockResolvedValue({
      ...interview,
      status: 'in-progress',
      progress: 40,
      answeredCount: 2,
    } as never);

    renderLobby();

    expect(await screen.findByText('Ready to continue?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume interview/i })).toBeInTheDocument();
  });
});
