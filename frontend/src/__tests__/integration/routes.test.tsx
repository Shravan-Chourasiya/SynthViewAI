/**
 * routes.test.tsx — every route in App.tsx renders
 *
 * The redesign replaced the per-page zustand stores with react-query over
 * `@/lib/services`, so the old page suites asserted internals that no longer
 * exist. This suite keeps the coverage that matters: each route in
 * `src/App.tsx` mounts against the real page component and reaches its own
 * heading without throwing.
 *
 * Services are mocked at the barrel (`@/lib/services`) on purpose — the pages
 * import from there, and mocking the network instead would duplicate the MSW
 * handlers that `http.test.ts` already exercises.
 */

import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/__tests__/test-utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { Interview, InterviewReport, Question, User } from '@/lib/types';

const USER: User = {
  id: 'u1',
  name: 'Ada Lovelace',
  username: 'ada',
  email: 'ada@example.com',
  role: 'admin',
  status: 'active',
  headline: 'Frontend engineer',
  location: 'London',
  joinedAt: '2026-01-01T00:00:00.000Z',
  lastActiveAt: '2026-02-01T00:00:00.000Z',
};

const INTERVIEW: Interview = {
  id: 'interview-1',
  code: 'ABC123',
  roleTitle: 'Frontend Engineer',
  company: 'Acme',
  field: 'Engineering',
  type: 'technical',
  difficulty: 'medium',
  experienceLevel: 'mid',
  status: 'completed',
  topics: ['react', 'typescript'],
  questionCount: 2,
  rounds: 1,
  durationMinutes: 30,
  score: 78,
  band: 'good',
  summary: 'Solid fundamentals.',
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  completedAt: '2026-02-01T00:30:00.000Z',
  progress: 1,
  currentRound: 1,
  answeredCount: 2,
  candidateId: 'u1',
};

const QUESTIONS: Question[] = [
  {
    id: 'q1',
    interviewId: 'interview-1',
    index: 0,
    kind: 'technical',
    prompt: 'Explain reconciliation.',
    topic: 'react',
    difficulty: 'medium',
    answer: 'Keys let React match children across renders.',
    score: 80,
    band: 'good',
    headline: 'Accurate',
    feedback: 'Good.',
    strengths: ['precision'],
    improvements: ['depth'],
    decision: 'Difficulty held',
    durationSeconds: 120,
  },
  {
    id: 'q2',
    interviewId: 'interview-1',
    index: 1,
    kind: 'code',
    prompt: 'Implement debounce.',
    topic: 'typescript',
    difficulty: 'hard',
    answer: 'function debounce() {}',
    score: 76,
    band: 'good',
    headline: 'Working solution',
    feedback: 'Reviewed, not executed.',
    strengths: ['correctness'],
    improvements: ['edge cases'],
    decision: 'Difficulty increased',
    durationSeconds: 180,
    answerFormat: 'CODE',
    codeLanguage: 'typescript',
  },
];

const REPORT: InterviewReport = {
  interviewId: 'interview-1',
  overallScore: 78,
  band: 'good',
  headline: 'Ready for a mid-level loop.',
  summary: 'Clear answers with room to go deeper.',
  strengths: ['Communication'],
  weaknesses: ['Depth on edge cases'],
  recommendations: ['Practise system design'],
  skills: [{ skill: 'React', score: 82 }],
  progression: [{ index: 0, label: 'Q1', score: 80, difficulty: 'medium' }],
  topics: [{ topic: 'react', score: 80 }],
  shareToken: 'share-token',
  generatedAt: '2026-02-01T00:31:00.000Z',
  questions: QUESTIONS,
};

vi.mock('@/lib/services', () => ({
  interviewService: {
    list: vi.fn(),
    all: vi.fn(),
    get: vi.fn(),
    getByToken: vi.fn(),
    resumable: vi.fn(),
    questions: vi.fn(),
    report: vi.fn(),
    reportByToken: vi.fn(),
    create: vi.fn(),
    cancel: vi.fn(),
    start: vi.fn(),
    end: vi.fn(),
    delete: vi.fn(),
    createShareLink: vi.fn(),
    revokeShareLink: vi.fn(),
  },
  analyticsService: { summary: vi.fn(), trend: vi.fn() },
  adminService: {
    stats: vi.fn(),
    users: vi.fn(),
    setRole: vi.fn(),
    setStatus: vi.fn(),
    suspend: vi.fn(),
    reinstate: vi.fn(),
  },
  authService: {
    me: vi.fn(),
    sessions: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllSessions: vi.fn(),
    updateProfile: vi.fn(),
    updatePassword: vi.fn(),
    updateEmail: vi.fn(),
    updateEmailVerify: vi.fn(),
    deleteAccount: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    verifyOtp: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    forgotPassword: vi.fn(),
    forgotPasswordVerify: vi.fn(),
    recoverAccount: vi.fn(),
    recoverAccountVerify: vi.fn(),
  },
  notificationService: { list: vi.fn(), read: vi.fn(), readAll: vi.fn() },
  contactService: { send: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const services = await import('@/lib/services');

const DashboardPage = (await import('@/pages/dashboard')).default;
const HistoryPage = (await import('@/pages/interviews/history')).default;
const NewInterviewPage = (await import('@/pages/interviews/new')).default;
const ResumablePage = (await import('@/pages/interviews/resumable')).default;
const DetailPage = (await import('@/pages/interviews/detail')).default;
const CompletedPage = (await import('@/pages/interviews/completed')).default;
const TimelinePage = (await import('@/pages/interviews/timeline')).default;
const MetricsPage = (await import('@/pages/interviews/metrics')).default;
const ReportPage = (await import('@/pages/interviews/report')).default;
const SharedReportPage = (await import('@/pages/interviews/shared-report')).default;
const AnalyticsPage = (await import('@/pages/analytics')).default;
const ProfilePage = (await import('@/pages/profile')).default;
const SettingsPage = (await import('@/pages/settings/index')).default;
const SessionsPage = (await import('@/pages/settings/sessions')).default;
const AdminOverviewPage = (await import('@/pages/admin/index')).default;
const AdminUsersPage = (await import('@/pages/admin/users')).default;
const AdminInterviewsPage = (await import('@/pages/admin/interviews')).default;
const AdminReportPage = (await import('@/pages/admin/interview-report')).default;

const STATS = {
  kpis: [{ label: 'Total accounts', value: 12, delta: '+3', hint: 'all time' }],
  signups: [{ label: 'W1', users: 3, interviews: 4 }],
  statusMix: [{ status: 'Completed', count: 30 }],
  scoreBands: [{ band: 'Strong', count: 10 }],
  topRoles: [{ role: 'Backend Engineer', count: 11, avgScore: 78 }],
};

const ANALYTICS = {
  kpis: [{ label: 'Total interviews', value: '4', delta: '', trend: 'flat', hint: '' }],
  scoreOverTime: [{ label: '2026-02-01', score: 78, benchmark: 70 }],
  byCategory: [{ category: 'react', score: 80, attempts: 2 }],
  byDifficulty: [{ difficulty: 'medium', score: 78, attempts: 2 }],
  skills: [{ skill: 'React', score: 82, delta: 2 }],
  strengths: ['Communication'],
  gaps: ['Edge cases'],
};

beforeEach(() => {
  vi.clearAllMocks();

  useAuthStore.setState({
    user: USER,
    status: 'authenticated',
    pendingEmail: null,
    error: null,
  } as never);

  vi.mocked(services.interviewService.list).mockResolvedValue({
    items: [INTERVIEW],
    total: 1,
    page: 1,
    pageSize: 10,
  });
  vi.mocked(services.interviewService.all).mockResolvedValue([INTERVIEW]);
  vi.mocked(services.interviewService.get).mockResolvedValue(INTERVIEW);
  vi.mocked(services.interviewService.getByToken).mockResolvedValue(INTERVIEW);
  vi.mocked(services.interviewService.resumable).mockResolvedValue([INTERVIEW]);
  vi.mocked(services.interviewService.questions).mockResolvedValue(QUESTIONS);
  vi.mocked(services.interviewService.report).mockResolvedValue(REPORT);
  vi.mocked(services.interviewService.reportByToken).mockResolvedValue(REPORT);

  vi.mocked(services.analyticsService.summary).mockResolvedValue(ANALYTICS as never);
  vi.mocked(services.analyticsService.trend).mockResolvedValue([]);

  vi.mocked(services.adminService.stats).mockResolvedValue(STATS as never);
  // `adminService.users` returns rows, not a paginated envelope.
  vi.mocked(services.adminService.users).mockResolvedValue([
    {
      id: 'u1',
      name: 'Ada Lovelace',
      username: 'ada',
      email: 'ada@example.com',
      role: 'admin',
      status: 'active',
      interviews: 4,
      avgScore: 78,
      joinedAt: '2026-01-01T00:00:00.000Z',
      lastActiveAt: '2026-02-01T00:00:00.000Z',
    },
  ] as never);

  vi.mocked(services.authService.sessions).mockResolvedValue([]);
});

const renderAt = (
  ui: React.ReactElement,
  path: string,
  params: { pattern: string; value: string }[] = [],
) => renderWithProviders(ui, { path, params });

describe('Route inventory', () => {
  it('/dashboard greets the signed-in user', async () => {
    renderAt(<DashboardPage />, '/dashboard');
    expect(await screen.findByRole('heading', { name: /ada\./i })).toBeInTheDocument();
  });

  it('/interviews lists sessions from the service', async () => {
    renderAt(<HistoryPage />, '/interviews');
    expect(
      await screen.findByRole('heading', { name: /every session you have run/i }),
    ).toBeInTheDocument();
  });

  it('/interviews/new opens the wizard on step one', async () => {
    renderAt(<NewInterviewPage />, '/interviews/new');
    expect(
      await screen.findByRole('heading', { name: /configure your interview/i }),
    ).toBeInTheDocument();
  });

  it('/interviews/resumable lists unfinished sessions', async () => {
    renderAt(<ResumablePage />, '/interviews/resumable');
    expect(
      await screen.findByRole('heading', { name: /sessions you can still finish/i }),
    ).toBeInTheDocument();
  });

  it('/interviews/:id shows the session detail', async () => {
    renderAt(<DetailPage />, '/interviews/:id', [{ pattern: ':id', value: 'interview-1' }]);
    expect(await screen.findByRole('heading', { name: /frontend engineer/i })).toBeInTheDocument();
  });

  it('/interviews/:id/completed summarises the report', async () => {
    renderAt(<CompletedPage />, '/interviews/:id/completed', [
      { pattern: ':id', value: 'interview-1' },
    ]);
    expect(
      await screen.findByRole('heading', { name: /ready for a mid-level loop/i }),
    ).toBeInTheDocument();
  });

  it('/interviews/:id/history renders the question timeline', async () => {
    renderAt(<TimelinePage />, '/interviews/:id/history', [
      { pattern: ':id', value: 'interview-1' },
    ]);
    expect(
      await screen.findByRole('heading', { name: /question timeline/i }),
    ).toBeInTheDocument();
  });

  it('/interviews/:id/metrics renders the metric view', async () => {
    renderAt(<MetricsPage />, '/interviews/:id/metrics', [
      { pattern: ':id', value: 'interview-1' },
    ]);
    expect(await screen.findByRole('heading', { name: /^metrics$/i })).toBeInTheDocument();
  });

  it('/interviews/:id/report renders the full report', async () => {
    renderAt(<ReportPage />, '/interviews/:id/report', [
      { pattern: ':id', value: 'interview-1' },
    ]);
    expect(await screen.findByRole('heading', { name: /^report$/i })).toBeInTheDocument();
  });

  it('/interviews/shared/:token renders a shared report', async () => {
    renderWithProviders(<SharedReportPage />, {
      path: '/interviews/shared/:token',
      params: [{ pattern: ':token', value: 'share-token' }],
    });
    await waitFor(() => {
      expect(screen.getAllByText(/ready for a mid-level loop/i).length).toBeGreaterThan(0);
    });
  });

  it('/analytics renders the trend view', async () => {
    renderAt(<AnalyticsPage />, '/analytics');
    expect(
      await screen.findByRole('heading', { name: /how you are actually trending/i }),
    ).toBeInTheDocument();
  });

  it('/profile renders the signed-in user', async () => {
    renderAt(<ProfilePage />, '/profile');
    expect(await screen.findByRole('heading', { name: /your profile/i })).toBeInTheDocument();
  });

  it('/settings renders the account panels', async () => {
    renderAt(<SettingsPage />, '/settings');
    expect(await screen.findByRole('heading', { name: /^settings\.$/i })).toBeInTheDocument();
  });

  it('/settings/sessions renders the device list', async () => {
    renderAt(<SessionsPage />, '/settings/sessions');
    expect(
      await screen.findByRole('heading', { name: /where you are signed in/i }),
    ).toBeInTheDocument();
  });

  it('/admin renders the platform overview', async () => {
    renderAt(<AdminOverviewPage />, '/admin');
    await waitFor(() => {
      expect(screen.getByText(/total accounts/i)).toBeInTheDocument();
    });
  });

  it('/admin/users renders the account table', async () => {
    renderAt(<AdminUsersPage />, '/admin/users');
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });
  });

  it('/admin/interviews renders the session table', async () => {
    renderAt(<AdminInterviewsPage />, '/admin/interviews');
    await waitFor(() => {
      expect(screen.getAllByText(/frontend engineer/i).length).toBeGreaterThan(0);
    });
  });

  it('/admin/interviews/:id/report renders the scored admin view', async () => {
    renderAt(<AdminReportPage />, '/admin/interviews/:id/report', [
      { pattern: ':id', value: 'interview-1' },
    ]);
    // Admins see scores only; the page titles itself from the interview.
    expect(
      await screen.findByRole('heading', { name: /frontend engineer/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/admin · scores only/i)).toBeInTheDocument();
  });
});
