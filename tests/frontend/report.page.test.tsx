/**
 * Report / results page (`/interviews/:id/report` — `InterviewReportPage`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { InterviewReportPage } from "@/pages/interviews/report";
import { apiMock, makeInterview, makeReport, primeApi, renderPage } from "./support.js";

vi.mock("@/lib/api", async () => (await import("./support.js")).apiModuleMock());

// The share dialog talks to these two service functions. The module is only
// partially mocked: the app shell also reads `resumableInterviews` from it.
const shareMock = vi.hoisted(() => ({
  shareInterviewReport: vi.fn(),
  revokeInterviewShare: vi.fn(),
}));
vi.mock("@/lib/services/interview.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/interview.service")>()),
  ...shareMock,
}));

const ROUTE = "/interviews/interview-123/report";
const PATH = "/interviews/:id/report";

describe("interview report page", () => {
  beforeEach(() => {
    primeApi();
  });

  it("renders the score, summary and strengths returned by the report endpoint", async () => {
    apiMock.getInterview.mockResolvedValue(makeInterview({ status: "COMPLETED", score: 82 }));
    apiMock.getReport.mockResolvedValue(makeReport());

    renderPage(<InterviewReportPage />, { route: ROUTE, path: PATH });

    expect(await screen.findByText(/a solid interview with strong fundamentals/i)).toBeInTheDocument();
    expect(screen.getByText(/clear structure/i)).toBeInTheDocument();
    expect(apiMock.getReport).toHaveBeenCalledWith("interview-123");
  });

  it("shows the not-found state when the interview no longer exists", async () => {
    apiMock.getInterview.mockResolvedValue(null);

    renderPage(<InterviewReportPage />, { route: ROUTE, path: PATH });

    expect(await screen.findByText(/interview not found/i)).toBeInTheDocument();
    await waitFor(() => expect(apiMock.getReport).toHaveBeenCalledWith("interview-123"));
  });

  it("opens the share dialog outside the page's animated wrapper", async () => {
    apiMock.getInterview.mockResolvedValue(makeInterview({ status: "COMPLETED", score: 82 }));
    apiMock.getReport.mockResolvedValue(makeReport());
    shareMock.shareInterviewReport.mockResolvedValue({
      token: "share-token",
      shareUrl: "http://localhost:5173/interviews/shared/share-token",
      expiresIn: "7d",
    });

    renderPage(<InterviewReportPage />, { route: ROUTE, path: PATH });

    fireEvent.click(await screen.findByRole("button", { name: /^share$/i }));

    const dialog = await screen.findByRole("dialog");
    expect(screen.getByText(/interviews\/shared\/share-token/)).toBeInTheDocument();

    // The report root carries `animate-slide-up`, and any animation utility with a
    // `both` fill mode keeps a `transform` on the element forever — which makes it a
    // containing block for `position: fixed` descendants. Rendered in place, the
    // backdrop fogged the report while the panel itself landed far down the page.
    const animatedRoot = document.querySelector(".animate-slide-up");
    expect(animatedRoot).not.toBeNull();
    expect(animatedRoot!.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });
});
