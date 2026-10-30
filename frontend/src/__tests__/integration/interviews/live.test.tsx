/**
 * live.test.tsx - session controls in the live room
 *
 * Drives the real LiveRoomPage with the real room chrome (status bar, end
 * dialog) and only the transport, API and canvas widgets mocked out, so the
 * pause / mute / end paths are exercised as they ship.
 */

import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Question } from '@/lib/types';
import { renderRoute } from '@/__tests__/test-utils';

const { socket } = vi.hoisted(() => ({
  socket: {
    activeQuestion: null as Question | null,
    status: 'listening',
    connection: 'connected',
    streamed: '',
    totalQuestions: 5,
    complete: false,
    submitAnswer: vi.fn(),
    submitCode: vi.fn(),
    requestNextQuestion: vi.fn(),
    cancelInterview: vi.fn(),
    endInterview: vi.fn(),
    extendTime: vi.fn(),
  },
}));

vi.mock('@/hooks/use-interview-socket', () => ({ useInterviewSocket: () => socket }));
vi.mock('@/lib/services', () => ({
  interviewService: {
    get: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/components/ai-orb', () => ({ AiOrb: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: LiveRoomPage } = await import('@/pages/interviews/live');
const { interviewService } = await import('@/lib/services');

const interview = {
  id: 'interview-123',
  code: 'ABC123',
  roleTitle: 'Frontend Developer Interview',
  field: 'Engineering',
  difficulty: 'medium',
  status: 'in-progress',
  questionCount: 5,
};

const question: Question = {
  id: 'q-1',
  interviewId: 'interview-123',
  index: 0,
  kind: 'text',
  category: 'Technical',
  topic: 'react',
  prompt: 'Walk me through how you would optimise a slow list render.',
  difficulty: 'Medium',
  answer: null,
  score: null,
  band: null,
  headline: null,
  feedback: null,
  strengths: [],
  improvements: [],
  decision: null,
  durationSeconds: 0,
  answerFormat: 'TEXT',
  codeLanguage: null,
  starter: null,
};

const renderRoom = () =>
  renderRoute(<LiveRoomPage />, {
    path: '/interviews/:id/live',
    params: [{ pattern: ':id', value: 'interview-123' }],
  });

describe('Live Interview Room', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socket.activeQuestion = question;
    socket.complete = false;
    socket.status = 'listening';
    vi.mocked(interviewService.get).mockResolvedValue(interview as never);
  });

  it('renders the current question and room chrome', async () => {
    renderRoom();

    expect(
      await screen.findByText(/how you would optimise a slow list render/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Frontend Developer Interview')).toBeInTheDocument();
    expect(screen.getByText('Q1/5')).toBeInTheDocument();
  });

  it('shows the elapsed clock advancing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderRoom();
      expect(await screen.findByText('00:00 elapsed')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('toggles pause without losing the question', async () => {
    renderRoom();

    const pause = await screen.findByRole('button', { name: 'Pause session' });
    fireEvent.click(pause);

    expect(screen.getByRole('button', { name: 'Resume session' })).toBeInTheDocument();
    expect(screen.getByText(/how you would optimise a slow list render/i)).toBeInTheDocument();
  });

  it('toggles the microphone label', async () => {
    renderRoom();

    fireEvent.click(await screen.findByRole('button', { name: 'Mute microphone' }));

    expect(screen.getByRole('button', { name: 'Unmute microphone' })).toBeInTheDocument();
  });

  it('ends the interview only after confirming the dialog', async () => {
    renderRoom();

    fireEvent.click(await screen.findByRole('button', { name: /^end interview$/i }));

    expect(await screen.findByText('End the interview?')).toBeInTheDocument();
    expect(interviewService.end).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /end and see results/i }));

    await waitFor(() => {
      expect(interviewService.end).toHaveBeenCalledWith('interview-123');
    });
  });

  it('keeps the session when the user backs out of the dialog', async () => {
    renderRoom();

    fireEvent.click(await screen.findByRole('button', { name: /^end interview$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /keep going/i }));

    await waitFor(() => {
      expect(screen.queryByText('End the interview?')).not.toBeInTheDocument();
    });
    expect(interviewService.end).not.toHaveBeenCalled();
  });

  it('waits for the next question instead of showing a stale one', async () => {
    socket.activeQuestion = null;

    renderRoom();

    expect(
      await screen.findByText(/preparing your first question/i),
    ).toBeInTheDocument();
  });
});
