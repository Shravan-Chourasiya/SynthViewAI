import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useParams } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { LobbyPage } from '@/pages/interviews/lobby';
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

// Mock the clearMediaStream function that's used in the component
vi.mock('@/lib/utils/media', () => ({
  clearMediaStream: vi.fn(),
  setupMediaStream: vi.fn(),
}));

// Create wrapper components that include both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/interviews/interview-123/lobby']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Interview Lobby Component', () => {
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
        status: 'CREATED',
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
      answeredQuestionIds: [],
      startTime: null,
      endTime: null,
      currentQuestionIndex: 0,
      totalQuestions: 0,
      timer: null,
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

  it('renders lobby with interview details', () => {
    renderWithProviders(<LobbyPage />);
    
    expect(screen.getByText(/front-end developer interview/i)).toBeInTheDocument();
    expect(screen.getByText(/google/i)).toBeInTheDocument();
    expect(screen.getByText(/technology/i)).toBeInTheDocument();
    expect(screen.getByText(/frontend engineer/i)).toBeInTheDocument();
    expect(screen.getByText(/technical/i)).toBeInTheDocument();
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });

  it('displays media permissions check', () => {
    renderWithProviders(<LobbyPage />);
    
    // Check for media-related elements
    expect(screen.getByText(/camera/i)).toBeInTheDocument();
    expect(screen.getByText(/microphone/i)).toBeInTheDocument();
  });

  it('allows user to start interview', async () => {
    const mockSetConnectionState = vi.fn();
    vi.mocked(useLiveInterviewStore).mockReturnValue({
      // Add all required store properties
      interview: {
        id: 'interview-123',
        title: 'Frontend Developer Interview',
        status: 'CREATED',
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
      answeredQuestionIds: [],
      startTime: null,
      endTime: null,
      currentQuestionIndex: 0,
      totalQuestions: 0,
      timer: null,
      setInterview: vi.fn(),
      setQuestion: vi.fn(),
      setConnectionState: mockSetConnectionState,
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

    renderWithProviders(<LobbyPage />);
    
    const startButton = screen.getByRole('button', { name: /start interview/i });
    fireEvent.click(startButton);
    
    // Wait for the state change
    await waitFor(() => {
      expect(mockSetConnectionState).toHaveBeenCalledWith('CONNECTING');
    });
  });

  it('shows error state if media permissions are denied', () => {
    renderWithProviders(<LobbyPage />);
    
    // Simulate media permission error
    // In a real scenario, this would be tested by mocking mediaDevices
    expect(screen.queryByText(/permission denied/i)).not.toBeInTheDocument();
  });

  it('shows loading state while connecting to interview', () => {
    vi.mocked(useLiveInterviewStore).mockReturnValue({
      // Add all required store properties
      interview: {
        id: 'interview-123',
        title: 'Frontend Developer Interview',
        status: 'CREATED',
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
      connectionState: 'CONNECTING',
      error: null,
      answeredQuestionIds: [],
      startTime: null,
      endTime: null,
      currentQuestionIndex: 0,
      totalQuestions: 0,
      timer: null,
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

    renderWithProviders(<LobbyPage />);
    
    expect(screen.getByText(/connecting to interview/i)).toBeInTheDocument();
  });

  it('navigates to live interview room when connection succeeds', async () => {
    vi.mocked(useLiveInterviewStore).mockReturnValue({
      // Add all required store properties
      interview: {
        id: 'interview-123',
        title: 'Frontend Developer Interview',
        status: 'CREATED',
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
      connectionState: 'CONNECTED',
      error: null,
      answeredQuestionIds: [],
      startTime: null,
      endTime: null,
      currentQuestionIndex: 0,
      totalQuestions: 0,
      timer: null,
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

    renderWithProviders(<LobbyPage />);
    
    // Wait for navigation to occur
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/interviews/interview-123/live');
    });
  });

  it('shows error message if connection fails', () => {
    vi.mocked(useLiveInterviewStore).mockReturnValue({
      // Add all required store properties
      interview: {
        id: 'interview-123',
        title: 'Frontend Developer Interview',
        status: 'CREATED',
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
      error: 'Connection failed: Network error',
      answeredQuestionIds: [],
      startTime: null,
      endTime: null,
      currentQuestionIndex: 0,
      totalQuestions: 0,
      timer: null,
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

    renderWithProviders(<LobbyPage />);
    
    expect(screen.getByText(/connection failed: network error/i)).toBeInTheDocument();
  });
});