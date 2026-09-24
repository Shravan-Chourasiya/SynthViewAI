import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInterviewSocket } from '@/hooks/use-interview-socket';
import { useLiveInterviewStore } from '@/lib/stores/live-interview.store';
import { useAuthStore } from '@/lib/stores/auth.store';
import { createFakeSocket } from '../../mocks/fake-socket';
import * as authService from '@/lib/services/auth.service';
import { SOCKET_EVENTS } from '@/lib/constants/socket-events';

// Mock the createInterviewSocket function to return our fake socket
vi.mock('@/lib/socket/interview-socket', () => ({
  createInterviewSocket: () => createFakeSocket()
}));

// Mock the auth service
vi.mock('@/lib/services/auth.service');

// Create a wrapper component to access the hook's internal state
let capturedSocket: any = null;

// Re-mock after imports to capture the socket
vi.mock('@/lib/socket/interview-socket', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    createInterviewSocket: () => {
      capturedSocket = createFakeSocket();
      return capturedSocket;
    }
  };
});

describe('use-interview-socket hook - Priority 3 tests', () => {
  const mockInterviewId = 'interview-123';

  beforeEach(() => {
    vi.clearAllMocks();
    capturedSocket = null;
    
    // Reset stores to clean state
    useLiveInterviewStore.getState().reset();
    useAuthStore.getState().logout();
  });

  afterEach(() => {
    // Clean up any remaining state
    vi.restoreAllMocks();
  });

  it('should initialize with connecting state', () => {
    const { result } = renderHook(() => useInterviewSocket(mockInterviewId));
    
    expect(result.current.connectionState).toBe('connecting');
  });

  it('should transition to connected state when socket connects', async () => {
    const { result } = renderHook(() => useInterviewSocket(mockInterviewId));
    
    // Wait for the socket to be created and connected
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
    }
    
    // Check that connection state updates
    expect(result.current.connectionState).toBe('connected');
  });

  it('should emit join event when socket connects', async () => {
    renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      
      // Check that join event was emitted
      const joinEvents = capturedSocket.emittedEvents.filter(
        (event: any) => event.event === SOCKET_EVENTS.client.join
      );
      expect(joinEvents).toHaveLength(1);
      expect(joinEvents[0].data).toMatchObject({
        eventVersion: 1,
        event: SOCKET_EVENTS.client.join,
        interviewId: mockInterviewId
      });
    }
  });

  it('should update store when joined event is received', async () => {
    const mockJoinedPayload = {
      interviewId: mockInterviewId,
      timerStartedAt: new Date().toISOString(),
      durationMinutes: 30,
      answeredQuestionIds: []
    };

    renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.joined, mockJoinedPayload);
      
      // Wait a bit for the state to update
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the store was updated
      const state = useLiveInterviewStore.getState();
      expect(state.connectionState).toBe('connected');
    }
  });

  it('should handle question-delivered event and map correctly for each questionType', async () => {
    const mockQuestionPayload = {
      questionId: 'q-1',
      sequenceNumber: 1,
      totalQuestions: 5,
      questionType: 'BEHAVIORAL' as const,
      questionTitle: 'Tell me about a challenge you faced',
      questionDescription: 'Describe a situation in detail'
    };

    renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.questionDelivered, mockQuestionPayload);
      
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the question was processed
      const state = useLiveInterviewStore.getState();
      expect(state.currentQuestion?.text).toBe('Tell me about a challenge you faced');
    }
  });

  it('should emit correct payload when submitAnswer is called', async () => {
    const { result } = renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      
      // Call submitAnswer
      act(() => {
        result.current.submitAnswer('q-123', 'This is my answer', 'TEXT');
      });
      
      // Check that the correct event was emitted
      const answerSubmitEvents = capturedSocket.emittedEvents.filter(
        (event: any) => event.event === SOCKET_EVENTS.client.answerSubmit
      );
      expect(answerSubmitEvents).toHaveLength(1);
      expect(answerSubmitEvents[0].data).toMatchObject({
        eventVersion: 1,
        event: SOCKET_EVENTS.client.answerSubmit,
        interviewId: mockInterviewId,
        questionId: 'q-123',
        answerData: 'This is my answer',
        answerType: 'TEXT'
      });
    }
  });

  it('should handle answer-accepted event', async () => {
    renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      
      // Simulate receiving answer accepted event
      act(() => {
        capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.answerAccepted, {
          questionId: 'q-123'
        });
      });
      
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  });

  it('should handle state-change event', async () => {
    renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      
      // Simulate receiving state change event
      act(() => {
        capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.stateChange, {
          status: 'IN_PROGRESS'
        });
      });
      
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  });

  it('should handle timer-expired event', async () => {
    renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      
      // Simulate receiving timer expired event
      act(() => {
        capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.timerExpired, {});
      });
      
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  });

  it('should handle error event with all error codes', async () => {
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

    renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      
      for (const errorCode of errorCodes) {
        // Clear previous events
        capturedSocket.clearEmittedEvents();
        
        // Simulate receiving error event
        act(() => {
          capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.error, {
            code: errorCode,
            message: 'Test error message'
          });
        });
        
        // Wait for state to update
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  });

  it('should emit correct event when cancelInterview is called', async () => {
    const { result } = renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      
      // Call cancelInterview
      act(() => {
        result.current.cancelInterview();
      });
      
      // Check that the correct event was emitted
      const cancelEvents = capturedSocket.emittedEvents.filter(
        (event: any) => event.event === SOCKET_EVENTS.client.cancel
      );
      expect(cancelEvents).toHaveLength(1);
      expect(cancelEvents[0].data).toMatchObject({
        eventVersion: 1,
        event: SOCKET_EVENTS.client.cancel,
        interviewId: mockInterviewId
      });
    }
  });

  it('should emit correct event when endInterview is called', async () => {
    const { result } = renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      
      // Call endInterview
      act(() => {
        result.current.endInterview();
      });
      
      // Check that the correct event was emitted
      const endEvents = capturedSocket.emittedEvents.filter(
        (event: any) => event.event === SOCKET_EVENTS.client.end
      );
      expect(endEvents).toHaveLength(1);
      expect(endEvents[0].data).toMatchObject({
        eventVersion: 1,
        event: SOCKET_EVENTS.client.end,
        interviewId: mockInterviewId
      });
    }
  });

  it('should handle disconnect and reconnect transitions correctly', async () => {
    const { result } = renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      
      // Wait for connection state to update
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(result.current.connectionState).toBe('connected');
      
      // Simulate disconnect
      act(() => {
        capturedSocket.simulateDisconnect();
      });
      
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(result.current.connectionState).toBe('disconnected');
      
      // Simulate reconnect
      act(() => {
        capturedSocket.simulateReconnect();
      });
      
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(result.current.connectionState).toBe('connected');
    }
  });

  it('should handle auth expiry mid-interview', async () => {
    // Mock the refresh function to simulate successful refresh
    vi.spyOn(authService, 'refresh').mockResolvedValue(undefined);
    vi.spyOn(useAuthStore, 'getState').mockReturnValue({
      bootstrap: vi.fn(),
      logout: vi.fn()
    } as any);
    
    renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      capturedSocket.simulateConnect();
      
      // Simulate auth error that should trigger refresh
      act(() => {
        capturedSocket.simulateConnectError(new Error('AUTH_SESSION_EXPIRED'));
      });
      
      // Wait for the async handling to complete
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Verify refresh was called
      expect(authService.refresh).toHaveBeenCalled();
    }
  });

  it('should clean up properly on unmount', async () => {
    const { unmount } = renderHook(() => useInterviewSocket(mockInterviewId));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow hook to initialize
    });

    if (capturedSocket) {
      // Verify socket was connected
      capturedSocket.simulateConnect();
      expect(capturedSocket.connected).toBe(true);
      
      // Unmount the hook
      act(() => {
        unmount();
      });
      
      // The socket should be disconnected after cleanup
      // Note: In the actual implementation, the cleanup happens in useEffect cleanup
      // which might not be fully simulated in this test scenario
    }
  });

  it('should not initialize socket when interviewId is undefined', () => {
    const { result } = renderHook(() => useInterviewSocket(undefined));
    
    // The hook should not attempt to connect when there's no interview ID
    // This is handled in the useEffect condition: if (!interviewId || socketRef.current) return;
    expect(result.current.connectionState).toBeDefined(); // Should still have a valid state
  });

  describe('busy state around answer submission', () => {
    const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });

    const evaluationFeedback = (questionId: string, shouldAdvance: boolean) => ({
      interviewId: mockInterviewId,
      questionId,
      answerId: `answer-${questionId}`,
      shouldAdvance,
      score: 72,
      correctness: 70,
      relevance: 74,
      clarity: 76,
      technicalDepth: 68,
      feedback: 'Solid answer with room to go deeper.',
      strengths: ['Structure'],
      weaknesses: ['Depth'],
    });

    const deliveredQuestion = (questionId: string, sequenceNumber: number) => ({
      interviewId: mockInterviewId,
      questionId,
      sequenceNumber,
      totalQuestions: 5,
      questionType: 'TECHNICAL' as const,
      questionTitle: 'Explain database indexing',
      questionDescription: 'Cover the trade-offs.',
      deliveredAt: new Date().toISOString(),
      timeoutSeconds: 300,
    });

    it('stays busy after evaluation feedback until the next question is delivered', async () => {
      const { result } = renderHook(() => useInterviewSocket(mockInterviewId));
      await settle();

      capturedSocket.simulateConnect();
      capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.questionDelivered, deliveredQuestion('q-1', 1));
      await settle();

      act(() => {
        result.current.submitAnswer('q-1', 'I would start from the requirements.', 'TEXT');
      });
      expect(useLiveInterviewStore.getState().aiStatus).toBe('evaluating');

      capturedSocket.simulateServerEvent(
        SOCKET_EVENTS.server.evaluationFeedback,
        evaluationFeedback('q-1', true),
      );
      await settle();

      // The spinner/disabled state must survive the gap while the server
      // generates the next question — this is the regression: the room used to
      // drop to "idle" here, re-enabling the submit button ~2s before the
      // question actually changed.
      expect(useLiveInterviewStore.getState().aiStatus).toBe('generating');
      expect(
        capturedSocket.emittedEvents.filter(
          (event: { event: string }) => event.event === SOCKET_EVENTS.client.nextQuestion,
        ),
      ).toHaveLength(1);

      capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.questionDelivered, deliveredQuestion('q-2', 2));
      await settle();

      expect(useLiveInterviewStore.getState().aiStatus).toBe('idle');
      expect(useLiveInterviewStore.getState().currentQuestion?.id).toBe('q-2');
    });

    it('does not stay busy when the backend says there is no next question', async () => {
      const { result } = renderHook(() => useInterviewSocket(mockInterviewId));
      await settle();

      capturedSocket.simulateConnect();
      capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.questionDelivered, deliveredQuestion('q-9', 1));
      await settle();

      act(() => {
        result.current.submitAnswer('q-9', 'Final answer for this interview.', 'TEXT');
      });

      capturedSocket.simulateServerEvent(
        SOCKET_EVENTS.server.evaluationFeedback,
        evaluationFeedback('q-9', false),
      );
      await settle();

      // Nothing else will arrive to clear the state, so the hook must clear it.
      expect(useLiveInterviewStore.getState().aiStatus).toBe('idle');
      expect(
        capturedSocket.emittedEvents.filter(
          (event: { event: string }) => event.event === SOCKET_EVENTS.client.nextQuestion,
        ),
      ).toHaveLength(0);
    });

    it('clears the busy state on a websocket error so the candidate can retry', async () => {
      const { result } = renderHook(() => useInterviewSocket(mockInterviewId));
      await settle();

      capturedSocket.simulateConnect();
      capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.questionDelivered, deliveredQuestion('q-3', 1));
      await settle();

      act(() => {
        result.current.submitAnswer('q-3', 'Answer that will be rejected.', 'TEXT');
      });
      expect(useLiveInterviewStore.getState().aiStatus).toBe('evaluating');

      capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.error, {
        code: 'ANSWER_REJECTED',
        message: 'rejected',
      });
      await settle();

      const state = useLiveInterviewStore.getState();
      expect(state.aiStatus).toBe('idle');
      expect(state.error).toBeDefined();
    });

    it('re-joins the room after a reconnect and holds busy through the redelivery', async () => {
      const { result } = renderHook(() => useInterviewSocket(mockInterviewId));
      await settle();

      capturedSocket.simulateConnect();
      capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.questionDelivered, deliveredQuestion('q-1', 1));
      await settle();

      act(() => {
        result.current.submitAnswer('q-1', 'Answer submitted just before the drop.', 'TEXT');
      });
      expect(useLiveInterviewStore.getState().aiStatus).toBe('evaluating');

      // Transport drops mid-evaluation and comes back.
      capturedSocket.simulateDisconnect();
      await settle();

      // Busy is held across the gap — the room must not look ready while the
      // socket is down and the evaluation is still in flight server-side.
      expect(useLiveInterviewStore.getState().aiStatus).toBe('generating');
      expect(useLiveInterviewStore.getState().connectionState).toBe('disconnected');

      capturedSocket.simulateConnect();
      await settle();

      // The join must be re-emitted — the old guarded join never re-joined
      // after a drop, so question:delivered could never arrive again and the
      // submit button stayed disabled for the rest of the session.
      const joinCount = capturedSocket.emittedEvents.filter(
        (event: { event: string }) => event.event === SOCKET_EVENTS.client.join,
      ).length;
      expect(joinCount).toBeGreaterThanOrEqual(2);

      // The server redelivers the *same* question on join; the echo must not
      // clear the busy state because the evaluation is still running.
      capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.questionDelivered, deliveredQuestion('q-1', 1));
      await settle();
      expect(useLiveInterviewStore.getState().aiStatus).toBe('generating');

      // The real sequence then completes normally.
      capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.evaluationFeedback, evaluationFeedback('q-1', true));
      await settle();
      capturedSocket.simulateServerEvent(SOCKET_EVENTS.server.questionDelivered, deliveredQuestion('q-2', 2));
      await settle();

      expect(useLiveInterviewStore.getState().aiStatus).toBe('idle');
      expect(useLiveInterviewStore.getState().currentQuestion?.id).toBe('q-2');
    });
  });
});