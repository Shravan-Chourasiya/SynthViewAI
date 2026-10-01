/**
 * unit.websocket.test.ts
 * Unit tests for the websocket functionality.
 * Tests auth on socket connect, event handling, disconnect/reconnect scenarios,
 * and error handling as mentioned in Priority 2 of the test suite plan.
 */

import { describe, it, expect, vi } from "vitest";
import { Server, Socket } from "socket.io";
import type { IncomingHttpHeaders } from "http";
import { registerSocketAuth } from "../src/websocket/socket.auth.js";
import { registerInterviewGateway } from "../src/websocket/interview.gateway.js";
import * as interviewService from "../src/modules/interview/services/interview.service.js";

// Mock dependencies
vi.mock("../src/config/redis.init.js", () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(),
  },
}));

vi.mock("../src/modules/interview/services/interview.service.js", () => ({
  fetchInterviewById: vi.fn(),
  submitAnswerService: vi.fn(),
  cancelInterviewService: vi.fn(),
  endInterviewService: vi.fn(),
  getAnsweredQuestionIdsService: vi.fn(),
  generateAndDeliverQuestionService: vi.fn(),
  requestNextQuestionService: vi.fn(),
  pauseInterviewService: vi.fn(),
  extendInterviewTimeService: vi.fn(),
}));

vi.mock("../src/modules/interview/services/interview.context.service.js", () => ({
  readInterviewContext: vi.fn(),
}));

vi.mock("../src/websocket/socket.registry.js", () => ({
  setSocketSession: vi.fn(),
  getSocketSession: vi.fn(),
  deleteSocketSession: vi.fn(),
  setGracePeriod: vi.fn(),
  isInGracePeriod: vi.fn(),
  clearGracePeriod: vi.fn(),
  GRACE_TTL_SECONDS: 30,
}));

describe("Websocket Functionality", () => {
  describe("Socket Authentication", () => {
    it("should register socket authentication middleware", () => {
      const mockIoServer = {
        use: vi.fn(),
      } as unknown as Server;

      registerSocketAuth(mockIoServer as any);

      expect(mockIoServer.use).toHaveBeenCalled();
    });
  });

  describe("Interview Gateway", () => {
    it("should register interview gateway handlers", () => {
      const mockIoServer = {
        on: vi.fn(),
      } as unknown as Server;

      registerInterviewGateway(mockIoServer);

      expect(mockIoServer.on).toHaveBeenCalledWith("connection", expect.any(Function));
    });
  });

  // ── interview:extend_time ───────────────────────────────────────────────────
  // The "add more time" path: the client pauses itself at 00:00 and this is the
  // only way the ceiling moves, so it has to move on the server too — otherwise
  // the very next question request completes the interview instead.
  describe("interview:extend_time", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

    const connect = () => {
      const handlers: Record<string, (payload: unknown) => void> = {};
      const roomEmit = vi.fn();
      const socketEmit = vi.fn();
      const socket = {
        id: "socket-1",
        data: { userId: "user-1" } as Record<string, unknown>,
        emit: socketEmit,
        join: vi.fn(),
        leave: vi.fn(),
        on: (event: string, handler: (payload: unknown) => void) => {
          handlers[event] = handler;
        },
      };
      const io = {
        on: (_event: string, callback: (socket: unknown) => void) => callback(socket),
        to: vi.fn(() => ({ emit: roomEmit })),
      } as unknown as Server;

      registerInterviewGateway(io);
      vi.mocked(interviewService.fetchInterviewById).mockResolvedValue({
        userId: "user-1",
        interviewStatus: "INPROGRESS",
      } as never);

      return { handlers, roomEmit, socketEmit };
    };

    it("extends the ceiling and broadcasts the new timer", async () => {
      vi.mocked(interviewService.extendInterviewTimeService).mockResolvedValue({
        timerStartedAt: "2026-01-01T10:00:00.000Z",
        durationMinutes: 25,
        extraMinutes: 10,
        totalQuestions: 6,
      });
      const { handlers, roomEmit, socketEmit } = connect();

      handlers["interview:extend_time"]({ interviewId: "interview-1", extraMinutes: 10 });
      await flush();

      expect(interviewService.extendInterviewTimeService).toHaveBeenCalledWith("interview-1", 10);
      expect(roomEmit).toHaveBeenCalledWith(
        "interview:timer_extended",
        expect.objectContaining({
          interviewId: "interview-1",
          timerStartedAt: "2026-01-01T10:00:00.000Z",
          durationMinutes: 25,
          extraMinutes: 10,
          totalQuestions: 6,
        }),
      );
      expect(socketEmit).not.toHaveBeenCalled();
    });

    it("reports an error instead of extending an interview that already ended", async () => {
      vi.mocked(interviewService.extendInterviewTimeService).mockResolvedValue(null);
      const { handlers, roomEmit, socketEmit } = connect();

      handlers["interview:extend_time"]({ interviewId: "interview-1", extraMinutes: 5 });
      await flush();

      expect(roomEmit).not.toHaveBeenCalled();
      expect(socketEmit).toHaveBeenCalledWith(
        "ws:error",
        expect.objectContaining({ code: "INTERVIEW_INVALID_STATE" }),
      );
    });

    it("rejects an extension from a socket that does not own the interview", async () => {
      const { handlers, roomEmit, socketEmit } = connect();
      vi.mocked(interviewService.fetchInterviewById).mockResolvedValue({
        userId: "someone-else",
        interviewStatus: "INPROGRESS",
      } as never);

      handlers["interview:extend_time"]({ interviewId: "interview-1", extraMinutes: 5 });
      await flush();

      expect(interviewService.extendInterviewTimeService).not.toHaveBeenCalled();
      expect(roomEmit).not.toHaveBeenCalled();
      expect(socketEmit).toHaveBeenCalledWith(
        "ws:error",
        expect.objectContaining({ code: "AUTH_FORBIDDEN" }),
      );
    });
  });
});