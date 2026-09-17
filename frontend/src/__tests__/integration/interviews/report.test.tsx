import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useParams } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { ReportPage } from '@/pages/interviews/report';
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
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/interviews/interview-123/report']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Interview Report Component', () => {
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
            },
            {
              questionId: 'q-2',
              score: 80,
              feedback: 'Good answer but could be more detailed',
              suggestions: ['Explain more about performance implications']
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

  it('renders full interview report with all details', () => {
    renderWithProviders(<ReportPage />);
    
    expect(screen.getByText(/interview report/i)).toBeInTheDocument();
    expect(screen.getByText(/frontend developer interview/i)).toBeInTheDocument();
    expect(screen.getByText(/overall score: 85/i)).toBeInTheDocument();
    expect(screen.getByText(/great performance overall/i)).toBeInTheDocument();
  });

  it('displays detailed strengths analysis', () => {
    renderWithProviders(<ReportPage />);
    
    expect(screen.getByText(/react/i)).toBeInTheDocument();
    expect(screen.getByText(/problem solving/i)).toBeInTheDocument();
  });

  it('shows areas for improvement with specific guidance', () => {
    renderWithProviders(<ReportPage />);
    
    expect(screen.getByText(/css/i)).toBeInTheDocument();
    expect(screen.getByText(/testing/i)).toBeInTheDocument();
  });

  it('provides detailed question-by-question breakdown', () => {
    renderWithProviders(<ReportPage />);
    
    // Look for question-specific feedback
    expect(screen.getByText(/excellent answer/i)).toBeInTheDocument();
    expect(screen.getByText(/good use of hooks/i)).toBeInTheDocument();
    
    expect(screen.getByText(/good answer but could be more detailed/i)).toBeInTheDocument();
    expect(screen.getByText(/explain more about performance implications/i)).toBeInTheDocument();
  });

  it('shows recommendations for future preparation', () => {
    renderWithProviders(<ReportPage />);
    
    expect(screen.getByText(/practice css layouts/i)).toBeInTheDocument();
    expect(screen.getByText(/learn more testing frameworks/i)).toBeInTheDocument();
  });

  it('allows exporting report as PDF', () => {
    renderWithProviders(<ReportPage />);
    
    const exportButton = screen.getByRole('button', { name: /export pdf/i });
    expect(exportButton).toBeInTheDocument();
    
    fireEvent.click(exportButton);
    
    // We can't actually test PDF generation, but we can check if the function is called
    // This would typically trigger a download
  });

  it('allows sharing report', () => {
    renderWithProviders(<ReportPage />);
    
    const shareButton = screen.getByRole('button', { name: /share report/i });
    expect(shareButton).toBeInTheDocument();
  });

  it('provides navigation options to related interviews', () => {
    renderWithProviders(<ReportPage />);
    
    const backButton = screen.getByRole('button', { name: /back to interview/i });
    expect(backButton).toBeInTheDocument();
    
    fireEvent.click(backButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/interview-123/completed');
  });

  it('allows starting a new interview based on report insights', () => {
    renderWithProviders(<ReportPage />);
    
    const newInterviewButton = screen.getByRole('button', { name: /improve and retry/i });
    expect(newInterviewButton).toBeInTheDocument();
    
    fireEvent.click(newInterviewButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/new');
  });
});