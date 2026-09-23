/**
 * Live room (`/interviews/:id/live` — `LiveRoomPage`). The socket hook is
 * stubbed (its own behaviour belongs to the app suite); the session state the
 * page renders comes from the real `useLiveInterviewStore`, seeded per test the
 * same way the socket writes it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { LiveRoomPage } from "@/pages/interviews/live";
import { useLiveInterviewStore } from "@/lib/stores/live-interview.store";
import { apiMock, makeInterview, makeQuestion, primeApi, renderPage } from "./support.js";

vi.mock("@/lib/api", async () => (await import("./support.js")).apiModuleMock());

vi.mock("@/hooks/use-interview-socket", () => ({
  useInterviewSocket: () => ({ submitAnswer: vi.fn(), endInterview: vi.fn() }),
}));

const ROUTE = "/interviews/interview-123/live";
const PATH = "/interviews/:id/live";

describe("live interview room", () => {
  beforeEach(() => {
    primeApi();
    useLiveInterviewStore.setState({
      interviewId: "interview-123",
      currentQuestion: null,
      questionNumber: 0,
      totalQuestions: null,
      answeredCount: 0,
      connectionState: "idle",
      aiStatus: "idle",
      interviewStatus: null,
      mediaStream: null,
      error: null,
    });
  });

  it("renders the delivered question and the answer composer", async () => {
    apiMock.getInterview.mockResolvedValue(makeInterview({ status: "INPROGRESS" }));
    useLiveInterviewStore.setState({
      currentQuestion: makeQuestion(),
      questionNumber: 1,
      totalQuestions: 5,
      connectionState: "connected",
    });

    renderPage(<LiveRoomPage />, { route: ROUTE, path: PATH });

    expect(
      await screen.findByText(/how would you design a cache invalidation strategy/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/q1 of 5/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
  });

  it("shows the not-found notice when the interview cannot be loaded", async () => {
    apiMock.getInterview.mockResolvedValue(null);

    renderPage(<LiveRoomPage />, { route: ROUTE, path: PATH });

    expect(await screen.findByText(/interview not found/i)).toBeInTheDocument();
  });
});
