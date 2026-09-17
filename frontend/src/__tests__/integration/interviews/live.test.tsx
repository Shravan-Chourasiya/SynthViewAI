import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useParams } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { LiveRoomPage } from '@/pages/interviews/live';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useLiveInterviewStore } from '@/lib/stores/live-interview.store';

// Define mockNavigate at module level
const mockNavigate = vi.fn();

// Mock the services and navigation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'interview-123' }),
  };
});

vi.mock('@/lib/stores/auth.store');
vi.mock('@/lib/stores/live-interview.store');

// Create wrapper components that include both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/interviews/interview-123/live']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Live Interview Room Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Mock the auth store
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      status: 'authenticated',
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      bootstrap: vi.fn(),
    });
    
    // Mock the live interview store
    vi.mocked(useLiveInterviewStore).mockReturnValue({
      // Add all required store properties
      interview: {
        id: 'interview-123',
        title: 'Frontend Developer Interview',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: new Date().toISOString(),
        duration: 30,
        type: 'TECHNICAL',
        difficulty: 'MEDIUM',
        style: 'REGULAR',
        experienceLevel: 'MID',
        targetCompany: 'Google',
        industry: 'Technology',
        role: 'Frontend Engineer',
        skills: ['React', 'TypeScript'],
        questions: [],
        metadata: {},
        report: null,
        userId: 'user-123'
      },
      question: {
        id: 'q-1',
        text: 'What is React?',
        type: 'TECHNICAL',
        skill: 'React',
        difficulty: 'MEDIUM',
        expectedAnswer: 'React is a JavaScript library...'
      },
      connectionState: 'CONNECTED',
      error: null,
      answeredQuestionIds: [],
      startTime: new Date().toISOString(),
      endTime: null,
      currentQuestionIndex: 0,
      totalQuestions: 5,
      timer: 1800, // 30 minutes in seconds
      setInterview: vi.fn(),
      setQuestion: vi.fn(),
      setConnectionState: vi.fn(),
      setError: vi.fn(),
      markAnswered: vi.fn(),
      setStartTime: vi.fn(),
      setEndTime: vi.fn(),
      setCurrentQuestionIndex: vi.fn(),
      setTotalQuestions: vi.fn(),
      setTimer: vi.fn(),
      reset: vi.fn(),
      applyJoined: vi.fn(),
      applyQuestion: vi.fn(),
      applyStateChange: vi.fn(),
      startTimer: vi.fn(),
      pauseTimer: vi.fn(),
      resumeTimer: vi.fn(),
      cancelTimer: vi.fn(),
      initializeFromInterview: vi.fn(),
    });
  });

  it('renders live interview room with current question', () => {
    renderWithProviders(<LiveRoomPage />);
    
    expect(screen.getByText(/what is react\?/i)).toBeInTheDocument();
    expect(screen.getByText(/react is a javascript library\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/technical/i)).toBeInTheDocument();
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });

  it('shows timer countdown', () => {
    renderWithProviders(<LiveRoomPage />);
    
    // Check for timer display (should show 30 minutes as formatted time)
    expect(screen.getByText(/00:30:00/i)).toBeInTheDocument();
  });

  it('allows user to submit answer', async () => {
    const mockMarkAnswered = vi.fn();
    vi.mocked(useLiveInterviewStore).mockReturnValue({
      // Add all required store properties
      interview: {
        id: 'interview-123',
        title: 'Frontend Developer Interview',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: new Date().toISOString(),
        duration: 30,
        type: 'TECHNICAL',
        difficulty: 'MEDIUM',
        style: 'REGULAR',
        experienceLevel: 'MID',
        targetCompany: 'Google',
        industry: 'Technology',
        role: 'Frontend Engineer',
        skills: ['React', 'TypeScript'],
        questions: [],
        metadata: {},
        report: null,
        userId: 'user-123'
      },
      question: {
        id: 'q-1',
        text: 'What is React?',
        type: 'TECHNICAL',
        skill: 'React',
        difficulty: 'MEDIUM',
        expectedAnswer: 'React is a JavaScript library...'
      },
      connectionState: 'CONNECTED',
      error: null,
      answeredQuestionIds: [],
      startTime: new Date().toISOString(),
      endTime: null,
      currentQuestionIndex: 0,
      totalQuestions: 5,
      timer: 1800,
      setInterview: vi.fn(),
      setQuestion: vi.fn(),
      setConnectionState: vi.fn(),
      setError: vi.fn(),
      markAnswered: mockMarkAnswered,
      setStartTime: vi.fn(),
      setEndTime: vi.fn(),
      setCurrentQuestionIndex: vi.fn(),
      setTotalQuestions: vi.fn(),
      setTimer: vi.fn(),
      reset: vi.fn(),
      applyJoined: vi.fn(),
      applyQuestion: vi.fn(),
      applyStateChange: vi.fn(),
      startTimer: vi.fn(),
      pauseTimer: vi.fn(),
      resumeTimer: vi.fn(),
      cancelTimer: vi.fn(),
      initializeFromInterview: vi.fn(),
    });

    renderWithProviders(<LiveRoomPage />);
    
    const answerInput = screen.getByPlaceholderText(/type your answer/i);
    fireEvent.change(answerInput, { target: { value: 'My answer to this question' } });
    
    const submitButton = screen.getByRole('button', { name: /submit answer/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockMarkAnswered).toHaveBeenCalledWith('q-1');
    });
  });

  it('shows next question after submitting answer', async () => {
    const mockSetQuestion = vi.fn();
    vi.mocked(useLiveInterviewStore).mockReturnValue({
      // Add all required store properties
      interview: {
        id: 'interview-123',
        title: 'Frontend Developer Interview',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: new Date().toISOString(),
        duration: 30,
        type: 'TECHNICAL',
        difficulty: 'MEDIUM',
        style: 'REGULAR',
        experienceLevel: 'MID',
        targetCompany: 'Google',
        industry: 'Technology',
        role: 'Frontend Engineer',
        skills: ['React', 'TypeScript'],
        questions: [],
        metadata: {},
        report: null,
        userId: 'user-123'
      },
      question: {
        id: 'q-2',
        text: 'How do you manage state in React?',
        type: 'TECHNICAL',
        skill: 'React',
        difficulty: 'MEDIUM',
        expectedAnswer: 'Using useState, useContext, useReducer...'
      },
      connectionState: 'CONNECTED',
      error: null,
      answeredQuestionIds: ['q-1'],
      startTime: new Date().toISOString(),
      endTime: null,
      currentQuestionIndex: 1,
      totalQuestions: 5,
      timer: 1700,
      setInterview: vi.fn(),
      setQuestion: mockSetQuestion,
      setConnectionState: vi.fn(),
      setError: vi.fn(),
      markAnswered: vi.fn(),
      setStartTime: vi.fn(),
      setEndTime: vi.fn(),
      setCurrentQuestionIndex: vi.fn(),
      setTotalQuestions: vi.fn(),
      setTimer: vi.fn(),
      reset: vi.fn(),
      applyJoined: vi.fn(),
      applyQuestion: vi.fn(),
      applyStateChange: vi.fn(),
      startTimer: vi.fn(),
      pauseTimer: vi.fn(),
      resumeTimer: vi.fn(),
      cancelTimer: vi.fn(),
      initializeFromInterview: vi.fn(),
    });

    renderWithProviders(<LiveRoomPage />);
    
    expect(screen.getByText(/how do you manage state in react\?/i)).toBeInTheDocument();
  });

  it('allows pausing and resuming interview', async () => {
    const mockApplyStateChange = vi.fn();
    vi.mocked(useLiveInterviewStore).mockReturnValue({
      // Add all required store properties
      interview: {
        id: 'interview-123',
        title: 'Frontend Developer Interview',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: new Date().toISOString(),
        duration: 30,
        type: 'TECHNICAL',
        difficulty: 'MEDIUM',
        style: 'REGULAR',
        experienceLevel: 'MID',
        targetCompany: 'Google',
        industry: 'Technology',
        role: 'Frontend Engineer',
        skills: ['React', 'TypeScript'],
        questions: [],
        metadata: {},
        report: null,
        userId: 'user-123'
      },
      question: {
        id: 'q-1',
        text: 'What is React?',
        type: 'TECHNICAL',
        skill: 'React',
        difficulty: 'MEDIUM',
        expectedAnswer: 'React is a JavaScript library...'
      },
      connectionState: 'CONNECTED',
      error: null,
      answeredQuestionIds: [],
      startTime: new Date().toISOString(),
      endTime: null,
      currentQuestionIndex: 0,
      totalQuestions: 5,
      timer: 1800,
      setInterview: vi.fn(),
      setQuestion: vi.fn(),
      setConnectionState: vi.fn(),
      setError: vi.fn(),
      markAnswered: vi.fn(),
      setStartTime: vi.fn(),
      setEndTime: vi.fn(),
      setCurrentQuestionIndex: vi.fn(),
      setTotalQuestions: vi.fn(),
      setTimer: vi.fn(),
      reset: vi.fn(),
      applyJoined: vi.fn(),
      applyQuestion: vi.fn(),
      applyStateChange: mockApplyStateChange,
      startTimer: vi.fn(),
      pauseTimer: vi.fn(),
      resumeTimer: vi.fn(),
      cancelTimer: vi.fn(),
      initializeFromInterview: vi.fn(),
    });

    renderWithProviders(<LiveRoomPage />);
    
    const pauseButton = screen.getByRole('button', { name: /pause interview/i });
    fireEvent.click(pauseButton);
    
    await waitFor(() => {
      expect(mockApplyStateChange).toHaveBeenCalledWith({ status: 'PAUSED' });
    });
  });

  it('allows cancelling interview', async () => {
    renderWithProviders(<LiveRoomPage />);
    
    const cancelButton = screen.getByRole('button', { name: /cancel interview/i });
    fireEvent.click(cancelButton);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/interviews');
    });
  });

  it('shows completion screen when all questions are answered', () => {
    vi.mocked(useLiveInterviewStore).mockReturnValue({
      // Add all required store properties
      interview: {
        id: 'interview-123',
        title: 'Frontend Developer Interview',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: new Date().toISOString(),
        duration: 30,
        type: 'TECHNICAL',
        difficulty: 'MEDIUM',
        style: 'REGULAR',
        experienceLevel: 'MID',
        targetCompany: 'Google',
        industry: 'Technology',
        role: 'Frontend Engineer',
        skills: ['React', 'TypeScript'],
        questions: [],
        metadata: {},
        report: null,
        userId: 'user-123'
      },
      question: null,
      connectionState: 'DISCONNECTED',
      error: null,
      answeredQuestionIds: ['q-1', 'q-2', 'q-3', 'q-4', 'q-5'], // All questions answered
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      currentQuestionIndex: 5,
      totalQuestions: 5,
      timer: 0,
      setInterview: vi.fn(),
      setQuestion: vi.fn(),
      setConnectionState: vi.fn(),
      setError: vi.fn(),
      markAnswered: vi.fn(),
      setStartTime: vi.fn(),
      setEndTime: vi.fn(),
      setCurrentQuestionIndex: vi.fn(),
      setTotalQuestions: vi.fn(),
      setTimer: vi.fn(),
      reset: vi.fn(),
      applyJoined: vi.fn(),
      applyQuestion: vi.fn(),
      applyStateChange: vi.fn(),
      startTimer: vi.fn(),
      pauseTimer: vi.fn(),
      resumeTimer: vi.fn(),
      cancelTimer: vi.fn(),
      initializeFromInterview: vi.fn(),
    });

    renderWithProviders(<LiveRoomPage />);
    
    expect(screen.getByText(/interview completed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view report/i })).toBeInTheDocument();
  });
});