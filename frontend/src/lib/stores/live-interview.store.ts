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
  /**
   * True from the moment the configured duration runs out. The room pauses on
   * this: no fetch, no generation, no question advance, and no submit — the
   * candidate is asked whether to extend or end. Cleared only by an accepted
   * extension (or by a session reset).
   */
  timeExpired: boolean;
  /**
   * A scored answer was waiting to advance when the duration ran out. The pause
   * swallowed that advance on purpose; this records that it is still owed, so an
   * accepted extension fetches the next question instead of re-opening a
   * question the server has already evaluated.
   */
  pendingAdvance: boolean;
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
  setTimeExpired: (timeExpired: boolean) => void;
  setPendingAdvance: (pendingAdvance: boolean) => void;
  /** Applies an accepted "add more time" from the server. */
  applyTimerExtended: (payload: {
    timerStartedAt: string;
    durationMinutes: number;
    totalQuestions: number | null;
  }) => void;
  appendTranscript: (entry: string) => void;
  setError: (error: string | null) => void;
  setMediaStream: (mediaStream: MediaStream | null) => void;
  clearMediaStream: () => void;
  reset: () => void;
};

// The countdown is always derived from the server-authoritative start time, never
// accumulated locally — a local tick that drifts or pauses with the tab would
// show time that the session does not have. Returns 0 once the ceiling is passed.
export function remainingSecondsFor(timerStartedAt: string, durationMinutes: number): number {
  const startedMs = Date.parse(timerStartedAt);
  if (!Number.isFinite(startedMs)) return durationMinutes * 60;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  return Math.max(0, durationMinutes * 60 - elapsedSeconds);
}

const initialState = {
  interviewId: null,
  connectionState: "idle" as LiveConnectionState,
  interviewStatus: null,
  timerStartedAt: null,
  durationMinutes: null,
  remainingSeconds: 0,
  timeExpired: false,
  pendingAdvance: false,
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
      // A join can be a resume of a session that is already part-way through, so
      // the first painted timer must be the real remaining time — the 1 s tick
      // would otherwise show a full duration for a moment on every reconnect.
      remainingSeconds: remainingSecondsFor(timerStartedAt, durationMinutes),
      timeExpired: false,
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
  setTimeExpired: (timeExpired) => set({ timeExpired }),
  setPendingAdvance: (pendingAdvance) => set({ pendingAdvance }),
  applyTimerExtended: ({ timerStartedAt, durationMinutes, totalQuestions }) =>
    set((state) => ({
      timerStartedAt,
      durationMinutes,
      remainingSeconds: remainingSecondsFor(timerStartedAt, durationMinutes),
      // The extension is the only thing that un-pauses the room, and the new
      // total may have grown (see extendInterviewTimeService) so the "Qn of
      // total" label stays true for the questions the new window affords.
      timeExpired: false,
      pendingAdvance: false,
      ...(totalQuestions !== null ? { totalQuestions } : {}),
      // Nothing is being generated while paused, so there is no in-flight work
      // for the busy state to describe once the candidate is cleared to answer.
      aiStatus:
        state.interviewStatus === "INPROGRESS" || state.interviewStatus === null
          ? ("idle" as LiveAiStatus)
          : state.aiStatus,
    })),
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
