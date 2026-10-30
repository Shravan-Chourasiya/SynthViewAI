import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { io } from 'socket.io-client';
import { createInterviewSocket } from '@/lib/socket/interview-socket';
import { env } from '@/lib/env';

// Mock socket.io-client
vi.mock('socket.io-client');
vi.mock('@/lib/env');

describe('interview-socket', () => {
  const mockEnv = {
    socketUrl: 'http://localhost:3000',
    socketPath: '/api/socket.io'
  };

  beforeEach(() => {
    vi.mocked(env).socketUrl = mockEnv.socketUrl;
    vi.mocked(env).socketPath = mockEnv.socketPath;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createInterviewSocket', () => {
    it('should create a socket instance with correct configuration', () => {
      const mockSocket = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      };
      vi.mocked(io).mockReturnValue(mockSocket);

      const socket = createInterviewSocket();

      expect(io).toHaveBeenCalledWith(mockEnv.socketUrl, {
        path: mockEnv.socketPath,
        withCredentials: true,
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
      });
      expect(socket).toBe(mockSocket);
    });

    it('should configure reconnection options correctly', () => {
      const mockSocket = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      };
      vi.mocked(io).mockReturnValue(mockSocket);

      createInterviewSocket();

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reconnection: true,
          reconnectionAttempts: 8,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 8000,
        })
      );
    });

    it('should disable autoConnect', () => {
      const mockSocket = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      };
      vi.mocked(io).mockReturnValue(mockSocket);

      createInterviewSocket();

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          autoConnect: false,
        })
      );
    });

    it('should enable withCredentials', () => {
      const mockSocket = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      };
      vi.mocked(io).mockReturnValue(mockSocket);

      createInterviewSocket();

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          withCredentials: true,
        })
      );
    });
  });
});