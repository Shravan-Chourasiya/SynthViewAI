import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { AdminInterviewReportPage } from '@/pages/admin/interview-report';
import { useAuthStore } from '@/lib/stores/auth.store';
import { adminService } from '@/lib/services/admin.service';

/**
 * The admin report is a privacy boundary rendered in the DOM, so these tests
 * assert on what is *absent* at least as much as on what is present.
 *
 * The mocked payload deliberately carries the fields the API must never send —
 * answers, evaluation feedback, a transcript, the candidate's name and email.
 * The page must render none of them, which catches the failure a real payload
 * would never reveal: a component that blindly spreads whatever it is handed.
 */

vi.mock('@/lib/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/lib/services/admin.service', () => ({
  adminService: {
    getInterviewMetrics: vi.fn(),
  },
}));

const SENTINELS = {
  answer: 'He said he would add a cache in front of Postgres.',
  transcript: 'TRANSCRIPT-SENTINEL-SPEAKER-ONE',
  feedback: 'The answer was vague about consistency.',
  strengths: 'STRENGTH-SENTINEL',
  weaknesses: 'WEAKNESS-SENTINEL',
  candidateName: 'CANDIDATE-NAME-SENTINEL',
  candidateEmail: 'candidate-email-sentinel@example.com',
  notes: 'SESSION-NOTES-SENTINEL',
};

const SESSION_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

/** Valid metrics plus the forbidden fields bolted on. */
const metricsPayload = {
  session: {
    ref: SESSION_ID,
    candidateRef: 'C-1A2B3C4D5E',
    title: 'Senior Backend Interview',
    status: 'COMPLETED',
    outcome: 'completed' as const,
    type: 'TECHNICAL',
    companyStyle: 'FAANG',
    difficulty: 'HARD',
    durationMinutes: 30,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:31:00.000Z',
    startedAt: '2026-09-01T10:01:00.000Z',
    jobRole: 'Backend Engineer',
    domain: 'Distributed systems',
    targetedCompany: 'Stripe',
    experienceLevel: '5-plus',
    topics: ['Postgres', 'Caching'],
    adaptive: true,
    endingCriteria: 'manual',
    questionTarget: 6,
    verdict: 'PASS',
  },
  aggregate: {
    overallScore: 78.5,
    technicalScore: 82,
    communicationScore: 74,
    problemSolvingScore: 80,
    confidenceScore: 70,
    questionsAnswered: 5,
    questionsSkipped: 1,
    questionsEvaluated: 5,
    totalDurationSeconds: 1800,
  },
  categoryBreakdown: [
    { category: 'TECHNICAL' as const, questions: 2, scored: 2, averageScore: 7.5 },
    { category: 'BEHAVIORAL' as const, questions: 1, scored: 0, averageScore: null },
  ],
  difficultyProgression: [
    { sequenceNumber: 1, difficulty: 'EASY' },
    { sequenceNumber: 2, difficulty: 'HARD' },
  ],
  questions: [
    {
      sequenceNumber: 1,
      title: 'Explain how a connection pool can become the bottleneck.',
      type: 'TECHNICAL' as const,
      difficulty: 'EASY' as const,
      state: 'EVALUATED',
      score: 8,
      scores: { correctness: 8, relevance: 7, clarity: 9, technicalDepth: 8 },
      timeTakenSeconds: 90,
    },
  ],
  // Never sent by the API — present here so a leak in the render path fails.
  answers: [{ questionId: 'q1', answerData: SENTINELS.answer }],
  transcript: SENTINELS.transcript,
  feedback: SENTINELS.feedback,
  strengths: [SENTINELS.strengths],
  weaknesses: [SENTINELS.weaknesses],
  userName: SENTINELS.candidateName,
  userEmail: SENTINELS.candidateEmail,
  notes: SENTINELS.notes,
};

const mockAuthUser = (userrole?: string) => {
  (useAuthStore as unknown as vi.Mock).mockImplementation((selector?: (s: unknown) => unknown) => {
    const state = {
      status: 'authenticated',
      user: userrole
        ? {
            id: '1',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            username: 'admin',
            userrole,
            accountStatus: 'active',
            createdAt: '2023-01-01T00:00:00Z',
          }
        : null,
      pendingEmail: null,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      bootstrap: vi.fn(),
    };
    return selector ? selector(state) : state;
  });
};

const renderPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/admin/interviews/${SESSION_ID}/report`]}>
        <Routes>
          <Route path="/admin/interviews/:id/report" element={<AdminInterviewReportPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('Admin Interview Report Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (adminService.getInterviewMetrics as unknown as vi.Mock).mockResolvedValue(metricsPayload);
  });

  it('shows the session metrics an admin is allowed to see', async () => {
    mockAuthUser('admin');
    renderPage();

    expect(await screen.findByText('Interview Report')).toBeInTheDocument();
    expect(screen.getByText('C-1A2B3C4D5E')).toBeInTheDocument();
    expect(screen.getByText('Senior Backend Interview')).toBeInTheDocument();
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Stripe')).toBeInTheDocument();
    expect(screen.getByText(/connection pool can become the bottleneck/i)).toBeInTheDocument();
    expect(screen.getByText('78.5')).toBeInTheDocument();

    await waitFor(() => {
      expect(adminService.getInterviewMetrics).toHaveBeenCalledWith(SESSION_ID);
    });
  });

  it('renders no answer, transcript, feedback, notes or candidate identity', async () => {
    mockAuthUser('admin');
    const { container } = renderPage();

    await screen.findByText('Interview Report');
    const rendered = container.textContent ?? '';

    for (const sentinel of Object.values(SENTINELS)) {
      expect(rendered).not.toContain(sentinel);
    }
    // Not just unrendered — not even in the DOM as an attribute value.
    expect(container.innerHTML).not.toContain(SENTINELS.candidateName);
    expect(container.innerHTML).not.toContain(SENTINELS.candidateEmail);
  });

  it('offers no export or download affordance', async () => {
    mockAuthUser('admin');
    renderPage();

    await screen.findByText('Interview Report');

    // Requirement: raw-answer export is a separate, explicitly scoped feature —
    // nothing in this view may offer one.
    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent ?? '').not.toMatch(/export|download|csv|pdf/i);
    }
    expect(screen.queryByRole('link', { name: /export|download/i })).not.toBeInTheDocument();
  });

  it('refuses the report to a moderator, who can otherwise reach the admin area', async () => {
    mockAuthUser('moderator');
    renderPage();

    expect(
      await screen.findByText('Scores are restricted to administrators'),
    ).toBeInTheDocument();
    expect(adminService.getInterviewMetrics).not.toHaveBeenCalled();
  });

  it('does not request metrics when the route has no session id', async () => {
    mockAuthUser('admin');
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/admin/interviews']}>
          <Routes>
            <Route path="/admin/interviews" element={<AdminInterviewReportPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    await screen.findByText('Interview Report');
    expect(adminService.getInterviewMetrics).not.toHaveBeenCalled();
  });
});
