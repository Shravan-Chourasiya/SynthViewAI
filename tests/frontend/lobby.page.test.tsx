/**
 * Lobby (`/interviews/:id/lobby` — `LobbyPage`): the last screen before a
 * session starts. The page runs its environment checks on mount, so the socket
 * factory is stubbed with an immediately-connecting fake instead of letting the
 * pre-flight hit a real server.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { screen } from "@testing-library/react";
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
    off = (event: string, cb?: () => void) => {
      this.handlers[event] = cb
        ? (this.handlers[event] ?? []).filter((h) => h !== cb)
        : [];
      return this;
    };
    connect = () => {
      const pending = [...(this.handlers.connect ?? []), ...(this.handlers.connect_error ?? [])];
      // Deliver on a macrotask so the caller has attached its listeners.
      setTimeout(() => pending.forEach((handler) => handler()), 0);
      return this;
    };
    disconnect = () => this;
    emit = () => this;
  }
  return { createInterviewSocket: () => new FakeSocket() };
});

const ROUTE = "/interviews/interview-123/lobby";
const PATH = "/interviews/:id/lobby";

// The lobby runs its environment checks on mount, so the shared getUserMedia
// stub — which exposes only `getTracks()` — is replaced with a stream that
// answers the track accessors the lobby actually calls.
const fakeTrack = () => ({ stop: vi.fn(), label: "fake", enabled: true });
const fakeStream = () => ({
  getTracks: () => [fakeTrack()],
  getVideoTracks: () => [fakeTrack()],
  getAudioTracks: () => [fakeTrack()],
});

describe("interview lobby page", () => {
  beforeAll(() => {
    // jsdom has no MediaStream constructor; the lobby builds one from the
    // checked tracks after a successful pre-flight.
    if (typeof window.MediaStream === "undefined") {
      Object.defineProperty(window, "MediaStream", {
        writable: true,
        configurable: true,
        value: class MediaStream {
          constructor(tracks: unknown[] = []) {
            this.tracks = tracks;
          }
          tracks: unknown[];
          getTracks() {
            return this.tracks;
          }
        },
      });
    }
  });

  beforeEach(() => {
    primeApi();
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(fakeStream()),
        getDisplayMedia: vi.fn().mockResolvedValue(fakeStream()),
      },
      writable: true,
    });
  });

  it("summarises a READY interview and offers the start control", async () => {
    apiMock.getInterview.mockResolvedValue(makeInterview({ status: "READY" }));

    renderPage(<LobbyPage />, { route: ROUTE, path: PATH });

    expect(await screen.findByText(/interview summary/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start interview/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /environment check/i })).toBeInTheDocument();
  });

  it("refuses to offer a start control once the interview has ended", async () => {
    apiMock.getInterview.mockResolvedValue(makeInterview({ status: "COMPLETED" }));

    renderPage(<LobbyPage />, { route: ROUTE, path: PATH });

    expect(await screen.findByText(/interview unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start interview/i })).not.toBeInTheDocument();
  });
});
