import { create } from "zustand";
import type { BackendInterviewStatus } from "../api-types";

export type LiveConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";
export type LiveAiStatus = "idle" | "thinking" | "generating" | "evaluating";

/**
 * A question as the gateway delivers it (`question:delivered`), before it is
 * adapted to the room's view model. `kind` is derived from `answerFormat` —
 * the backend's single source of truth for prose vs. code answers.
 */
export type LiveQuestion = {
  id: string;
  index: number;
  /** Display category ("Behavioral" | "Technical" | "Mixed"). */
  category: string;
  topic: string;
  text: string;
  isFollowUp: boolean;
  difficulty: string;
  kind: "text" | "code";
  answerFormat: "TEXT" | "CODE";
  /** Clarifying note seeded into the editor as its placeholder. */
  starter?: string;
  codeLanguage?: string;
};

export type Evaluation = {
  score: number;
  signal: "strong" | "good" | "vague" | "weak";
  feedback: string;
  strengths: string[];
  weaknesses: string[];
};

export type LiveInterviewState = {
  interviewId: string | null;
  connectionState: LiveConnectionState;
  interviewStatus: BackendInterviewStatus | null;
  /** Alias of `interviewStatus` kept for older call sites and tests. */
  status: BackendInterviewStatus | null;
  timerStartedAt: string | null;
  durationMinutes: number | null;
  remainingSeconds: number;
  /**
   * True from the moment the configured duration runs out. The room pauses on
   * this: no submit, no question advance — the candidate decides whether to
   * extend or to end. Cleared only by an accepted extension (or a reset).
   */
  timeExpired: boolean;
  /**
   * A scored answer was waiting to advance when the duration ran out. Recorded
   * rather than dropped, so an accepted extension pays the owed advance instead
   * of re-opening a question the server has already evaluated.
   */
  pendingAdvance: boolean;
  currentQuestion: LiveQuestion | null;
  questionNumber: number;
  totalQuestions: number | null;
  aiStatus: LiveAiStatus;
  lastEvaluation: Evaluation | null;
  answeredCount: number;
  answeredQuestionIds: string[];
  /** Alias of `answeredQuestionIds` kept for older call sites and tests. */
  answeredQuestions: string[];
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
    answeredQuestionIds?: string[];
    status?: BackendInterviewStatus;
  }) => void;
  applyStateChange: (status: BackendInterviewStatus) => void;
  applyQuestion: (
    question: LiveQuestion,
    questionNumber: number,
    totalQuestions: number | null,
  ) => void;
  setAiStatus: (aiStatus: LiveAiStatus) => void;
  applyEvaluation: (evaluation: Evaluation) => void;
  markAnswered: (questionId: string) => void;
  setRemainingSeconds: (remainingSeconds: number) => void;
  setTimeExpired: (timeExpired: boolean) => void;
  setPendingAdvance: (pendingAdvance: boolean) => void;
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

// The countdown is always derived from the server-authoritative start time,
// never accumulated locally — a local tick that drifts or pauses with the tab
// would show time the session does not have. Returns 0 past the ceiling.
export function remainingSecondsFor(
  timerStartedAt: string,
  durationMinutes: number,
): number {
  const startedMs = Date.parse(timerStartedAt);
  if (!Number.isFinite(startedMs)) return durationMinutes * 60;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  return Math.max(0, durationMinutes * 60 - elapsedSeconds);
}

const initialState = {
  interviewId: null as string | null,
  connectionState: "idle" as LiveConnectionState,
  interviewStatus: null as BackendInterviewStatus | null,
  status: null as BackendInterviewStatus | null,
  timerStartedAt: null as string | null,
  durationMinutes: null as number | null,
  remainingSeconds: 0,
  timeExpired: false,
  pendingAdvance: false,
  currentQuestion: null as LiveQuestion | null,
  questionNumber: 0,
  totalQuestions: null as number | null,
  aiStatus: "idle" as LiveAiStatus,
  lastEvaluation: null as Evaluation | null,
  answeredCount: 0,
  answeredQuestionIds: [] as string[],
  answeredQuestions: [] as string[],
  transcript: [] as string[],
  error: null as string | null,
  mediaStream: null as MediaStream | null,
};

export const useLiveInterviewStore = create<LiveInterviewState>((set) => ({
  ...initialState,
  setConnectionState: (connectionState) => set({ connectionState }),
  setInterviewId: (interviewId) => set({ interviewId }),
  applyJoined: ({ interviewId, timerStartedAt, durationMinutes, answeredQuestionIds, status }) =>
    set({
      interviewId,
      timerStartedAt,
      durationMinutes,
      // A join can resume a session already part-way through, so the first
      // painted timer must be the real remaining time.
      remainingSeconds: remainingSecondsFor(timerStartedAt, durationMinutes),
      timeExpired: false,
      answeredQuestionIds: answeredQuestionIds ?? [],
      answeredQuestions: answeredQuestionIds ?? [],
      answeredCount: (answeredQuestionIds ?? []).length,
      ...(status ? { interviewStatus: status, status } : {}),
    }),
  applyStateChange: (nextStatus) => set({ interviewStatus: nextStatus, status: nextStatus }),
  applyQuestion: (currentQuestion, questionNumber, totalQuestions) =>
    set((state) => {
      // The server redelivers the *current* question on join (boot, resume and
      // reconnect all funnel through one delivery path). That echo must not
      // clear the busy state: mid-evaluation it is exactly what used to
      // re-enable submit while the server was still scoring. Only a genuinely
      // new question clears it.
      const isRedelivery = state.currentQuestion?.id === currentQuestion.id;
      if (isRedelivery) {
        // Keep the existing object so a redelivery that changed nothing
        // re-renders nobody.
        return state.questionNumber === questionNumber &&
          state.totalQuestions === totalQuestions
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
  markAnswered: (questionId: string) =>
    set((state) =>
      state.answeredQuestionIds.includes(questionId)
        ? state
        : {
            answeredQuestionIds: [...state.answeredQuestionIds, questionId],
            answeredQuestions: [...state.answeredQuestions, questionId],
            answeredCount: state.answeredCount + 1,
          },
    ),
  setRemainingSeconds: (remainingSeconds) => set({ remainingSeconds }),
  setTimeExpired: (timeExpired) => set({ timeExpired }),
  setPendingAdvance: (pendingAdvance) => set({ pendingAdvance }),
  applyTimerExtended: ({ timerStartedAt, durationMinutes, totalQuestions }) =>
    set((state) => ({
      timerStartedAt,
      durationMinutes,
      remainingSeconds: remainingSecondsFor(timerStartedAt, durationMinutes),
      timeExpired: false,
      pendingAdvance: false,
      ...(totalQuestions !== null ? { totalQuestions } : {}),
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
      return { ...initialState };
    });
  },
}));
