import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminInterviewReportPage from '@/pages/admin/interview-report';
import { interviewService } from '@/lib/services';
import { INTERVIEWS, reportFor } from '@/__tests__/fixtures/mock-data';
import { renderRoute } from '@/__tests__/test-utils';

vi.mock('@/lib/services', () => ({
  interviewService: { get: vi.fn(), report: vi.fn() },
  adminService: { stats: vi.fn(), users: vi.fn(), interviews: vi.fn() },
}));

const interview = INTERVIEWS.find((i) => i.status === 'completed') ?? INTERVIEWS[0]!;
const report = reportFor(interview);

describe('Admin Interview Report Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interviewService.get).mockResolvedValue(interview);
    vi.mocked(interviewService.report).mockResolvedValue(report);
  });

  it('renders scores only, without candidate answer text', async () => {
    renderRoute(<AdminInterviewReportPage />, {
      path: '/admin/interviews/:id/report',
      params: [{ pattern: ':id', value: interview.id }],
    });

    expect(
      await screen.findByText(/deliberately excludes answer text/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Per-question scores')).toBeInTheDocument();
    expect(interviewService.report).toHaveBeenCalledWith(interview.id);
  });

  it('reports a missing report instead of rendering empty panels', async () => {
    vi.mocked(interviewService.report).mockRejectedValue(new Error('not ready'));

    renderRoute(<AdminInterviewReportPage />, {
      path: '/admin/interviews/:id/report',
      params: [{ pattern: ':id', value: interview.id }],
    });

    expect(await screen.findByText('No report for this session')).toBeInTheDocument();
  });
});
