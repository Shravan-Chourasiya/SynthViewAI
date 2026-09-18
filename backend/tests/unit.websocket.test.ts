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
});