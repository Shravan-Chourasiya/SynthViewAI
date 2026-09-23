/**
 * Render-budget smoke checks for the two heaviest read views: a long report and
 * a full page of interview history. Generous ceilings — the point is to catch a
 * render that becomes quadratic or re-renders in a loop, not to benchmark.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { InterviewReportPage } from "@/pages/interviews/report";
import { InterviewsPage } from "@/pages/interviews/history";
import { apiMock, makeInterview, makeReport, primeApi, renderPage } from "./support.js";

vi.mock("@/lib/api", async () => (await import("./support.js")).apiModuleMock());

const BUDGET_MS = 4000;

describe("render performance smoke checks", () => {
  beforeEach(() => {
    primeApi();
  });

  it("renders a 25-question report inside the budget", async () => {
    const questions = Array.from({ length: 25 }, (_, index) => ({
      question: `Question ${index + 1}: walk me through a system you designed.`,
      answer: "I would start from the constraints and work outwards.",
      level: "MEDIUM",
      evaluation: {
        score: 80,
        signal: "good" as const,
        feedback: `Feedback for question ${index + 1}.`,
        strengths: ["Clear structure"],
        weaknesses: ["More depth"],
      },
    }));

    apiMock.getInterview.mockResolvedValue(makeInterview({ status: "COMPLETED" }));
    apiMock.getReport.mockResolvedValue(makeReport({ questions }));

    const started = performance.now();
    renderPage(<InterviewReportPage />, {
      route: "/interviews/interview-123/report",
      path: "/interviews/:id/report",
    });

    // The last question and its feedback both mention the number, so count
    // matches rather than requiring a unique node.
    expect((await screen.findAllByText(/question 25/i)).length).toBeGreaterThan(0);
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });

  it("renders a full page of interview history inside the budget", async () => {
    const interviews = Array.from({ length: 50 }, (_, index) =>
      makeInterview({
        id: `interview-${index}`,
        roleTitle: `Role ${index}`,
        status: index % 2 === 0 ? "COMPLETED" : "READY",
      }),
    );
    apiMock.listInterviews.mockResolvedValue(interviews);

    const started = performance.now();
    renderPage(<InterviewsPage />, { route: "/interviews", path: "/interviews" });

    expect(await screen.findByText(/interview history/i)).toBeInTheDocument();
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });
});
