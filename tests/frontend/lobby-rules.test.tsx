/**
 * Rules dialog + 7-second gate (doc 05, Part 1).
 *
 * Timer strategy: the lobby's readiness path (socket connect, environment
 * checks) runs on real timers, so fake timers are only engaged *after* the
 * dialog is open, purely to advance through the 7-second gate without waiting.
 * Enabling them earlier hangs `renderReadyLobby`'s real-timer `waitFor`, and a
 * timed-out test leaves fake timers active for every test after it.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { LobbyPage } from "@/pages/interviews/lobby";
import { apiMock, makeInterview, primeApi, renderPage } from "./support.js";

vi.mock("@/lib/api", async () => (await import("./support.js")).apiModuleMock());

vi.mock("@/lib/socket/interview-socket", () => {
  class FakeSocket {
    io = { opts: {} as Record<string, unknown> };
    private handlers: Record<string, (() => void)[]> = {};
    on = (event: string, cb: () => void) => this.once(event, cb);
    once = (event: string, cb: () => void) => {
      this.handlers[event] = [...(this.handlers[event] ?? []), cb];
      return this;
    };
    off = () => this;
    connect = () => {
      const pending = [...(this.handlers.connect ?? [])];
      setTimeout(() => pending.forEach((handler) => handler()), 0);
      return this;
    };
    disconnect = () => this;
    emit = () => this;
  }
  return { createInterviewSocket: () => new FakeSocket() };
});

beforeAll(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [],
        getVideoTracks: () => [],
        getAudioTracks: () => [],
      }),
      getDisplayMedia: vi.fn(),
    },
    writable: true,
  });
});

const ROUTE = "/interviews/interview-123/lobby";
const PATH = "/interviews/:id/lobby";

async function renderReadyLobby() {
  apiMock.getInterview.mockResolvedValue(makeInterview({ status: "READY" }));
  renderPage(<LobbyPage />, { route: ROUTE, path: PATH });
  // Wait for the connection check to pass so the Start button enables.
  await waitFor(
    () => expect(startButton()).toBeEnabled(),
    { timeout: 5000 },
  );
}

/** The lobby's outer Start control (excludes the dialog's copy). */
function startButton(): HTMLElement {
  const button = screen
    .getAllByRole("button")
    .find((b) => (b.textContent ?? "").match(/Start Interview|Resume Interview/));
  if (!button) throw new Error("Start button not found");
  return button;
}

/** The dialog's own Start control (the gated one). */
function dialogStartButton(): HTMLElement {
  const dialog = screen.getByRole("dialog");
  const button = Array.from(dialog.querySelectorAll("button")).find((b) =>
    /Start Interview|Resume Interview/.test(b.textContent ?? ""),
  );
  if (!button) throw new Error("Dialog Start button not found");
  return button;
}

describe("lobby rules dialog", () => {
  beforeEach(() => {
    primeApi();
  });

  it("opens the rules dialog instead of starting, with the gate counting down", async () => {
    await renderReadyLobby();

    fireEvent.click(startButton());

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/before you begin/i)).toBeInTheDocument();
    // Disabled and visibly counting down, not enabled on open.
    const gated = dialogStartButton();
    expect(gated).toBeDisabled();
    expect(gated.textContent).toContain("(7)");
  });

  it("enables Start only after the full 7 seconds and then calls the api", async () => {
    await renderReadyLobby();

    // Engage the fake clock *after* readiness but *before* the Start click, so
    // the gate's interval is created on the fake clock and can be advanced.
    vi.useFakeTimers();
    try {
      fireEvent.click(startButton());
      screen.getByRole("dialog");

      // 7 interval ticks: (7) → (0) and the button enables.
      act(() => {
        vi.advanceTimersByTime(7500);
      });
      const enabled = dialogStartButton();
      expect(enabled).toBeEnabled();
      fireEvent.click(enabled);
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() =>
      expect(apiMock.startInterview).toHaveBeenCalledWith("interview-123"),
    );
  }, 20_000);

  it("cancel closes the dialog and never calls startInterview", async () => {
    await renderReadyLobby();
    fireEvent.click(startButton());
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiMock.startInterview).not.toHaveBeenCalled();
    // The lobby is intact and the start control is back.
    expect(startButton()).toBeInTheDocument();
  });

  it("restarts the countdown from 7 after a cancel-and-reopen", async () => {
    await renderReadyLobby();

    vi.useFakeTimers();
    try {
      fireEvent.click(startButton());
      screen.getByRole("dialog");

      // 4 ticks of the 1s interval: 7 → 3. Mid-count, so a reopen must not
      // resume from here.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(dialogStartButton().textContent).toContain("(3)");
      fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Reopen: the label must show (7) again, not resume at (3).
    fireEvent.click(startButton());
    await screen.findByRole("dialog");
    const gated = dialogStartButton();
    expect(gated).toBeDisabled();
    expect(gated.textContent).toContain("(7)");
  }, 20_000);
});
