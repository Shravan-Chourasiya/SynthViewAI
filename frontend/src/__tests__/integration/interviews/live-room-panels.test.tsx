/**
 * live-room-panels.test.tsx - the live room chooses its answer surface per question
 *
 * The backend decides a question's answerFormat; the room must render the code
 * editor for CODE and the prose panel for everything else, and route each
 * submission to the matching socket call. This drives the real LiveRoomPage with
 * the transport, API and heavy media widgets mocked out.
 */

import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Question } from '@/lib/types';
import { renderRoute } from '@/__tests__/test-utils';

// ---- Mocks -----------------------------------------------------------------

const { socket, submitted } = vi.hoisted(() => ({
  socket: {
    activeQuestion: null as Question | null,
    answerFormat: null as string | null,
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
  submitted: { answers: [] as string[], codes: [] as { code: string; language: string }[] },
}));

vi.mock('@/hooks/use-interview-socket', () => ({
  useInterviewSocket: () => socket,
}));

vi.mock('@/lib/services', () => ({
  interviewService: {
    get: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
  },
}));

// The orb and the camera tile animate against APIs jsdom does not implement.
vi.mock('@/components/ai-orb', () => ({ AiOrb: () => null }));
vi.mock('@/components/interview-room/room-parts', () => ({
  AiStatusBar: () => null,
  CameraTile: () => null,
  ConnectionChip: () => null,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: LiveRoomPage } = await import('@/pages/interviews/live');
const { interviewService } = await import('@/lib/services');

const interview = {
  id: 'interview-1',
  code: 'ABC123',
  roleTitle: 'Backend Engineer',
  field: 'Engineering',
  difficulty: 'medium',
  status: 'in-progress',
  questionCount: 5,
};

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-text-1',
    interviewId: 'interview-1',
    index: 0,
    kind: 'text',
    category: 'Technical',
    topic: 'react',
    prompt: 'Explain how React schedules renders.',
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
    ...overrides,
  };
}

const renderRoom = () =>
  renderRoute(<LiveRoomPage />, {
    path: '/interviews/:id/live',
    params: [{ pattern: ':id', value: 'interview-1' }],
  });

beforeEach(() => {
  vi.clearAllMocks();
  submitted.answers.length = 0;
  submitted.codes.length = 0;
  window.localStorage.clear();
  socket.activeQuestion = null;
  socket.answerFormat = null;
  vi.mocked(interviewService.get).mockResolvedValue(interview as never);
  socket.submitAnswer.mockImplementation((_id: string, answer: string) =>
    submitted.answers.push(answer),
  );
  socket.submitCode.mockImplementation((_id: string, language: string, code: string) =>
    submitted.codes.push({ code, language }),
  );
});

describe('LiveRoomPage - answer surface by question kind', () => {
  it('renders the prose panel for a text question', async () => {
    socket.activeQuestion = question();

    renderRoom();

    expect(await screen.findByLabelText('Your answer')).toBeInTheDocument();
    expect(screen.queryByTestId('code-answer-panel')).not.toBeInTheDocument();
  });

  it('renders the code panel for a code question', async () => {
    socket.activeQuestion = question({
      id: 'q-code-1',
      kind: 'code',
      answerFormat: 'CODE',
      codeLanguage: 'javascript',
      prompt: 'Reverse a linked list.',
    });

    renderRoom();

    expect(await screen.findByTestId('code-answer-panel')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument();
  });

  it('treats answerFormat CODE as code even when kind says text', async () => {
    // The backend decides the surface; the client must not infer it from text.
    socket.activeQuestion = question({ id: 'q-code-2', kind: 'text', answerFormat: 'CODE' });

    renderRoom();

    expect(await screen.findByTestId('code-answer-panel')).toBeInTheDocument();
  });

  it('submits a text answer through answer:submit', async () => {
    socket.activeQuestion = question();

    renderRoom();

    fireEvent.change(await screen.findByLabelText('Your answer'), {
      target: { value: 'React batches updates in a scheduler.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));

    await waitFor(() => {
      expect(socket.submitAnswer).toHaveBeenCalledWith(
        'q-text-1',
        'React batches updates in a scheduler.',
      );
    });
    expect(submitted.answers).toEqual(['React batches updates in a scheduler.']);
    expect(socket.submitCode).not.toHaveBeenCalled();
  });

  it('submits a code answer through code:submit with the language', async () => {
    socket.activeQuestion = question({
      id: 'q-code-3',
      kind: 'code',
      answerFormat: 'CODE',
      codeLanguage: 'python',
      prompt: 'Print the Fibonacci sequence.',
    });

    renderRoom();

    const editor = await screen.findByTestId('code-answer-input');
    fireEvent.change(editor, { target: { value: 'print(1)' } });
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));

    await waitFor(() => {
      expect(socket.submitCode).toHaveBeenCalledWith('q-code-3', 'python', 'print(1)');
    });
    expect(socket.submitAnswer).not.toHaveBeenCalled();
  });
});
