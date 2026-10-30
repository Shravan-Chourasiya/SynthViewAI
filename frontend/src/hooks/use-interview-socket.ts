import { useCallback, useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import {
  useLiveInterviewStore,
  remainingSecondsFor,
  type LiveConnectionState,
  type LiveQuestion,
} from '@/lib/stores/live-interview.store'
import { createInterviewSocket } from '@/lib/socket/interview-socket'
import { EVENT_VERSION, SOCKET_EVENTS } from '@/lib/constants/socket-events'
import type {
  AiStatusPayload,
  AnswerAcceptedPayload,
  EvaluationFeedbackPayload,
  HeartbeatPingPayload,
  JoinedPayload,
  LeftPayload,
  QuestionDeliveredPayload,
  StateChangePayload,
  TimerExpiredPayload,
  TimerExtendedPayload,
  WsErrorPayload,
} from '@/lib/types/ws'
import type { Evaluation } from '@/lib/stores/live-interview.store'
import type { LiveStatus, Question, SignalBand } from '@/lib/types'
import { authService } from '@/lib/services/auth'
import { useAuthStore } from '@/lib/stores/auth-store'

const WS_ERROR_MESSAGES: Record<WsErrorPayload['code'], string> = {
  AUTH_UNAUTHORIZED: 'Please sign in again to continue the interview.',
  AUTH_SESSION_EXPIRED: 'Your session expired. Reconnecting securely…',
  AUTH_FORBIDDEN: 'You do not have access to this interview.',
  INTERVIEW_NOT_FOUND: 'This interview could not be found.',
  INTERVIEW_INVALID_STATE: 'This action is not available in the interview’s current state.',
  QUESTION_NOT_FOUND: 'The requested interview question could not be found.',
  QUESTION_NOT_COMPLETED:
    'The current question must be answered or skipped before requesting the next one.',
  ANSWER_REJECTED: 'That answer could not be accepted. Please try the current question again.',
  CONTEXT_MISSING: 'The interview session is no longer available. Please return to the lobby.',
  INTERNAL_ERROR: 'The interview service encountered an unexpected error. Please try again.',
}

/** The report's own bands, reused so the live room and the report agree. */
function bandFor(score: number): SignalBand {
  return score >= 85 ? 'strong' : score >= 70 ? 'good' : score >= 55 ? 'vague' : 'weak'
}

/**
 * `question:delivered` is the only way a question reaches the room: the server
 * emits it after `interview:join` (boot, resume and reconnect all funnel
 * through the same delivery). `answerFormat` decides the answer surface — the
 * client never infers code from text.
 */
function questionFromPayload(payload: QuestionDeliveredPayload): LiveQuestion {
  return {
    id: payload.questionId,
    index: payload.sequenceNumber - 1,
    category:
      payload.questionType === 'BEHAVIORAL'
        ? 'Behavioral'
        : payload.questionType === 'TECHNICAL'
          ? 'Technical'
          : 'Mixed',
    topic: payload.topic ?? payload.questionType,
    text: payload.questionTitle,
    isFollowUp: payload.isFollowUp ?? false,
    difficulty: 'medium',
    kind: payload.answerFormat === 'CODE' ? 'code' : 'text',
    answerFormat: payload.answerFormat,
    ...(payload.questionDescription ? { starter: payload.questionDescription } : {}),
    ...(payload.codeLanguage ? { codeLanguage: payload.codeLanguage } : {}),
  }
}

/** Store shape → the view model the room's panels are typed against. */
function toUiQuestion(question: LiveQuestion, interviewId: string | null): Question {
  return {
    id: question.id,
    interviewId: interviewId ?? '',
    index: question.index,
    kind: question.kind === 'code' ? 'code' : (question.category.toLowerCase() as Question['kind']),
    prompt: question.text,
    topic: question.topic,
    difficulty: 'medium',
    answer: null,
    score: null,
    band: null,
    headline: null,
    feedback: null,
    strengths: [],
    improvements: [],
    decision: null,
    durationSeconds: 0,
    answerFormat: question.answerFormat ?? null,
    codeLanguage: question.codeLanguage ?? null,
    starter: question.starter ?? null,
  }
}

function evaluationFromPayload(payload: EvaluationFeedbackPayload): Evaluation {
  return {
    score: payload.score,
    signal: bandFor(payload.score),
    feedback: payload.feedback,
    strengths: payload.strengths ?? [],
    weaknesses: payload.weaknesses ?? [],
  }
}

type SocketHookResult = {
  /** Full transport state (includes `connecting`, `error` and `idle`). */
  connectionState: LiveConnectionState
  /** Chip-ready subset used by the room header. */
  connection: 'connected' | 'reconnecting' | 'offline'
  status: LiveStatus
  streamed: string
  evaluation: { score: number; band: SignalBand; headline: string; decision: string } | null
  activeQuestion: Question | null
  totalQuestions: number | null
  /** Server says the session is over — safe to leave the room. */
  complete: boolean
  submitAnswer: (
    questionId: string,
    answerData: string,
    answerType?: 'TEXT' | 'AUDIO' | 'VIDEO',
  ) => void
  /** Code answers travel on their own event so language and code stay separate. */
  submitCode: (questionId: string, language: string, code: string) => void
  requestNextQuestion: () => void
  cancelInterview: () => void
  endInterview: () => void
  /** Ask the server to move the duration ceiling forward ("add more time"). */
  extendTime: (extraMinutes: number) => void
}

export function useInterviewSocket(
  interviewId: string | null | undefined,
  enabled = true,
): SocketHookResult {
  const socketRef = useRef<Socket | null>(null)
  const joinedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const intentionalCloseRef = useRef(false)
  const reconnectingAuthRef = useRef(false)
  const advancedEvaluationRef = useRef(new Set<string>())
  const store = useLiveInterviewStore
  const connectionState = useLiveInterviewStore((state) => state.connectionState)
  const aiStatus = useLiveInterviewStore((state) => state.aiStatus)
  const currentQuestion = useLiveInterviewStore((state) => state.currentQuestion)
  const interviewStatus = useLiveInterviewStore((state) => state.interviewStatus)
  const lastEvaluation = useLiveInterviewStore((state) => state.lastEvaluation)
  const totalQuestions = useLiveInterviewStore((state) => state.totalQuestions)

  const requestNextQuestion = useCallback(() => {
    if (!interviewId) return
    // Duration spent: the room is paused and asking for another question here
    // is exactly what used to hand the candidate a fresh question past 00:00.
    if (store.getState().timeExpired) return
    socketRef.current?.emit(SOCKET_EVENTS.client.nextQuestion, {
      interviewId,
      eventVersion: EVENT_VERSION,
      event: SOCKET_EVENTS.client.nextQuestion,
    })
  }, [interviewId, store])

  const cleanup = useCallback(() => {
    const socket = socketRef.current
    intentionalCloseRef.current = true
    if (socket && socket.connected && interviewId) {
      socket.emit(SOCKET_EVENTS.client.leave, {
        eventVersion: EVENT_VERSION,
        event: SOCKET_EVENTS.client.leave,
        interviewId,
      })
    }
    socket?.disconnect()
    socket?.removeAllListeners()
    socket?.io.removeAllListeners()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    socketRef.current = null
    joinedRef.current = false
    store.getState().reset()
  }, [interviewId, store])

  useEffect(() => {
    if (!enabled || !interviewId || socketRef.current) return
    intentionalCloseRef.current = false
    const socket = createInterviewSocket()
    socketRef.current = socket
    const setState = (state: LiveConnectionState) => store.getState().setConnectionState(state)

    const join = () => {
      if (joinedRef.current) return
      joinedRef.current = true
      socket.emit(SOCKET_EVENTS.client.join, {
        eventVersion: EVENT_VERSION,
        event: SOCKET_EVENTS.client.join,
        interviewId,
      })
    }

    const recoverAuth = async () => {
      if (reconnectingAuthRef.current) return
      reconnectingAuthRef.current = true
      socket.io.opts.reconnection = false
      setState('error')
      store.getState().setError('Your session expired. Reconnecting securely…')
      try {
        await authService.refresh()
        await useAuthStore.getState().bootstrap()
        socket.io.opts.reconnection = true
        socket.connect()
      } catch {
        await useAuthStore.getState().logout()
      } finally {
        reconnectingAuthRef.current = false
      }
    }

    socket.on('connect', () => {
      setState('connected')
      // Fires again after every reconnect: the backend treats a returning user
      // as a reconnect, clears its grace period and re-delivers the current
      // question, so a fresh join *is* the recovery path.
      join()
    })
    socket.on('disconnect', () => {
      // Allow the next "connect" to re-join; otherwise the room goes silent and
      // question:delivered never arrives again.
      joinedRef.current = false
      if (!intentionalCloseRef.current) {
        setState('disconnected')
        // Hold the room busy across the transport gap: the server redelivers
        // the current question on rejoin, and that echo must not look like a
        // fresh, answerable question while an evaluation is still in flight.
        if (store.getState().aiStatus !== 'idle') store.getState().setAiStatus('generating')
      }
    })
    socket.io.on('reconnect_attempt', () => setState('reconnecting'))
    socket.io.on('reconnect', () => setState('connected'))
    socket.io.on('reconnect_failed', () => setState('error'))

    socket.on('connect_error', async (error) => {
      const message = error?.message ?? ''
      if (message.startsWith('AUTH_')) {
        await recoverAuth()
      } else {
        setState('error')
        store.getState().setError('Unable to connect to the interview session.')
      }
    })

    // One tick implementation for the whole session: it reads the ceiling from
    // the store each tick, so an accepted extension takes effect without
    // rebuilding the interval, and stops itself at 00:00.
    const startTimer = (timerStartedAt: string, durationMinutes: number) => {
      if (timerRef.current) clearInterval(timerRef.current)
      const tick = () => {
        const state = store.getState()
        const remaining = remainingSecondsFor(
          state.timerStartedAt ?? timerStartedAt,
          state.durationMinutes ?? durationMinutes,
        )
        state.setRemainingSeconds(remaining)
        if (remaining > 0) return
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        if (!store.getState().timeExpired) store.getState().setTimeExpired(true)
      }
      tick()
      timerRef.current = setInterval(tick, 1000)
    }

    socket.on(SOCKET_EVENTS.server.joined, (payload: JoinedPayload) => {
      store.getState().applyJoined(payload)
      startTimer(payload.timerStartedAt, payload.durationMinutes)
    })

    socket.on(SOCKET_EVENTS.server.left, (_payload: LeftPayload) => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      store.getState().reset()
    })

    socket.on(SOCKET_EVENTS.server.answerAccepted, (payload: AnswerAcceptedPayload) =>
      store.getState().markAnswered(payload.questionId),
    )

    socket.on(SOCKET_EVENTS.server.stateChange, (payload: StateChangePayload) =>
      store.getState().applyStateChange(payload.status),
    )

    socket.on(SOCKET_EVENTS.server.questionDelivered, (payload: QuestionDeliveredPayload) =>
      store
        .getState()
        .applyQuestion(
          questionFromPayload(payload),
          payload.sequenceNumber,
          payload.totalQuestions,
        ),
    )

    socket.on(SOCKET_EVENTS.server.aiStatus, (payload: AiStatusPayload) =>
      store.getState().setAiStatus(payload.stage),
    )

    socket.on(
      SOCKET_EVENTS.server.evaluationFeedback,
      (payload: EvaluationFeedbackPayload) => {
        const duplicate = advancedEvaluationRef.current.has(payload.questionId)
        if (duplicate) return
        advancedEvaluationRef.current.add(payload.questionId)
        store.getState().applyEvaluation(evaluationFromPayload(payload))
        // Evaluation feedback is the canonical advancement signal, keyed by
        // question id so a duplicate delivery is harmless.
        if (payload.shouldAdvance !== false && store.getState().timeExpired) {
          // Paused: the answer is scored and stored, but the room does not move.
          store.getState().setPendingAdvance(true)
          store.getState().setAiStatus('idle')
        } else if (payload.shouldAdvance !== false) {
          // Stay busy until question:delivered arrives — dropping to idle here
          // re-enabled submit while the server was still generating.
          store.getState().setAiStatus('generating')
          requestNextQuestion()
        } else {
          // No next question will arrive to clear the busy state, so clear it.
          store.getState().setAiStatus('idle')
        }
      },
    )

    socket.on(SOCKET_EVENTS.server.timerExtended, (payload: TimerExtendedPayload) => {
      const owedAdvance = store.getState().pendingAdvance
      store.getState().applyTimerExtended(payload)
      startTimer(payload.timerStartedAt, payload.durationMinutes)
      // The timer ran out while the last answer was being scored; the extension
      // pays that owed advance instead of re-opening an evaluated question.
      if (owedAdvance && !store.getState().timeExpired) {
        store.getState().setPendingAdvance(false)
        store.getState().setAiStatus('generating')
        requestNextQuestion()
      }
    })

    socket.on(SOCKET_EVENTS.server.timerExpired, (_payload: TimerExpiredPayload) => {
      // Server-side confirmation of the deadline — same pause as the local tick.
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      store.getState().setRemainingSeconds(0)
      store.getState().setTimeExpired(true)
    })

    // Application-level liveness: the gateway pings, the client must ack.
    socket.on(SOCKET_EVENTS.server.heartbeatPing, (payload: HeartbeatPingPayload) =>
      socket.emit(SOCKET_EVENTS.client.heartbeatAck, {
        eventVersion: EVENT_VERSION,
        event: SOCKET_EVENTS.client.heartbeatAck,
        timestamp: payload.timestamp,
      }),
    )

    socket.on(SOCKET_EVENTS.server.error, (payload: WsErrorPayload) => {
      store.getState().setError(WS_ERROR_MESSAGES[payload.code] ?? payload.message)
      // A rejected answer or a failed question:next arrives as an error, and
      // nothing else would clear the busy state — without this the submit
      // button would stay disabled for the rest of the session.
      store.getState().setAiStatus('idle')
      if (payload.code === 'AUTH_UNAUTHORIZED' || payload.code === 'AUTH_SESSION_EXPIRED') {
        socket.disconnect()
        void recoverAuth()
      }
    })

    const onBeforeUnload = () => {
      if (socket.connected)
        socket.emit(SOCKET_EVENTS.client.leave, {
          eventVersion: EVENT_VERSION,
          event: SOCKET_EVENTS.client.leave,
          interviewId,
        })
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    setState('connecting')
    socket.connect()

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      cleanup()
    }
  }, [cleanup, enabled, interviewId, requestNextQuestion, store])

  const emit = useCallback((event: string, payload: Record<string, unknown>) => {
    socketRef.current?.emit(event, {
      ...payload,
      eventVersion: EVENT_VERSION,
      event,
    })
  }, [])

  const submitAnswer = useCallback(
    (questionId: string, answerData: string, answerType: 'TEXT' | 'AUDIO' | 'VIDEO' = 'TEXT') => {
      if (!interviewId) return
      // Transport-level guard for the paused state: the room disables the
      // button too, but a submit must never slip through from a stale handler.
      if (store.getState().timeExpired) return
      store.getState().appendTranscript(answerData)
      store.getState().setAiStatus('evaluating')
      emit(SOCKET_EVENTS.client.answerSubmit, { interviewId, questionId, answerData, answerType })
    },
    [emit, interviewId, store],
  )

  const submitCode = useCallback(
    (questionId: string, language: string, code: string) => {
      if (!interviewId) return
      if (store.getState().timeExpired) return
      store.getState().appendTranscript(code)
      store.getState().setAiStatus('evaluating')
      emit(SOCKET_EVENTS.client.codeSubmit, { interviewId, questionId, language, code })
    },
    [emit, interviewId, store],
  )

  const cancelInterview = useCallback(() => {
    if (interviewId) emit(SOCKET_EVENTS.client.cancel, { interviewId })
  }, [emit, interviewId])

  const endInterview = useCallback(() => {
    if (interviewId) emit(SOCKET_EVENTS.client.end, { interviewId })
  }, [emit, interviewId])

  const extendTime = useCallback(
    (extraMinutes: number) => {
      if (!interviewId) return
      emit(SOCKET_EVENTS.client.extendTime, { interviewId, extraMinutes })
    },
    [emit, interviewId],
  )

  const status: LiveStatus =
    aiStatus === 'evaluating'
      ? 'evaluating'
      : aiStatus === 'generating' || aiStatus === 'thinking'
        ? 'generating'
        : currentQuestion
          ? 'listening'
          : 'idle'

  const connection: 'connected' | 'reconnecting' | 'offline' =
    connectionState === 'connected'
      ? 'connected'
      : connectionState === 'reconnecting' || connectionState === 'connecting'
        ? 'reconnecting'
        : 'offline'

  const evaluation = lastEvaluation
    ? {
        score: lastEvaluation.score,
        band: lastEvaluation.signal,
        headline: lastEvaluation.feedback.split('.')[0] ?? '',
        decision: '',
      }
    : null

  return {
    connectionState,
    connection,
    status,
    streamed: '',
    evaluation,
    activeQuestion: currentQuestion ? toUiQuestion(currentQuestion, interviewId ?? null) : null,
    totalQuestions,
    // Only a terminal status ends the room. A spent duration pauses it — the
    // candidate chooses extend or end, so expiry alone must not navigate away.
    complete: interviewStatus === 'COMPLETED' || interviewStatus === 'TIMED_OUT',
    submitAnswer,
    submitCode,
    requestNextQuestion,
    cancelInterview,
    endInterview,
    extendTime,
  }
}
