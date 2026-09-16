import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveInterviewStore } from '@/lib/stores/live-interview.store';

describe('live-interview.store', () => {
  beforeEach(() => {
    // Reset the store before each test by setting initial state
    useLiveInterviewStore.setState({
      interviewId: null,
      connectionState: "idle",
      interviewStatus: null,
      timerStartedAt: null,
      durationMinutes: null,
      remainingSeconds: 0,
      currentQuestion: null,
      questionNumber: 0,
      totalQuestions: null,
      aiStatus: "idle",
      lastEvaluation: null,
      answeredCount: 0,
      answeredQuestionIds: [],
      transcript: [],
      error: null,
      mediaStream: null,
    });
  });

  describe('initial state', () => {
    it('should initialize with correct default values', () => {
      const state = useLiveInterviewStore.getState();
      
      expect(state.interviewId).toBeNull();
      expect(state.connectionState).toBe('idle');
      expect(state.interviewStatus).toBeNull();
      expect(state.timerStartedAt).toBeNull();
      expect(state.durationMinutes).toBeNull();
      expect(state.remainingSeconds).toBe(0);
      expect(state.currentQuestion).toBeNull();
      expect(state.questionNumber).toBe(0);
      expect(state.totalQuestions).toBeNull();
      expect(state.aiStatus).toBe('idle');
      expect(state.lastEvaluation).toBeNull();
      expect(state.answeredCount).toBe(0);
      expect(state.answeredQuestionIds).toEqual([]);
      expect(state.transcript).toEqual([]);
      expect(state.error).toBeNull();
      expect(state.mediaStream).toBeNull();
    });
  });

  describe('setConnectionState', () => {
    it('should update connection state', () => {
      const { setConnectionState } = useLiveInterviewStore.getState();
      setConnectionState('connected');

      const state = useLiveInterviewStore.getState();
      expect(state.connectionState).toBe('connected');
    });
  });

  describe('setInterviewId', () => {
    it('should update interview id', () => {
      const { setInterviewId } = useLiveInterviewStore.getState();
      setInterviewId('interview-123');

      const state = useLiveInterviewStore.getState();
      expect(state.interviewId).toBe('interview-123');
    });
  });

  describe('applyJoined', () => {
    it('should update state when joining an interview', () => {
      const { applyJoined } = useLiveInterviewStore.getState();
      applyJoined({
        interviewId: 'interview-123',
        timerStartedAt: '2023-01-01T10:00:00Z',
        durationMinutes: 30,
        answeredQuestionIds: ['q1', 'q2']
      });

      const state = useLiveInterviewStore.getState();
      expect(state.interviewId).toBe('interview-123');
      expect(state.timerStartedAt).toBe('2023-01-01T10:00:00Z');
      expect(state.durationMinutes).toBe(30);
      expect(state.remainingSeconds).toBe(1800); // 30 minutes in seconds
      expect(state.answeredQuestionIds).toEqual(['q1', 'q2']);
      expect(state.answeredCount).toBe(2);
    });
  });

  describe('applyStateChange', () => {
    it('should update interview status', () => {
      const { applyStateChange } = useLiveInterviewStore.getState();
      applyStateChange('IN_PROGRESS');

      const state = useLiveInterviewStore.getState();
      expect(state.interviewStatus).toBe('IN_PROGRESS');
    });
  });

  describe('applyQuestion', () => {
    it('should update current question and reset evaluation/AI status', () => {
      // Set some previous state
      useLiveInterviewStore.setState({
        lastEvaluation: { score: 8, feedback: 'Good job' },
        aiStatus: 'evaluating'
      });

      const mockQuestion = { id: 'q1', text: 'What is React?' };
      const { applyQuestion } = useLiveInterviewStore.getState();
      applyQuestion(mockQuestion, 2, 5);

      const state = useLiveInterviewStore.getState();
      expect(state.currentQuestion).toEqual(mockQuestion);
      expect(state.questionNumber).toBe(2);
      expect(state.totalQuestions).toBe(5);
      expect(state.lastEvaluation).toBeNull(); // Should be reset
      expect(state.aiStatus).toBe('idle'); // Should be reset
    });
  });

  describe('setAiStatus', () => {
    it('should update AI status', () => {
      const { setAiStatus } = useLiveInterviewStore.getState();
      setAiStatus('generating');

      const state = useLiveInterviewStore.getState();
      expect(state.aiStatus).toBe('generating');
    });
  });

  describe('applyEvaluation', () => {
    it('should update last evaluation', () => {
      const mockEvaluation = { score: 9, feedback: 'Excellent answer' };
      const { applyEvaluation } = useLiveInterviewStore.getState();
      applyEvaluation(mockEvaluation);

      const state = useLiveInterviewStore.getState();
      expect(state.lastEvaluation).toEqual(mockEvaluation);
    });
  });

  describe('markAnswered', () => {
    it('should add question ID to answered list and increment count', () => {
      const { markAnswered } = useLiveInterviewStore.getState();
      markAnswered('q1');

      const state = useLiveInterviewStore.getState();
      expect(state.answeredQuestionIds).toEqual(['q1']);
      expect(state.answeredCount).toBe(1);
    });

    it('should not add duplicate question IDs', () => {
      useLiveInterviewStore.setState({
        answeredQuestionIds: ['q1'],
        answeredCount: 1
      });

      const { markAnswered } = useLiveInterviewStore.getState();
      markAnswered('q1'); // Duplicate

      const state = useLiveInterviewStore.getState();
      expect(state.answeredQuestionIds).toEqual(['q1']); // Still only one
      expect(state.answeredCount).toBe(1); // Count unchanged
    });
  });

  describe('setRemainingSeconds', () => {
    it('should update remaining seconds', () => {
      const { setRemainingSeconds } = useLiveInterviewStore.getState();
      setRemainingSeconds(120);

      const state = useLiveInterviewStore.getState();
      expect(state.remainingSeconds).toBe(120);
    });
  });

  describe('appendTranscript', () => {
    it('should add entry to transcript', () => {
      const { appendTranscript } = useLiveInterviewStore.getState();
      appendTranscript('User said hello');
      appendTranscript('AI responded');

      const state = useLiveInterviewStore.getState();
      expect(state.transcript).toEqual(['User said hello', 'AI responded']);
    });
  });

  describe('setError', () => {
    it('should update error message', () => {
      const { setError } = useLiveInterviewStore.getState();
      setError('Connection failed');

      const state = useLiveInterviewStore.getState();
      expect(state.error).toBe('Connection failed');
    });

    it('should clear error when null is passed', () => {
      useLiveInterviewStore.setState({ error: 'Some error' });

      const { setError } = useLiveInterviewStore.getState();
      setError(null);

      const state = useLiveInterviewStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('setMediaStream', () => {
    it('should update media stream', () => {
      const mockStream = { id: 'stream-123', getTracks: vi.fn() } as unknown as MediaStream;
      const { setMediaStream } = useLiveInterviewStore.getState();
      setMediaStream(mockStream);

      const state = useLiveInterviewStore.getState();
      expect(state.mediaStream).toBe(mockStream);
    });
  });

  describe('clearMediaStream', () => {
    it('should clear media stream and stop tracks', () => {
      const mockTrack = { stop: vi.fn() };
      const mockStream = { 
        id: 'stream-123', 
        getTracks: vi.fn().mockReturnValue([mockTrack]) 
      } as unknown as MediaStream;

      useLiveInterviewStore.setState({ mediaStream: mockStream });

      const { clearMediaStream } = useLiveInterviewStore.getState();
      clearMediaStream();

      expect(mockTrack.stop).toHaveBeenCalled();
      
      const state = useLiveInterviewStore.getState();
      expect(state.mediaStream).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state and stop media tracks', () => {
      const mockTrack = { stop: vi.fn() };
      const mockStream = { 
        id: 'stream-123', 
        getTracks: vi.fn().mockReturnValue([mockTrack]) 
      } as unknown as MediaStream;

      // Set some state to reset
      useLiveInterviewStore.setState({
        interviewId: 'interview-123',
        connectionState: 'connected',
        mediaStream: mockStream,
        error: 'Some error'
      });

      const { reset } = useLiveInterviewStore.getState();
      reset();

      expect(mockTrack.stop).toHaveBeenCalled();

      const state = useLiveInterviewStore.getState();
      expect(state.interviewId).toBeNull();
      expect(state.connectionState).toBe('idle');
      expect(state.error).toBeNull();
      expect(state.mediaStream).toBeNull();
      // And all other properties should be back to initial state
      expect(state.interviewStatus).toBeNull();
      expect(state.timerStartedAt).toBeNull();
      expect(state.currentQuestion).toBeNull();
      expect(state.questionNumber).toBe(0);
      expect(state.aiStatus).toBe('idle');
      expect(state.lastEvaluation).toBeNull();
      expect(state.answeredCount).toBe(0);
      expect(state.answeredQuestionIds).toEqual([]);
      expect(state.transcript).toEqual([]);
    });
  });
});