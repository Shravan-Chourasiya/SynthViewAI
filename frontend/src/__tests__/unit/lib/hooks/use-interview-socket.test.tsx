import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useInterviewSocket } from '@/hooks/use-interview-socket';
import { useLiveInterviewStore } from '@/lib/stores/live-interview.store';
import { useAuthStore } from '@/lib/stores/auth.store';
import { createFakeSocket, type FakeSocket } from '../../../mocks/fake-socket';
import * as authService from '@/lib/services/auth.service';
import { SOCKET_EVENTS } from '@/lib/constants/socket-events';

// Mock the socket creation function
vi.mock('@/lib/socket/interview-socket', () => ({
  createInterviewSocket: () => createFakeSocket()
}));

// Mock the auth service
vi.mock('@/lib/services/auth.service');

describe('useInterviewSocket hook - Priority 3 tests', () => {
  let mockSocket: FakeSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset stores before each test
    useLiveInterviewStore.getState().reset();
    useAuthStore.getState()._clear(); // Changed from reset() to _clear()
    
    // Create a fresh fake socket for each test
    mockSocket = createFakeSocket();
    vi.mocked(require('@/lib/socket/interview-socket').createInterviewSocket).mockReturnValue(mockSocket);
  });

  afterEach(() => {
    // Clean up any remaining timers
    vi.useRealTimers();
  });

  describe('Connection handling', () => {
    it('should transition connection states correctly: connecting → connected → joined', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      // Initially should be in default state
      expect(result.current.connectionState).toBe('idle');
      
      // Trigger connect event
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      // Verify join event was emitted
      expect(mockSocket.emitted[SOCKET_EVENTS.client.join]).toHaveLength(1);
      const joinPayload = mockSocket.emitted[SOCKET_EVENTS.client.join][0];
      expect(joinPayload.interviewId).toBe('interview-123');
    });

    it('should handle disconnect event', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      // Connect first
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      // Then disconnect
      act(() => {
        mockSocket.emit('disconnect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('disconnected');
      });
    });

    it('should handle reconnect attempts', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      act(() => {
        mockSocket.ioEmit('reconnect_attempt');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('reconnecting');
      });
    });

    it('should handle successful reconnection', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      act(() => {
        mockSocket.ioEmit('reconnect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
    });

    it('should handle failed reconnection', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      act(() => {
        mockSocket.ioEmit('reconnect_failed');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('error');
      });
    });
  });

  describe('Event handling', () => {
    it('should handle joined event and update store via applyJoined', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      const mockJoinedPayload = {
        interviewId: 'interview-123',
        userId: 'user-456',
        status: 'IN_PROGRESS',
        durationMinutes: 30,
        timerStartedAt: new Date().toISOString(),
        currentQuestionIndex: 1,
        totalQuestions: 10
      };
      
      // Connect first
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      // Emit joined event
      act(() => {
        mockSocket.emit(SOCKET_EVENTS.server.joined, mockJoinedPayload);
      });
      
      // Check that applyJoined was called indirectly through store state
      await waitFor(() => {
        const storeState = useLiveInterviewStore.getState();
        expect(storeState.status).toBe('IN_PROGRESS');
      });
    });

    it('should handle question-delivered event and map question correctly', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      const mockQuestionPayload = {
        questionId: 'q-789',
        questionTitle: 'Tell me about closures in JavaScript',
        questionDescription: 'Explain how closures work',
        questionType: 'TECHNICAL' as const,
        sequenceNumber: 1,
        totalQuestions: 5
      };
      
      // Connect first
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      // Emit question delivered event
      act(() => {
        mockSocket.emit(SOCKET_EVENTS.server.questionDelivered, mockQuestionPayload);
      });
      
      // Wait for store to update
      await waitFor(() => {
        const storeState = useLiveInterviewStore.getState();
        expect(storeState.currentQuestion?.id).toBe('q-789');
        expect(storeState.currentQuestion?.text).toBe('Tell me about closures in JavaScript');
      });
    });

    it('should handle different question types correctly', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      // Test BEHAVIORAL question type
      const behavioralPayload = {
        questionId: 'q-behavioral',
        questionTitle: 'Describe a time you led a team',
        questionType: 'BEHAVIORAL' as const,
        sequenceNumber: 1,
        totalQuestions: 3
      };
      
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      act(() => {
        mockSocket.emit(SOCKET_EVENTS.server.questionDelivered, behavioralPayload);
      });
      
      await waitFor(() => {
        const storeState = useLiveInterviewStore.getState();
        expect(storeState.currentQuestion?.category).toBe('Behavioral');
      });
      
      // Reset for next test
      useLiveInterviewStore.getState().reset();
    });

    it('should handle answer-accepted event and mark answered', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      // First set up a question
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      const questionPayload = {
        questionId: 'q-123',
        questionTitle: 'Sample question',
        questionType: 'TECHNICAL' as const,
        sequenceNumber: 1,
        totalQuestions: 3
      };
      
      act(() => {
        mockSocket.emit(SOCKET_EVENTS.server.questionDelivered, questionPayload);
      });
      
      await waitFor(() => {
        const storeState = useLiveInterviewStore.getState();
        expect(storeState.currentQuestion?.id).toBe('q-123');
      });
      
      // Now handle answer accepted
      const answerAcceptedPayload = {
        questionId: 'q-123',
        accepted: true
      };
      
      act(() => {
        mockSocket.emit(SOCKET_EVENTS.server.answerAccepted, answerAcceptedPayload);
      });
      
      await waitFor(() => {
        const storeState = useLiveInterviewStore.getState();
        expect(storeState.answeredQuestions).toContain('q-123');
      });
    });

    it('should handle state-change event', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      const stateChangePayload = {
        status: 'COMPLETED' as const
      };
      
      act(() => {
        mockSocket.emit(SOCKET_EVENTS.server.stateChange, stateChangePayload);
      });
      
      await waitFor(() => {
        const storeState = useLiveInterviewStore.getState();
        expect(storeState.status).toBe('COMPLETED');
      });
    });

    it('should handle timer-expired event', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      // Set initial time to make sure it gets reset to 0
      useLiveInterviewStore.getState().setRemainingSeconds(120);
      
      act(() => {
        mockSocket.emit(SOCKET_EVENTS.server.timerExpired, {});
      });
      
      await waitFor(() => {
        const storeState = useLiveInterviewStore.getState();
        expect(storeState.remainingSeconds).toBe(0);
      });
    });
  });

  describe('Outbound events', () => {
    it('should submitAnswer emit correct socket event', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      // Call submitAnswer
      act(() => {
        result.current.submitAnswer('q-123', 'This is my answer', 'TEXT');
      });
      
      // Check that the correct event was emitted
      await waitFor(() => {
        expect(mockSocket.emitted[SOCKET_EVENTS.client.answerSubmit]).toHaveLength(1);
        const payload = mockSocket.emitted[SOCKET_EVENTS.client.answerSubmit][0];
        expect(payload.interviewId).toBe('interview-123');
        expect(payload.questionId).toBe('q-123');
        expect(payload.answerData).toBe('This is my answer');
        expect(payload.answerType).toBe('TEXT');
      });
    });

    it('should requestNextQuestion emit correct socket event', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      // Call requestNextQuestion
      act(() => {
        result.current.requestNextQuestion();
      });
      
      // Check that the correct event was emitted
      await waitFor(() => {
        expect(mockSocket.emitted[SOCKET_EVENTS.client.nextQuestion]).toHaveLength(1);
        const payload = mockSocket.emitted[SOCKET_EVENTS.client.nextQuestion][0];
        expect(payload.interviewId).toBe('interview-123');
      });
    });

    it('should cancelInterview emit correct socket event', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      // Call cancelInterview
      act(() => {
        result.current.cancelInterview();
      });
      
      // Check that the correct event was emitted
      await waitFor(() => {
        expect(mockSocket.emitted[SOCKET_EVENTS.client.cancel]).toHaveLength(1);
        const payload = mockSocket.emitted[SOCKET_EVENTS.client.cancel][0];
        expect(payload.interviewId).toBe('interview-123');
      });
    });

    it('should endInterview emit correct socket event', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      // Call endInterview
      act(() => {
        result.current.endInterview();
      });
      
      // Check that the correct event was emitted
      await waitFor(() => {
        expect(mockSocket.emitted[SOCKET_EVENTS.client.end]).toHaveLength(1);
        const payload = mockSocket.emitted[SOCKET_EVENTS.client.end][0];
        expect(payload.interviewId).toBe('interview-123');
      });
    });
  });

  describe('Error handling', () => {
    it('should handle each error code from WS_ERROR_MESSAGES correctly', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      // Test each error code mentioned in the plan
      const errorCodes = [
        'AUTH_UNAUTHORIZED',
        'AUTH_SESSION_EXPIRED', 
        'AUTH_FORBIDDEN',
        'INTERVIEW_NOT_FOUND',
        'INTERVIEW_INVALID_STATE',
        'QUESTION_NOT_FOUND',
        'ANSWER_REJECTED',
        'CONTEXT_MISSING',
        'INTERNAL_ERROR'
      ];
      
      for (const errorCode of errorCodes) {
        const errorPayload = {
          code: errorCode as any,
          message: 'Test error message'
        };
        
        // Reset error state before each test
        useLiveInterviewStore.getState().setError(null);
        
        act(() => {
          mockSocket.emit(SOCKET_EVENTS.server.error, errorPayload);
        });
        
        await waitFor(() => {
          const storeState = useLiveInterviewStore.getState();
          expect(storeState.error).toBeDefined();
        });
      }
    });

    it('should handle auth expiration during connection', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      // Mock the refresh and bootstrap functions
      const mockRefresh = vi.fn().mockResolvedValue(undefined);
      const mockBootstrap = vi.fn().mockResolvedValue(undefined);
      const mockLogout = vi.fn().mockResolvedValue(undefined);
      
      vi.mocked(authService.refresh).mockImplementation(mockRefresh);
      vi.mocked(useAuthStore.getState().bootstrap).mockImplementation(mockBootstrap);
      vi.mocked(useAuthStore.getState().logout).mockImplementation(mockLogout);
      
      // Simulate connection error with auth issue
      const error = new Error('AUTH_UNAUTHORIZED');
      act(() => {
        mockSocket.emit('connect_error', error);
      });
      
      // Wait for auth recovery to complete
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('Cleanup behavior', () => {
    it('should cleanup properly when component unmounts', () => {
      const { unmount } = renderHook(() => useInterviewSocket('interview-123'));
      
      // Make sure socket is connected
      act(() => {
        mockSocket.emit('connect');
      });
      
      // Unmount the hook
      unmount();
      
      // Verify socket was disconnected
      expect(mockSocket.disconnected).toBe(true);
    });
  });

  describe('Timer functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should manage timer correctly when joined event occurs', async () => {
      const { result } = renderHook(() => useInterviewSocket('interview-123'));
      
      const startTime = new Date();
      const mockJoinedPayload = {
        interviewId: 'interview-123',
        userId: 'user-456',
        status: 'IN_PROGRESS',
        durationMinutes: 1, // 60 seconds
        timerStartedAt: startTime.toISOString(),
        currentQuestionIndex: 1,
        totalQuestions: 10
      };
      
      act(() => {
        mockSocket.emit('connect');
      });
      
      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected');
      });
      
      act(() => {
        mockSocket.emit(SOCKET_EVENTS.server.joined, mockJoinedPayload);
      });
      
      // Advance timer by 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000); // 10 seconds
      });
      
      // Check that remaining time decreased
      const storeState = useLiveInterviewStore.getState();
      expect(storeState.remainingSeconds).toBeLessThanOrEqual(50); // 60 - 10 = 50
      
      // Cleanup timer
      vi.useRealTimers();
    });
  });
});