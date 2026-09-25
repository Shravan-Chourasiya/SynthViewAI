import { create } from "zustand";
import type { Evaluation, Question } from "../types";
import type { BackendInterviewStatus } from "../types/api";

export type LiveConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";
export type LiveAiStatus = "idle" | "thinking" | "generating" | "evaluating";

export type LiveInterviewState = {
  interviewId: string | null;
  connectionState: LiveConnectionState;
  interviewStatus: BackendInterviewStatus | null;
  timerStartedAt: string | null;
  durationMinutes: number | null;
  remainingSeconds: number;
  currentQuestion: Question | null;
  questionNumber: number;
  totalQuestions: number | null;
  aiStatus: LiveAiStatus;
  // The backend is authoritative for all score aggregation and final reports.
  // Keep only the current evaluation for transport/adaptive-session state; do
  // not duplicate server-side report aggregation in the browser.
  lastEvaluation: Evaluation | null;
  answeredCount: number;
  answeredQuestionIds: string[];
  transcript: string[];
  error: string | null;
  /** Runtime-only browser object; never persisted by this store. */
  mediaStream: MediaStream | null;
  setConnectionState: (connectionState: LiveConnectionState) => void;
  setInterviewId: (interviewId: string) => void;
  applyJoined: (payload: {
    interviewId: string;
    timerStartedAt: string;
    durationMinutes: number;
    answeredQuestionIds: string[];
  }) => void;
  applyStateChange: (status: BackendInterviewStatus) => void;
  applyQuestion: (
    question: Question,
    questionNumber: number,
    totalQuestions: number | null,
  ) => void;
  setAiStatus: (aiStatus: LiveAiStatus) => void;
  applyEvaluation: (evaluation: Evaluation) => void;
  markAnswered: (questionId: string) => void;
  setRemainingSeconds: (remainingSeconds: number) => void;
  appendTranscript: (entry: string) => void;
  setError: (error: string | null) => void;
  setMediaStream: (mediaStream: MediaStream | null) => void;
  clearMediaStream: () => void;
  reset: () => void;
};

const initialState = {
  interviewId: null,
  connectionState: "idle" as LiveConnectionState,
  interviewStatus: null,
  timerStartedAt: null,
  durationMinutes: null,
  remainingSeconds: 0,
  currentQuestion: null,
  questionNumber: 0,
  totalQuestions: null,
  aiStatus: "idle" as LiveAiStatus,
  lastEvaluation: null,
  answeredCount: 0,
  answeredQuestionIds: [],
  transcript: [],
  error: null,
  mediaStream: null as MediaStream | null,
};

export const useLiveInterviewStore = create<LiveInterviewState>((set) => ({
  ...initialState,
  setConnectionState: (connectionState) => set({ connectionState }),
  setInterviewId: (interviewId) => set({ interviewId }),
  applyJoined: ({ interviewId, timerStartedAt, durationMinutes, answeredQuestionIds }) =>
    set({
      interviewId,
      timerStartedAt,
      durationMinutes,
      remainingSeconds: durationMinutes * 60,
      answeredQuestionIds,
      answeredCount: answeredQuestionIds.length,
    }),
  applyStateChange: (interviewStatus) => set({ interviewStatus }),
  applyQuestion: (currentQuestion, questionNumber, totalQuestions) =>
    set((state) => {
      // The server redelivers the *current* question on join (boot, resume and
      // reconnect all funnel through generateAndDeliverQuestionService). That
      // echo must not clear the busy state: mid-evaluation it is exactly what
      // re-enabled the submit button while the server was still scoring the
      // answer. Only a genuinely new question is the arrival the busy state
      // waits for.
      const isRedelivery = state.currentQuestion?.id === currentQuestion.id;
      if (isRedelivery) {
        // Keep the existing question object rather than swapping in the freshly
        // deserialised one. The payload says nothing new about the question, and
        // replacing the reference re-renders every subscriber for it — which can
        // restart an in-flight CSS transition (the question reveal, the answer
        // panel fading in) for a redelivery that changed nothing. Only the two
        // server-authoritative counters are worth writing, and when they already
        // match, returning the untouched state object means zustand notifies no
        // one at all.
        return state.questionNumber === questionNumber && state.totalQuestions === totalQuestions
          ? state
          : { questionNumber, totalQuestions };
      }
      return {
        currentQuestion,
        questionNumber,
        totalQuestions,
        lastEvaluation: null,
        aiStatus: "idle" as LiveAiStatus,
      };
    }),
  setAiStatus: (aiStatus) => set({ aiStatus }),
  applyEvaluation: (lastEvaluation) => set({ lastEvaluation }),
  markAnswered: (questionId: string) => set((state) => state.answeredQuestionIds.includes(questionId)
    ? state
    : { answeredQuestionIds: [...state.answeredQuestionIds, questionId], answeredCount: state.answeredCount + 1 }),
  setRemainingSeconds: (remainingSeconds) => set({ remainingSeconds }),
  appendTranscript: (entry) =>
    set((state) => ({ transcript: [...state.transcript, entry] })),
  setError: (error) => set({ error }),
  setMediaStream: (mediaStream) => set({ mediaStream }),
  clearMediaStream: () =>
    set((state) => {
      state.mediaStream?.getTracks().forEach((track) => track.stop());
      return { mediaStream: null };
    }),
  reset() {
    set((state) => {
      state.mediaStream?.getTracks().forEach((track) => track.stop());
      return initialState;
    });
  },
}));
