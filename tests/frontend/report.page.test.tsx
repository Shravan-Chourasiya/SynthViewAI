/**
 * Report / results page (`/interviews/:id/report` — `InterviewReportPage`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { InterviewReportPage } from "@/pages/interviews/report";
import { apiMock, makeInterview, makeReport, primeApi, renderPage } from "./support.js";

vi.mock("@/lib/api", async () => (await import("./support.js")).apiModuleMock());

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
});
