/**
 * Lean root-level suite — shared harness for the frontend half.
 *
 * The app talks to the backend through exactly one client (`@/lib/api`), so the
 * suite stubs that one module and lets every page, store, hook and component
 * underneath run for real. Zustand stores are real too — tests seed them with
 * `setState` instead of replacing them, which keeps selector-based components
 * (`useAuthStore((s) => s.user)`) behaving as they do in the browser.
 *
 * Each test file stubs the api module with:
 *
 *   vi.mock('@/lib/api', async () => (await import('./support.js')).apiModuleMock());
 */
import { vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import type { Interview, InterviewReport, Question, User } from "@/lib/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

export function makeInterview(overrides: Partial<Interview> = {}): Interview {
  const now = new Date("2026-09-01T10:00:00.000Z").toISOString();
  return {
    id: "interview-123",
    userId: "user-123",
    status: "READY",
    createdAt: now,
    lastActivityAt: now,
    progress: 0,
    score: null,
    currentRound: 1,
    currentQuestion: 0,
    domain: "Backend",
    roleTitle: "Backend Engineer",
    experienceLevel: "mid-level",
    difficulty: "MEDIUM",
    type: "TECHNICAL",
    durationMin: 30,
    rounds: 1,
    topics: ["APIs", "Databases"],
    interviewStyle: "FAANG",
    endingCriteria: "DURATION",
    ...overrides,
  } as Interview;
}

export function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "question-1",
    index: 1,
    kind: "text",
    category: "TECHNICAL",
    topic: "Caching",
    difficulty: "MEDIUM",
    text: "How would you design a cache invalidation strategy for a read-heavy service?",
    ...overrides,
  } as Question;
}

export function makeReport(overrides: Partial<InterviewReport> = {}): InterviewReport {
  return {
    interviewId: "interview-123",
    overallScore: 82,
    categoryScores: [
      { label: "Technical", value: 85 },
      { label: "Communication", value: 78 },
    ],
    strengths: ["Clear structure", "Good tradeoff reasoning"],
    weaknesses: ["Could go deeper on failure modes"],
    summary: "A solid interview with strong fundamentals and room to grow on depth.",
    // Shape matches the `Recommendation` type the report page renders (`gap`/`resource`);
    // the fixture previously used title/detail, which rendered as an empty chip.
    recommendations: [
      { gap: "Failure modes", resource: "Practise failure-mode reasoning: walk through what breaks first." },
    ],
    difficultyProgression: ["MEDIUM", "HARD"],
    questions: [
      {
        question: "How would you design a cache invalidation strategy?",
        answer: "I would start with TTLs and add explicit invalidation for hot keys.",
        level: "MEDIUM",
        evaluation: {
          score: 84,
          signal: "strong",
          feedback: "Good coverage of the tradeoffs.",
          strengths: ["Concrete examples"],
          weaknesses: ["Mentions no observability"],
        },
      },
    ],
    ...overrides,
  } as InterviewReport;
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-123",
    name: "Lean Candidate",
    email: "lean@example.com",
    joinedAt: new Date("2026-08-01T10:00:00.000Z").toISOString(),
    role: "candidate",
    ...overrides,
  };
}

/**
 * The shape the auth store keeps in `user` (the backend `MeResponse`), which is
 * what `RequireAdmin`/`AdminGate` read to decide access. Distinct from
 * `makeUser()`, which is the app's own `User` view model.
 */
export function makeMe(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-123",
    firstName: "Lean",
    lastName: "Candidate",
    email: "lean@example.com",
    username: "leancandidate",
    userrole: "user",
    accountStatus: "active",
    createdAt: new Date("2026-08-01T10:00:00.000Z").toISOString(),
    ...overrides,
  };
}

// ── API stub ──────────────────────────────────────────────────────────────────

/**
 * Every method the app's `api` object exposes. Tests override only what the
 * page under test actually calls; `primeApi()` resets the rest to sane values.
 */
export const apiMock = {
  login: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendCode: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  listInterviews: vi.fn(),
  getInterview: vi.fn(),
  createInterview: vi.fn(),
  cancelInterview: vi.fn(),
  startInterview: vi.fn(),
  getReport: vi.fn(),
  getMetrics: vi.fn(),
  getHistory: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
};

class ApiErrorStub extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The value test files return from their `vi.mock('@/lib/api', ...)` factory. */
export function apiModuleMock() {
  return { api: apiMock, ApiError: ApiErrorStub };
}

/** Resets every api method and applies defaults for the common reads. */
export function primeApi(overrides: Partial<typeof apiMock> = {}): void {
  for (const fn of Object.values(apiMock)) fn.mockReset();

  apiMock.me.mockResolvedValue(makeUser());
  apiMock.getInterview.mockResolvedValue(makeInterview());
  apiMock.listInterviews.mockResolvedValue([]);
  apiMock.getReport.mockResolvedValue(makeReport());
  apiMock.getHistory.mockResolvedValue([]);
  apiMock.getMetrics.mockResolvedValue({});
  apiMock.listSessions.mockResolvedValue([]);
  apiMock.login.mockResolvedValue(makeUser());
  apiMock.register.mockResolvedValue(undefined);
  apiMock.logout.mockResolvedValue(undefined);
  apiMock.startInterview.mockResolvedValue(undefined);

  Object.assign(apiMock, overrides);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

export interface RenderPageOptions {
  /** URL to open, e.g. `/interviews/interview-123/report`. */
  route?: string;
  /** Route pattern so `useParams()` resolves, e.g. `/interviews/:id/report`. */
  path?: string;
}

/**
 * Renders a page inside the providers the app really uses — theme, router — with
 * a real `Route`, so pages that read `useParams()`/`useNavigate()` behave as they
 * do under `App.tsx` instead of being handed a mocked router.
 */
export function renderPage(ui: React.ReactElement, options: RenderPageOptions = {}) {
  const { route = "/", path = "/" } = options;
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}
