import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AnalyticsPage } from '@/pages/analytics';
import { useAuthStore } from '@/lib/stores/auth.store';
import { analyticsService, type UserAnalytics } from '@/lib/services/analytics.service';

// Mock the auth store (selector-honoring)
vi.mock('@/lib/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

// Mock the analytics service so no real HTTP calls are made
vi.mock('@/lib/services/analytics.service', () => ({
  analyticsService: {
    getUserAnalytics: vi.fn(),
    getUserTrendAnalytics: vi.fn(),
  },
}));

// Mock window.scrollTo to prevent errors
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

const mockAuthStore = () => {
  (useAuthStore as unknown as vi.Mock).mockImplementation((selector?: (s: unknown) => unknown) => {
    const state = {
      status: 'authenticated',
      user: {
        id: 'candidate-1',
        firstName: 'Test',
        lastName: 'User',
        email: 'candidate@example.com',
        username: 'testuser',
        userrole: 'user',
        accountStatus: 'active',
        createdAt: '2026-01-01T00:00:00Z',
      },
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      bootstrap: vi.fn(),
    };
    return selector ? selector(state) : state;
  });
};

const emptyAnalytics: UserAnalytics = {
  overallStats: {
    totalInterviews: 0,
    avgOverallScore: null,
    avgTechnicalScore: null,
    avgCommunicationScore: null,
    avgProblemSolvingScore: null,
    avgConfidenceScore: null,
    totalQuestionsAnswered: 0,
    totalQuestionsSkipped: 0,
    completionRate: 0,
  },
  trendData: [],
  categoryBreakdown: { strengths: {}, weaknesses: {} },
  performanceByCategory: [],
};

const populatedAnalytics: UserAnalytics = {
  overallStats: {
    totalInterviews: 3,
    avgOverallScore: 78.5,
    avgTechnicalScore: 80,
    avgCommunicationScore: 75,
    avgProblemSolvingScore: 71,
    avgConfidenceScore: 76,
    totalQuestionsAnswered: 24,
    totalQuestionsSkipped: 3,
    completionRate: 88.89,
  },
  trendData: [{ date: '2026-01-05', overallScore: 70, technicalScore: 68, communicationScore: 72 }],
  categoryBreakdown: { strengths: { 'System Design': 4 }, weaknesses: { 'Edge Cases': 2 } },
  performanceByCategory: [{ category: 'System Design', avgScore: 81, count: 4 }],
};

const renderPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/analytics']}>
        <AnalyticsPage />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('Analytics Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore();
  });

  // App.tsx loads this route with
  //   lazy(() => import('@/pages/analytics').then((m) => ({ default: m.AnalyticsPage })))
  // so a default-only export resolves the lazy component to `undefined`, React throws
  // "Element type is invalid" and the route silently fails to load.
  it('exposes the named AnalyticsPage export that App.tsx lazy-imports', async () => {
    const mod = await import('@/pages/analytics');
    expect(typeof mod.AnalyticsPage).toBe('function');
  });

  it('renders inside the app shell and shows the empty state without interview data', async () => {
    (analyticsService.getUserAnalytics as unknown as vi.Mock).mockResolvedValue(emptyAnalytics);

    renderPage();

    // The page only loads if it renders inside the AppShell chrome (sidebar/nav).
    expect(await screen.findByText('Performance analytics')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(within(main).getByText('No interview data yet')).toBeInTheDocument();
    expect(within(main).getAllByText('Start new interview').length).toBeGreaterThan(0);
    expect(within(main).getByText('Insights')).toBeInTheDocument();
  });

  it('renders stats, charts and strengths when the user has interview data', async () => {
    (analyticsService.getUserAnalytics as unknown as vi.Mock).mockResolvedValue(populatedAnalytics);

    renderPage();

    expect(await screen.findByText('Performance analytics')).toBeInTheDocument();
    const main = screen.getByRole('main');

    // headline stats
    expect(within(main).getByText('Interviews')).toBeInTheDocument();
    expect(within(main).getByText('3')).toBeInTheDocument();
    expect(within(main).getByText('78.5%')).toBeInTheDocument();
    expect(within(main).getByText('88.89%')).toBeInTheDocument();
    // score components
    expect(within(main).getByText('Technical')).toBeInTheDocument();
    expect(within(main).getByText('Problem solving')).toBeInTheDocument();
    // chart panels (they now use the app's chart theme tokens)
    expect(within(main).getByText('Score trend')).toBeInTheDocument();
    expect(within(main).getByText('Performance by category')).toBeInTheDocument();
    expect(within(main).getByText('Top strengths')).toBeInTheDocument();
    expect(within(main).getAllByText(/System Design/).length).toBeGreaterThan(0);
    expect(within(main).getAllByText(/Edge Cases/).length).toBeGreaterThan(0);

    expect(within(main).queryByText('No interview data yet')).not.toBeInTheDocument();
  });

  it('surfaces a load failure instead of rendering a blank page', async () => {
    (analyticsService.getUserAnalytics as unknown as vi.Mock).mockRejectedValue(
      new Error('Failed to load analytics'),
    );

    renderPage();

    expect(await screen.findByText('Analytics unavailable')).toBeInTheDocument();
    expect(screen.getByText('Failed to load analytics')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
