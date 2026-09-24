import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { useAuthStore } from "@/lib/stores/auth.store";
import {
  useLiveInterviewStore,
  type LiveConnectionState,
} from "@/lib/stores/live-interview.store";
import { createInterviewSocket } from "@/lib/socket/interview-socket";
import { EVENT_VERSION, SOCKET_EVENTS } from "@/lib/constants/socket-events";
import type {
  AiStatusPayload,
  EvaluationFeedbackPayload,
  AnswerAcceptedPayload,
  JoinedPayload,
  LeftPayload,
  QuestionDeliveredPayload,
  StateChangePayload,
  TimerExpiredPayload,
  WsErrorPayload,
} from "@/lib/types/ws";
import type { Evaluation, Question } from "@/lib/types";
import * as authService from "@/lib/services/auth.service";

type SocketHookResult = {
  connectionState: LiveConnectionState;
  submitAnswer: (
    questionId: string,
    answerData: string,
    answerType?: "TEXT" | "AUDIO" | "VIDEO",
  ) => void;
  requestNextQuestion: () => void;
  cancelInterview: () => void;
  endInterview: () => void;
};

const WS_ERROR_MESSAGES: Record<WsErrorPayload["code"], string> = {
  AUTH_UNAUTHORIZED: "Please sign in again to continue the interview.",
  AUTH_SESSION_EXPIRED: "Your session expired. Reconnecting securely…",
  AUTH_FORBIDDEN: "You do not have access to this interview.",
  INTERVIEW_NOT_FOUND: "This interview could not be found.",
  INTERVIEW_INVALID_STATE: "This action is not available in the interview’s current state.",
  QUESTION_NOT_FOUND: "The requested interview question could not be found.",
  ANSWER_REJECTED: "That answer could not be accepted. Please try the current question again.",
  CONTEXT_MISSING: "The interview session is no longer available. Please return to the lobby.",
  INTERNAL_ERROR: "The interview service encountered an unexpected error. Please try again.",
};

function questionFromPayload(payload: QuestionDeliveredPayload): Question {
  return {
    id: payload.questionId,
    index: payload.sequenceNumber - 1,
    kind:
      payload.questionType === "MIXED"
        ? "text"
        : payload.questionType === "TECHNICAL"
          ? "text"
          : "text",
    category:
      payload.questionType === "BEHAVIORAL"
        ? "Behavioral"
        : payload.questionType === "TECHNICAL"
          ? "Technical"
          : "Mixed",
    topic: payload.questionType,
    difficulty: "Medium",
    text: payload.questionTitle,
    ...(payload.questionDescription
      ? { starter: payload.questionDescription }
      : {}),
  };
}

function evaluationFromPayload(payload: EvaluationFeedbackPayload): Evaluation {
  const signal =
    payload.score >= 80
      ? "strong"
      : payload.score >= 60
        ? "good"
        : payload.score >= 40
          ? "vague"
          : "weak";
  return {
    score: payload.score,
    signal,
    feedback: payload.feedback,
    strengths: payload.strengths,
    weaknesses: payload.weaknesses,
  };
}

export function useInterviewSocket(
  interviewId: string | undefined,
): SocketHookResult {
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalCloseRef = useRef(false);
  const reconnectingAuthRef = useRef(false);
  const advancedEvaluationRef = useRef(new Set<string>());
  const store = useLiveInterviewStore;
  const connectionState = useLiveInterviewStore(
    (state) => state.connectionState,
  );

  // Keep one advancement helper for every path, including server evaluation
  // feedback. This makes the canonical next-question transition easy to audit
  // and keeps the websocket payload consistent.
  const requestNextQuestion = useCallback(() => {
    if (!interviewId) return;
    socketRef.current?.emit(SOCKET_EVENTS.client.nextQuestion, {
      interviewId,
      eventVersion: EVENT_VERSION,
      event: SOCKET_EVENTS.client.nextQuestion,
    });
  }, [interviewId]);

  const cleanup = useCallback(() => {
    const socket = socketRef.current;
    intentionalCloseRef.current = true;
    if (socket && socket.connected && interviewId) {
      socket.emit(SOCKET_EVENTS.client.leave, {
        eventVersion: EVENT_VERSION,
        event: SOCKET_EVENTS.client.leave,
        interviewId,
      });
    }
    socket?.disconnect();
    socket?.removeAllListeners();
    socket?.io.removeAllListeners();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    socketRef.current = null;
    joinedRef.current = false;
    store.getState().reset();
  }, [interviewId]);

  useEffect(() => {
    if (!interviewId || socketRef.current) return;
    intentionalCloseRef.current = false;
    const socket = createInterviewSocket();
    socketRef.current = socket;
    const setState = (state: LiveConnectionState) =>
      store.getState().setConnectionState(state);

    const join = () => {
      if (joinedRef.current) return;
      joinedRef.current = true;
      socket.emit(SOCKET_EVENTS.client.join, {
        eventVersion: EVENT_VERSION,
        event: SOCKET_EVENTS.client.join,
        interviewId,
      });
    };

    socket.on("connect", () => {
      setState("connected");
      join();
    });
    socket.on("disconnect", () => {
      if (!intentionalCloseRef.current) setState("disconnected");
    });
    socket.io.on("reconnect_attempt", () => setState("reconnecting"));
    socket.io.on("reconnect", () => setState("connected"));
    socket.io.on("reconnect_failed", () => setState("error"));
    const recoverAuth = async () => {
      if (reconnectingAuthRef.current) return;
      reconnectingAuthRef.current = true;
      socket.io.opts.reconnection = false;
      setState("error");
      store.getState().setError("Your session expired. Reconnecting securely…");
      try {
        await authService.refresh();
        await useAuthStore.getState().bootstrap();
        socket.io.opts.reconnection = true;
        socket.connect();
      } catch {
        await useAuthStore.getState().logout();
      } finally {
        reconnectingAuthRef.current = false;
      }
    };

    socket.on("connect_error", async (error) => {
      const message = error.message ?? "";
      if (message.startsWith("AUTH_")) {
        await recoverAuth();
      } else {
        setState("error");
        store
          .getState()
          .setError("Unable to connect to the interview session.");
      }
    });

    socket.on(SOCKET_EVENTS.server.joined, (payload: JoinedPayload) => {
      store.getState().applyJoined(payload);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const elapsed = Math.max(
          0,
          Math.floor((Date.now() - Date.parse(payload.timerStartedAt)) / 1000),
        );
        store
          .getState()
          .setRemainingSeconds(
            Math.max(0, payload.durationMinutes * 60 - elapsed),
          );
      }, 1000);
    });
    socket.on(SOCKET_EVENTS.server.left, (_payload: LeftPayload) => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      store.getState().reset();
    });
    socket.on(SOCKET_EVENTS.server.answerAccepted, (payload: AnswerAcceptedPayload) =>
      store.getState().markAnswered(payload.questionId),
    );
    socket.on(SOCKET_EVENTS.server.stateChange, (payload: StateChangePayload) =>
      store.getState().applyStateChange(payload.status),
    );
    socket.on(
      SOCKET_EVENTS.server.questionDelivered,
      (payload: QuestionDeliveredPayload) =>
        store
          .getState()
          .applyQuestion(
            questionFromPayload(payload),
            payload.sequenceNumber,
            payload.totalQuestions,
          ),
    );
    socket.on(SOCKET_EVENTS.server.aiStatus, (payload: AiStatusPayload) =>
      store.getState().setAiStatus(payload.stage),
    );
    socket.on(
      SOCKET_EVENTS.server.evaluationFeedback,
      (payload: EvaluationFeedbackPayload) => {
        const duplicate = advancedEvaluationRef.current.has(payload.questionId);
        if (duplicate) return;
        advancedEvaluationRef.current.add(payload.questionId);
        store.getState().applyEvaluation(evaluationFromPayload(payload));
        // Evaluation feedback is the canonical advancement signal. Keying by
        // question id makes duplicate websocket deliveries harmless.
        if (payload.shouldAdvance !== false) {
          // Stay busy ("generating") until question:delivered arrives, which is
          // what clears this status. Dropping to "idle" here re-enabled the
          // submit button and hid the spinner while the server was still
          // generating the next question — the client asked for it a moment ago
          // and the answer only lands a couple of seconds later, so the room
          // briefly looked ready and then the question swapped underneath the
          // candidate.
          store.getState().setAiStatus("generating");
          requestNextQuestion();
        } else {
          // The backend has already decided there is no next question; nothing
          // will be delivered to clear the busy state, so clear it here.
          store.getState().setAiStatus("idle");
        }
      },
    );
    socket.on(
      SOCKET_EVENTS.server.timerExpired,
      (_payload: TimerExpiredPayload) =>
        store.getState().setRemainingSeconds(0),
    );
    socket.on(SOCKET_EVENTS.server.heartbeatPing, () =>
      socket.emit(SOCKET_EVENTS.client.heartbeatAck, {
        eventVersion: EVENT_VERSION,
        event: SOCKET_EVENTS.client.heartbeatAck,
      }),
    );
    socket.on(SOCKET_EVENTS.server.error, (payload: WsErrorPayload) => {
      store.getState().setError(WS_ERROR_MESSAGES[payload.code]);
      // A rejected answer or a failed question:next arrives as an error, and
      // nothing else would clear the busy state — without this the submit button
      // would stay disabled forever and the candidate could not retry.
      store.getState().setAiStatus("idle");
      if (
        payload.code === "AUTH_UNAUTHORIZED" ||
        payload.code === "AUTH_SESSION_EXPIRED"
      ) {
        socket.disconnect();
        void recoverAuth();
      }
    });

    const onBeforeUnload = () => {
      if (socket.connected)
        socket.emit(SOCKET_EVENTS.client.leave, {
          eventVersion: EVENT_VERSION,
          event: SOCKET_EVENTS.client.leave,
          interviewId,
        });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    setState("connecting");
    socket.connect();

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      cleanup();
    };
  }, [cleanup, interviewId, requestNextQuestion, store]);

  const emit = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      socketRef.current?.emit(event, {
        ...payload,
        eventVersion: EVENT_VERSION,
        event,
      });
    },
    [],
  );

  const submitAnswer = useCallback(
    (
      questionId: string,
      answerData: string,
      answerType: "TEXT" | "AUDIO" | "VIDEO" = "TEXT",
    ) => {
      if (!interviewId) return;
      store.getState().appendTranscript(answerData);
      store.getState().setAiStatus("evaluating");
      emit(SOCKET_EVENTS.client.answerSubmit, {
        interviewId,
        questionId,
        answerData,
        answerType,
      });
    },
    [emit, interviewId, store],
  );

  // code:submit is deliberately not exposed here: the backend folds coding
  // submissions into TEXT answers (codebox is out of scope) and no UI offers a
  // coding round. Re-add this only when code execution actually ships.

  const cancelInterview = useCallback(() => {
    if (interviewId) emit(SOCKET_EVENTS.client.cancel, { interviewId });
  }, [emit, interviewId]);

  const endInterview = useCallback(() => {
    if (interviewId) emit(SOCKET_EVENTS.client.end, { interviewId });
  }, [emit, interviewId]);

  return {
    connectionState,
    submitAnswer,
    requestNextQuestion,
    cancelInterview,
    endInterview,
  };
}
