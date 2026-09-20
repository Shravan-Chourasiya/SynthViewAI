import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { InterviewsPage } from '@/pages/interviews/history';
import { useInterviewListStore } from '@/lib/stores/interview-list.store';
import * as interviewService from '@/lib/services/interview.service';

vi.mock('@/lib/services/interview.service');

const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/interviews']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

// Raw backend-shaped rows — the store maps them through normalizeInterview,
// so `interviewMetaData.jobRole` becomes the visible `roleTitle`.
const rawInterviews = [
  {
    id: 'int-1',
    userId: 'user-123',
    status: 'COMPLETED',
    interviewStatus: 'COMPLETED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rounds: 1,
    interviewDifficulty: 'MEDIUM',
    interviewType: 'TECHNICAL',
    interviewCompanyStyle: 'REGULAR',
    interviewDuration: 30,
    interviewMetaData: {
      jobRole: 'Frontend Developer Interview',
      domain: 'Frontend Engineering',
      experience: 'mid-level',
      jobSkills: ['React', 'TypeScript'],
      targetedCompany: 'Google',
    },
    interviewOutcome: { finalScore: 85 },
    interviewQuestionsGeneratedCount: 10,
    interviewQuestionsAnsweredCount: 10,
  },
  {
    id: 'int-2',
    userId: 'user-123',
    status: 'SCHEDULED',
    interviewStatus: 'SCHEDULED',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    rounds: 1,
    interviewDifficulty: 'EASY',
    interviewType: 'BEHAVIORAL',
    interviewCompanyStyle: 'REGULAR',
    interviewDuration: 45,
    interviewMetaData: {
      jobRole: 'Backend Developer Interview',
      domain: 'Backend Engineering',
      experience: 'junior',
      jobSkills: ['Node.js', 'Express'],
      targetedCompany: 'Amazon',
    },
  },
] as any;

describe('Interview History Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInterviewListStore.getState().reset();
  });

  it('renders interview list from mocked API data', async () => {
    vi.mocked(interviewService.listInterviews).mockResolvedValue(rawInterviews as any);

    renderWithProviders(<InterviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Frontend Developer Interview')).toBeInTheDocument();
      expect(screen.getByText('Backend Developer Interview')).toBeInTheDocument();
    });
  });

  it('links each row to its interview detail route', async () => {
    vi.mocked(interviewService.listInterviews).mockResolvedValue(rawInterviews as any);

    renderWithProviders(<InterviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Frontend Developer Interview')).toBeInTheDocument();
    });

    const link = screen.getByText('Frontend Developer Interview').closest('a');
    expect(link).toHaveAttribute('href', '/interviews/int-1');
  });

  it('shows empty state when no interviews exist', async () => {
    vi.mocked(interviewService.listInterviews).mockResolvedValue([] as any);

    renderWithProviders(<InterviewsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no interviews yet/i)).toBeInTheDocument();
    });
  });

  it('shows loading skeleton while fetching interviews', () => {
    vi.mocked(interviewService.listInterviews).mockReturnValue(new Promise(() => {}) as any);

    renderWithProviders(<InterviewsPage />);

    // The loading branch renders an aria-busy skeleton container
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows error state when the API call fails', async () => {
    vi.mocked(interviewService.listInterviews).mockRejectedValue(new Error('Failed to fetch interviews'));

    renderWithProviders(<InterviewsPage />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load interview history/i)).toBeInTheDocument();
    });
  });

  it('renders the filter controls', async () => {
    vi.mocked(interviewService.listInterviews).mockResolvedValue(rawInterviews as any);

    renderWithProviders(<InterviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Frontend Developer Interview')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Filter by type')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by difficulty')).toBeInTheDocument();
  });

  it('renders duration cells for each row', async () => {
    vi.mocked(interviewService.listInterviews).mockResolvedValue(rawInterviews as any);

    renderWithProviders(<InterviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Frontend Developer Interview')).toBeInTheDocument();
    });

    expect(screen.getByText('30m')).toBeInTheDocument();
    expect(screen.getByText('45m')).toBeInTheDocument();
  });

  it('filters the visible rows via the search input', async () => {
    vi.mocked(interviewService.listInterviews).mockResolvedValue(rawInterviews as any);
    const user = userEvent.setup();

    renderWithProviders(<InterviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Frontend Developer Interview')).toBeInTheDocument();
      expect(screen.getByText('Backend Developer Interview')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Search interviews'), 'Frontend');

    await waitFor(() => {
      expect(screen.getByText('Frontend Developer Interview')).toBeInTheDocument();
      expect(screen.queryByText('Backend Developer Interview')).not.toBeInTheDocument();
    });
  });
});

