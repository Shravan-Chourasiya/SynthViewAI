/**
 * unit.websocket.test.ts
 * Unit tests for the websocket functionality.
 * Tests auth on socket connect, event handling, disconnect/reconnect scenarios,
 * and error handling as mentioned in Priority 2 of the test suite plan.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Server, Socket } from "socket.io";
import type { IncomingHttpHeaders } from "http";
import { registerSocketAuth } from "../src/websocket/socket.auth.js";
import { registerInterviewGateway } from "../src/websocket/interview.gateway.js";
import * as interviewService from "../src/modules/interview/services/interview.service.js";
import * as tokenUtil from "../src/utils/token.util.js";
import * as registry from "../src/websocket/socket.registry.js";
import * as contextService from "../src/modules/interview/services/interview.context.service.js";

vi.mock("../src/utils/token.util.js", () => ({
  verifyToken: vi.fn(),
  isTokenBlacklisted: vi.fn(),
  COOKIE_NAMES: { ACCESS: "access_token" },
}));

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

  // ── Socket authentication ───────────────────────────────────────────────────────────────

  describe("registerSocketAuth", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

    const makeSocket = (cookieHeader?: string) => {
      const nextFn = vi.fn();
      const socket = {
        id: "sock-1",
        data: {} as Record<string, unknown>,
        handshake: { headers: { cookie: cookieHeader } as IncomingHttpHeaders },
      };
      return { socket, nextFn };
    };

    beforeEach(() => {
      vi.mocked(tokenUtil.isTokenBlacklisted).mockResolvedValue(false);
      vi.mocked(tokenUtil.verifyToken).mockReturnValue({
        type: "access",
        userId: "user-1",
        sessionId: "session-1",
      } as never);
    });

    it("calls next() with no error when a valid access_token cookie is present", async () => {
      const { socket, nextFn } = makeSocket("access_token=valid.jwt.token");
      let capturedMiddleware: ((socket: unknown, next: unknown) => void) | undefined;
      const io = { use: (fn: (socket: unknown, next: unknown) => void) => { capturedMiddleware = fn; } } as unknown as Server;

      registerSocketAuth(io);
      capturedMiddleware!(socket, nextFn);
      await flush();

      expect(nextFn).toHaveBeenCalledWith(); // no error argument
      expect(socket.data.userId).toBe("user-1");
      expect(socket.data.sessionId).toBe("session-1");
    });

    it("calls next(Error) when the access_token cookie is missing", async () => {
      const { socket, nextFn } = makeSocket(undefined);
      let capturedMiddleware: ((socket: unknown, next: unknown) => void) | undefined;
      const io = { use: (fn: (socket: unknown, next: unknown) => void) => { capturedMiddleware = fn; } } as unknown as Server;

      registerSocketAuth(io);
      capturedMiddleware!(socket, nextFn);
      await flush();

      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
      const err = vi.mocked(nextFn).mock.calls[0]?.[0] as Error;
      expect(err.message).toMatch(/AUTH_UNAUTHORIZED/);
    });

    it("calls next(Error) when the token is blacklisted", async () => {
      vi.mocked(tokenUtil.isTokenBlacklisted).mockResolvedValue(true);
      const { socket, nextFn } = makeSocket("access_token=revoked.jwt.token");
      let capturedMiddleware: ((socket: unknown, next: unknown) => void) | undefined;
      const io = { use: (fn: (socket: unknown, next: unknown) => void) => { capturedMiddleware = fn; } } as unknown as Server;

      registerSocketAuth(io);
      capturedMiddleware!(socket, nextFn);
      await flush();

      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
      const err = vi.mocked(nextFn).mock.calls[0]?.[0] as Error;
      expect(err.message).toMatch(/AUTH_SESSION_EXPIRED/);
    });

    it("calls next(Error) when verifyToken throws (expired/invalid token)", async () => {
      vi.mocked(tokenUtil.verifyToken).mockImplementation(() => { throw new Error("jwt expired"); });
      const { socket, nextFn } = makeSocket("access_token=expired.jwt.token");
      let capturedMiddleware: ((socket: unknown, next: unknown) => void) | undefined;
      const io = { use: (fn: (socket: unknown, next: unknown) => void) => { capturedMiddleware = fn; } } as unknown as Server;

      registerSocketAuth(io);
      capturedMiddleware!(socket, nextFn);
      await flush();

      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
      const err = vi.mocked(nextFn).mock.calls[0]?.[0] as Error;
      expect(err.message).toMatch(/AUTH_SESSION_EXPIRED/);
    });
  });

  // ── QUESTION_NOT_COMPLETED gateway error ────────────────────────────────────────────

  describe("question:next — QUESTION_NOT_COMPLETED", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

    it("emits QUESTION_NOT_COMPLETED when requestNextQuestionService throws it", async () => {
      const socketEmit = vi.fn();
      const socket = {
        id: "socket-1",
        data: { userId: "user-1" } as Record<string, unknown>,
        emit: socketEmit,
        join: vi.fn(),
        leave: vi.fn(),
        on: vi.fn(),
      };
      const handlers: Record<string, (payload: unknown) => void> = {};
      socket.on = (event: string, handler: (payload: unknown) => void) => { handlers[event] = handler; return socket as never; };

      const io = {
        on: (_event: string, callback: (socket: unknown) => void) => callback(socket),
        to: vi.fn(() => ({ emit: vi.fn() })),
      } as unknown as Server;

      vi.mocked(interviewService.fetchInterviewById).mockResolvedValue({
        userId: "user-1",
        interviewStatus: "INPROGRESS",
      } as never);

      const { AppError } = await import("../src/utils/AppError.js");
      vi.mocked(interviewService.requestNextQuestionService).mockRejectedValue(
        new AppError("Current question is not yet completed", 409, "QUESTION_NOT_COMPLETED", { isOperational: true }),
      );

      registerInterviewGateway(io);
      handlers["question:next"]?.({ interviewId: "interview-1" });
      await flush();

      expect(socketEmit).toHaveBeenCalledWith(
        "ws:error",
        expect.objectContaining({ code: "QUESTION_NOT_COMPLETED" }),
      );
    });
  });
});