import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useParams } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { CompletedPage } from '@/pages/interviews/completed';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useInterviewStore } from '@/lib/stores/interview.store';

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
vi.mock('@/lib/stores/interview.store');

// Create wrapper components that include both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/interviews/interview-123/completed']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Completed Interview Component', () => {
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
    
    // Mock the interview store
    vi.mocked(useInterviewStore).mockReturnValue({
      interviews: [],
      currentInterview: {
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
        report: {
          id: 'report-123',
          interviewId: 'interview-123',
          overallScore: 85,
          feedback: 'Great performance overall',
          strengths: ['React', 'Problem Solving'],
          areasForImprovement: ['CSS', 'Testing'],
          recommendations: ['Practice CSS layouts', 'Learn more testing frameworks'],
          questions: [
            {
              questionId: 'q-1',
              score: 90,
              feedback: 'Excellent answer',
              suggestions: ['Good use of hooks']
            }
          ],
          createdAt: new Date().toISOString()
        },
        userId: 'user-123'
      },
      loading: false,
      error: null,
      loadInterview: vi.fn(),
      loadInterviews: vi.fn(),
      createInterview: vi.fn(),
      updateInterview: vi.fn(),
      deleteInterview: vi.fn(),
      setCurrentInterview: vi.fn(),
      clearCurrentInterview: vi.fn(),
      reset: vi.fn(),
    });
  });

  it('renders completed interview with report details', () => {
    renderWithProviders(<CompletedPage />);
    
    expect(screen.getByText(/interview completed/i)).toBeInTheDocument();
    expect(screen.getByText(/frontend developer interview/i)).toBeInTheDocument();
    expect(screen.getByText(/google/i)).toBeInTheDocument();
    expect(screen.getByText(/85/i)).toBeInTheDocument(); // Overall score
    expect(screen.getByText(/great performance overall/i)).toBeInTheDocument();
  });

  it('displays strengths and improvement areas', () => {
    renderWithProviders(<CompletedPage />);
    
    expect(screen.getByText(/strengths/i)).toBeInTheDocument();
    expect(screen.getByText(/react/i)).toBeInTheDocument();
    expect(screen.getByText(/problem solving/i)).toBeInTheDocument();
    
    expect(screen.getByText(/areas for improvement/i)).toBeInTheDocument();
    expect(screen.getByText(/css/i)).toBeInTheDocument();
    expect(screen.getByText(/testing/i)).toBeInTheDocument();
  });

  it('shows question-specific feedback', () => {
    renderWithProviders(<CompletedPage />);
    
    expect(screen.getByText(/excellent answer/i)).toBeInTheDocument();
    expect(screen.getByText(/good use of hooks/i)).toBeInTheDocument();
  });

  it('allows user to view full report', () => {
    renderWithProviders(<CompletedPage />);
    
    const viewReportButton = screen.getByRole('button', { name: /view full report/i });
    expect(viewReportButton).toBeInTheDocument();
    
    fireEvent.click(viewReportButton);
    
    // Check if it navigates to the report page
    expect(mockNavigate).toHaveBeenCalledWith(`/interviews/interview-123/report`);
  });

  it('allows user to start new interview', () => {
    renderWithProviders(<CompletedPage />);
    
    const newInterviewButton = screen.getByRole('button', { name: /new interview/i });
    expect(newInterviewButton).toBeInTheDocument();
    
    fireEvent.click(newInterviewButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/new');
  });

  it('allows user to go back to dashboard', () => {
    renderWithProviders(<CompletedPage />);
    
    const dashboardButton = screen.getByRole('button', { name: /back to dashboard/i });
    expect(dashboardButton).toBeInTheDocument();
    
    fireEvent.click(dashboardButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('displays recommendations for improvement', () => {
    renderWithProviders(<CompletedPage />);
    
    expect(screen.getByText(/recommendations/i)).toBeInTheDocument();
    expect(screen.getByText(/practice css layouts/i)).toBeInTheDocument();
    expect(screen.getByText(/learn more testing frameworks/i)).toBeInTheDocument();
  });

  it('shows score breakdown', () => {
    renderWithProviders(<CompletedPage />);
    
    // Check for score visualization or breakdown
    expect(screen.getByText(/90/i)).toBeInTheDocument(); // Question score
    expect(screen.getByText(/feedback/i)).toBeInTheDocument();
  });
});