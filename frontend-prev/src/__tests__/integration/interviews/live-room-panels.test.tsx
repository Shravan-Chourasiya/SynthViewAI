/**
 * live-room-panels.test.tsx — the live room chooses its answer surface per question
 *
 * The backend decides a question's answerFormat; the room must render the code editor
 * for CODE and the prose panel for everything else, and route each submission to the
 * matching socket event. This drives the real LiveRoomPage with the transport, API and
 * heavy media widgets mocked out.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Question } from '@/lib/types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { storeState, socket, api } = vi.hoisted(() => ({
  storeState: {} as Record<string, unknown>,
  socket: {
    connectionState: 'connected',
    submitAnswer: vi.fn(),
    submitCode: vi.fn(),
    requestNextQuestion: vi.fn(),
    cancelInterview: vi.fn(),
    endInterview: vi.fn(),
    extendTime: vi.fn(),
  },
  api: { getInterview: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ api }));

vi.mock('@/hooks/use-interview-socket', () => ({
  useInterviewSocket: () => socket,
}));

vi.mock('@/lib/stores/live-interview.store', () => ({
  useLiveInterviewStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(storeState),
  remainingSecondsFor: () => 0,
}));

vi.mock('@/lib/stores/auth.store', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: { id: 'user-1', username: 'candidate', firstName: 'Cand', lastName: 'Idate' },
    }),
}));

// The room's media widgets are irrelevant here and pull in browsers APIs jsdom lacks.
vi.mock('@/components/interview-room/widgets', () => ({
  AiStatusBar: () => null,
  CandidateControls: () => null,
  ConnectionIndicator: () => null,
  EndInterviewDialog: () => null,
  InterviewTimer: () => null,
  TimeUpDialog: () => null,
  VideoTile: () => null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'interview-1' }),
  };
});

const { LiveRoomPage } = await import('@/pages/interviews/live');

// ── Fixtures ──────────────────────────────────────────────────────────────────

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-text-1',
    index: 0,
    kind: 'text',
    category: 'Technical',
    topic: 'react',
    difficulty: 'Medium',
    text: 'What is a closure?',
    ...overrides,
  };
}

function baseState(currentQuestion: Question | null) {
  return {
    connectionState: 'connected',
    aiStatus: 'idle',
    currentQuestion,
    questionNumber: 1,
    answeredCount: 0,
    totalQuestions: 3,
    interviewStatus: 'INPROGRESS',
    error: null,
    mediaStream: null,
    clearMediaStream: vi.fn(),
    setMediaStream: vi.fn(),
    timeExpired: false,
    remainingSeconds: 600,
  };
}

function renderRoom() {
  return render(
    <MemoryRouter>
      <LiveRoomPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  Object.assign(storeState, baseState(question()));
  api.getInterview.mockResolvedValue({
    id: 'interview-1',
    roleTitle: 'Backend Engineer',
    type: 'TECHNICAL',
    difficulty: 'MEDIUM',
    durationMin: 30,
    currentRound: 1,
    rounds: [],
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LiveRoomPage — answer surface by question kind', () => {
  it('renders the prose panel for a text question', async () => {
    renderRoom();

    expect(
      await screen.findByRole('textbox', { name: /your answer/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('code-answer-panel')).toBeNull();
  });

  it('renders the code panel for a code question', async () => {
    Object.assign(
      storeState,
      baseState(
        question({
          id: 'q-code-1',
          kind: 'code',
          text: 'Write a function that reverses a linked list.',
          codeLanguage: 'python',
        }),
      ),
    );

    renderRoom();

    expect(await screen.findByTestId('code-answer-panel')).toBeInTheDocument();
    expect(screen.getByLabelText('Answer language')).toHaveValue('python');
    expect(screen.queryByRole('textbox', { name: /your answer/i })).toBeNull();
  });

  it('submits a text answer through answer:submit', async () => {
    renderRoom();
    const editor = await screen.findByRole('textbox', { name: /your answer/i });

    fireEvent.change(editor, { target: { value: 'A closure captures its scope.' } });
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));

    expect(socket.submitAnswer).toHaveBeenCalledWith('q-text-1', 'A closure captures its scope.');
    expect(socket.submitCode).not.toHaveBeenCalled();
  });

  it('submits a code answer through code:submit with the language', async () => {
    Object.assign(
      storeState,
      baseState(question({ id: 'q-code-1', kind: 'code', codeLanguage: 'python' })),
    );

    renderRoom();
    const editor = await screen.findByTestId('code-answer-input');

    fireEvent.change(editor, { target: { value: 'def reverse(head):\n    return head' } });
    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });

    expect(socket.submitCode).toHaveBeenCalledWith(
      'q-code-1',
      'python',
      'def reverse(head):\n    return head',
    );
    expect(socket.submitAnswer).not.toHaveBeenCalled();
  });
});
