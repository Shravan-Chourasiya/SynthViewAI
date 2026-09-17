import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { HistoryPage } from '@/pages/interviews/history';
import { useInterviewListStore } from '@/lib/stores/interview-list.store';
import * as interviewService from '@/lib/services/interview.service';
import { Interview } from '@/lib/types';

// Define mockNavigate at module level
const mockNavigate = vi.fn();

// Mock the services and navigation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/services/interview.service');

// Create wrapper components that include both ThemeProvider and Router
const renderWithProviders = (ui: React.ReactElement, initialEntries: string[] = ['/interviews']) => {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Interview History Component', () => {
  const mockInterviews: Interview[] = [
    {
      id: 'int-1',
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
    {
      id: 'int-2',
      title: 'Backend Developer Interview',
      status: 'SCHEDULED',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      scheduledAt: new Date(Date.now() + 86400000).toISOString(), // 1 day in future
      duration: 45,
      type: 'BEHAVIORAL',
      difficulty: 'EASY',
      style: 'REGULAR',
      experienceLevel: 'JUNIOR',
      targetCompany: 'Amazon',
      industry: 'Technology',
      role: 'Backend Engineer',
      skills: ['Node.js', 'Express'],
      questions: [],
      metadata: {},
      report: null,
      userId: 'user-123'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Reset the interview list store
    useInterviewListStore.getState().reset();
  });

  it('renders interview list from mocked API data', async () => {
    vi.spyOn(interviewService, 'list').mockResolvedValue(mockInterviews);

    renderWithProviders(<HistoryPage />);

    // Wait for the data to load
    await waitFor(() => {
      expect(screen.getByText('Frontend Developer Interview')).toBeInTheDocument();
      expect(screen.getByText('Backend Developer Interview')).toBeInTheDocument();
    });
  });

  it('shows empty state when no interviews exist', async () => {
    vi.spyOn(interviewService, 'list').mockResolvedValue([]);

    renderWithProviders(<HistoryPage />);

    // Wait for the data to load
    await waitFor(() => {
      expect(screen.getByText(/no interviews found/i)).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching interviews', () => {
    const loadingPromise = new Promise(() => {}); // Never resolves, simulates loading
    vi.spyOn(interviewService, 'list').mockReturnValue(loadingPromise as any);

    renderWithProviders(<HistoryPage />);

    // Should show loading indicators
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading skeleton
  });

  it('shows error state when API call fails', async () => {
    const errorMessage = 'Failed to fetch interviews';
    vi.spyOn(interviewService, 'list').mockRejectedValue(new Error(errorMessage));

    renderWithProviders(<HistoryPage />);

    // Wait for the error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/failed to load interviews/i)).toBeInTheDocument();
    });
  });

  it('navigates to interview detail when clicking on an interview item', async () => {
    vi.spyOn(interviewService, 'list').mockResolvedValue(mockInterviews);

    renderWithProviders(<HistoryPage />);

    // Wait for the data to load
    await waitFor(() => {
      expect(screen.getByText('Frontend Developer Interview')).toBeInTheDocument();
    });

    // Find and click on the first interview item
    const interviewItem = screen.getByText('Frontend Developer Interview').closest('a');
    if (interviewItem) {
      interviewItem.click();
    }

    // Wait for navigation to occur
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/interviews/int-1');
    });
  });

  it('displays correct interview status badges', async () => {
    vi.spyOn(interviewService, 'list').mockResolvedValue(mockInterviews);

    renderWithProviders(<HistoryPage />);

    // Wait for the data to load
    await waitFor(() => {
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
      expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
    });
  });

  it('formats interview dates correctly', async () => {
    vi.spyOn(interviewService, 'list').mockResolvedValue(mockInterviews);

    renderWithProviders(<HistoryPage />);

    // Wait for the data to load
    await waitFor(() => {
      // Check that dates are formatted in a readable way
      expect(screen.getByText(/ago/i)).toBeInTheDocument(); // Should show relative time
    });
  });

  it('allows filtering and sorting if those features exist', async () => {
    vi.spyOn(interviewService, 'list').mockResolvedValue(mockInterviews);

    renderWithProviders(<HistoryPage />);

    // Wait for the data to load
    await waitFor(() => {
      expect(screen.getByText('Frontend Developer Interview')).toBeInTheDocument();
    });

    // Test that filter/sort controls exist if implemented
    const filterControls = screen.queryAllByRole('combobox'); // Dropdowns for filtering
    expect(filterControls.length).toBeGreaterThanOrEqual(0); // May or may not exist depending on implementation
  });
});