import type {
  IoServer,
  IoSocket,
  WsError,
  WsErrorCode,
  InterviewJoinedPayload,
  InterviewLeftPayload,
  InterviewStateChangePayload,
} from "./socket.types.js";
import { EVENT_VERSION } from "./socket.types.js";
import {
  setSocketSession,
  getSocketSession,
  deleteSocketSession,
  setGracePeriod,
  clearGracePeriod,
  isInGracePeriod,
  GRACE_TTL_SECONDS,
} from "./socket.registry.js";
import {
  fetchInterviewById,
  submitAnswerService,
  cancelInterviewService,
  endInterviewService,
  getAnsweredQuestionIdsService,
  generateAndDeliverQuestionService,
  requestNextQuestionService,
  pauseInterviewService,
} from "../modules/interview/services/interview.service.js";
import { readInterviewContext } from "../modules/interview/services/interview.context.service.js";
import { logger } from "../utils/logger.js";

const INTERVIEW_ROOM = (id: string) => `interview:${id}`;

// ── Error helper ──────────────────────────────────────────────────────────────

function wsError(code: WsErrorCode, message: string, interviewId?: string): WsError {
  return {
    eventVersion: EVENT_VERSION,
    event: "ws:error",
    code,
    message,
    timestamp: new Date().toISOString(),
    ...(interviewId ? { interviewId } : {}),
  };
}

// ── Safe error-code extraction ────────────────────────────────────────────────
// assertInterviewAccess throws Error with a WsErrorCode as the message.
// Any other thrown value (e.g. AppError from the DB layer) must not leak
// its internal message to the client — map it to INTERNAL_ERROR instead.

const KNOWN_WS_ERROR_CODES = new Set<string>([
  "AUTH_UNAUTHORIZED",
  "AUTH_SESSION_EXPIRED",
  "AUTH_FORBIDDEN",
  "INTERVIEW_NOT_FOUND",
  "INTERVIEW_INVALID_STATE",
  "QUESTION_NOT_FOUND",
  "ANSWER_REJECTED",
  "CONTEXT_MISSING",
  "INTERNAL_ERROR",
]);

function toWsErrorCode(err: unknown): WsErrorCode {
  if (err instanceof Error && KNOWN_WS_ERROR_CODES.has(err.message)) {
    return err.message as WsErrorCode;
  }
  return "INTERNAL_ERROR";
}

// ── Ownership + state guard ───────────────────────────────────────────────────

async function assertInterviewAccess(socket: IoSocket, interviewId: string): Promise<void> {
  const interview = await fetchInterviewById(interviewId);

  if (!interview) throw new Error("INTERVIEW_NOT_FOUND");
  if (interview.userId !== socket.data.userId) throw new Error("AUTH_FORBIDDEN");
  if (interview.interviewStatus !== "INPROGRESS") throw new Error("INTERVIEW_INVALID_STATE");
}

// ── Ownership-only guard (no state check) ─────────────────────────────────────
// Used for operations that are valid regardless of interview status (e.g. leave).

async function assertInterviewOwnership(socket: IoSocket, interviewId: string): Promise<void> {
  const interview = await fetchInterviewById(interviewId);
  if (!interview) throw new Error("INTERVIEW_NOT_FOUND");
  if (interview.userId !== socket.data.userId) throw new Error("AUTH_FORBIDDEN");
}

// ── Disconnect handler ────────────────────────────────────────────────────────
// Behavior on socket drop:
//   - A 30-second grace period is started immediately.
//   - If the candidate reconnects within the grace period, the interview
//     continues uninterrupted (clearGracePeriod is called on interview:join).
//   - If the grace period expires without a reconnect, the interview is
//     transitioned to SCHEDULED (paused) via pauseInterviewService so the
//     state machine's assertValidTransition is always enforced.
//   - Duplicate disconnect events are safe: the session-ownership check
//     (session.socketId === socket.id) ensures only the owning socket starts
//     the grace period. The in-grace check inside the timer callback prevents
//     a second timer from executing the transition if grace was already cleared.

async function handleDisconnect(socket: IoSocket, io: IoServer): Promise<void> {
  const { interviewId, userId } = socket.data;
  if (!interviewId || !userId) return;

  const session = await getSocketSession(interviewId);
  // Only the socket that owns the session starts the grace period.
  // Duplicate disconnect events for the same socket are safe because
  // setGracePeriod is idempotent (SET with EX resets the TTL).
  if (session?.socketId !== socket.id) return;

  logger.info(
    { socketId: socket.id, interviewId, userId },
    "[ws] socket disconnected — starting grace period",
  );

  await setGracePeriod(interviewId);

  // Use a local flag to prevent the timer callback from running twice
  // if somehow the Node.js event loop fires it more than once.
  let graceHandled = false;

  setTimeout(() => {
    // setTimeout callback is sync — wrap async work in a void IIFE
    void (async () => {
      if (graceHandled) return;
      graceHandled = true;

      const stillInGrace = await isInGracePeriod(interviewId);
      if (!stillInGrace) return; // candidate reconnected — grace was cleared

      logger.info({ interviewId }, "[ws] grace period expired — pausing interview");
      await deleteSocketSession(interviewId);

      try {
        // Delegate to the service layer so assertValidTransition is enforced.
        // If the interview is already COMPLETED/CANCELLED/ABANDONED the service
        // will throw and we log the error without corrupting state.
        const interview = await fetchInterviewById(interviewId);
        if (interview?.interviewStatus !== "INPROGRESS") return;

        // Build a minimal AuthenticatedRequest shape the service expects
        const fakeAuthReq = { auth: { userId } } as Parameters<typeof pauseInterviewService>[0];
        await pauseInterviewService(fakeAuthReq, interviewId);

        const stateChange: InterviewStateChangePayload = {
          eventVersion: EVENT_VERSION,
          event: "interview:state_change",
          interviewId,
          status: "SCHEDULED",
          timestamp: new Date().toISOString(),
        };
        // Use io.to() — socket may already be gone from the room at this point
        io.to(INTERVIEW_ROOM(interviewId)).emit("interview:state_change", stateChange);
      } catch (err) {
        logger.error({ err, interviewId }, "[ws] failed to pause interview after disconnect");
      }
    })();
  }, GRACE_TTL_SECONDS * 1000);
}

// ── Gateway registration ──────────────────────────────────────────────────────

export function registerInterviewGateway(io: IoServer): void {
  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id, userId: socket.data.userId }, "[ws] socket connected");

    // ── interview:join ──────────────────────────────────────────────────────
    socket.on("interview:join", (payload) => {
      void (async () => {
        const { interviewId } = payload;
        try {
          await assertInterviewAccess(socket, interviewId);

          const context = await readInterviewContext(interviewId);
          if (!context) {
            socket.emit(
              "ws:error",
              wsError(
                "CONTEXT_MISSING",
                "Interview session context not found — was the interview started?",
                interviewId,
              ),
            );
            return;
          }

          const existing = await getSocketSession(interviewId);
          const isReconnect = existing?.userId === socket.data.userId;

          if (isReconnect) {
            await clearGracePeriod(interviewId);
            logger.info({ socketId: socket.id, interviewId }, "[ws] socket reconnected");
          }

          await setSocketSession(interviewId, {
            socketId: socket.id,
            userId: socket.data.userId,
            connectedAt: new Date().toISOString(),
          });

          socket.data.interviewId = interviewId;
          await socket.join(INTERVIEW_ROOM(interviewId));

          const joined: InterviewJoinedPayload = {
            eventVersion: EVENT_VERSION,
            event: "interview:joined",
            interviewId,
            reconnected: isReconnect,
            timerStartedAt: context.timerStartedAt,
            durationMinutes: context.config.durationMinutes,
            answeredQuestionIds: await getAnsweredQuestionIdsService(interviewId),
          };
          socket.emit("interview:joined", joined);
          logger.info(
            { socketId: socket.id, interviewId, reconnected: isReconnect },
            "[ws] joined interview room",
          );

          // Deliver (or re-deliver on reconnect) the current question
          await generateAndDeliverQuestionService(interviewId, io);
        } catch (err) {
          const code = toWsErrorCode(err);
          socket.emit("ws:error", wsError(code, `Failed to join interview: ${code}`, interviewId));
          logger.warn({ socketId: socket.id, interviewId, code }, "[ws] interview:join rejected");
        }
      })();
    });

    // ── interview:leave ─────────────────────────────────────────────────────
    socket.on("interview:leave", (payload) => {
      void (async () => {
        const { interviewId } = payload;
        try {
          // Ownership check — a socket must own the interview to leave it
          await assertInterviewOwnership(socket, interviewId);

          const session = await getSocketSession(interviewId);
          if (session?.socketId === socket.id) await deleteSocketSession(interviewId);

          socket.data.interviewId = undefined as unknown as string;
          await socket.leave(INTERVIEW_ROOM(interviewId));

          const left: InterviewLeftPayload = {
            eventVersion: EVENT_VERSION,
            event: "interview:left",
            interviewId,
          };
          socket.emit("interview:left", left);
          logger.info({ socketId: socket.id, interviewId }, "[ws] left interview room");
        } catch (err) {
          const code = toWsErrorCode(err);
          socket.emit("ws:error", wsError(code, `Failed to leave interview: ${code}`, interviewId));
          logger.warn({ socketId: socket.id, interviewId, code }, "[ws] interview:leave rejected");
        }
      })();
    });

    // ── answer:submit ───────────────────────────────────────────────────────
    socket.on("answer:submit", (payload) => {
      void (async () => {
        const { interviewId, questionId, answerData, answerType } = payload;
        try {
          await assertInterviewAccess(socket, interviewId);
          const fakeAuthReq = { auth: { userId: socket.data.userId } } as Parameters<
            typeof submitAnswerService
          >[0];
          await submitAnswerService(fakeAuthReq, interviewId, { questionId, answerData, answerType }, io);
          if (answerData.trim()) {
            socket.emit("answer:accepted", {
              eventVersion: EVENT_VERSION,
              event: "answer:accepted",
              interviewId,
              questionId,
            });
          }
          logger.info({ socketId: socket.id, interviewId, questionId }, "[ws] answer submitted");
        } catch (err) {
          const code = toWsErrorCode(err);
          socket.emit("ws:error", wsError(code, `Answer submission failed: ${code}`, interviewId));
        }
      })();
    });

    // ── code:submit ─────────────────────────────────────────────────────────
    // Treated as a TEXT answer for now; codebox integration is out of scope.
    socket.on("code:submit", (payload) => {
      void (async () => {
        const { interviewId, questionId, language, code } = payload;
        try {
          await assertInterviewAccess(socket, interviewId);
          const fakeAuthReq = { auth: { userId: socket.data.userId } } as Parameters<
            typeof submitAnswerService
          >[0];
          await submitAnswerService(fakeAuthReq, interviewId, {
            questionId,
            answerData: `[${language}]\n${code}`,
            answerType: "TEXT",
          }, io);
          if (code.trim()) {
            socket.emit("answer:accepted", {
              eventVersion: EVENT_VERSION,
              event: "answer:accepted",
              interviewId,
              questionId,
            });
          }
          logger.info(
            { socketId: socket.id, interviewId, questionId, language },
            "[ws] code submitted",
          );
        } catch (err) {
          const code = toWsErrorCode(err);
          socket.emit("ws:error", wsError(code, `Code submission failed: ${code}`, interviewId));
        }
      })();
    });

    // ── question:next ───────────────────────────────────────────────────────
    // Only succeeds if the current question is in a completed state.
    socket.on("question:next", (payload) => {
      void (async () => {
        const { interviewId } = payload;
        try {
          await assertInterviewAccess(socket, interviewId);
          await requestNextQuestionService(interviewId, socket.data.userId, io);
          logger.info(
            { socketId: socket.id, interviewId },
            "[ws] question:next — next question delivered",
          );
        } catch (err) {
          const code = toWsErrorCode(err);
          socket.emit("ws:error", wsError(code, `question:next failed: ${code}`, interviewId));
        }
      })();
    });

    // ── interview:cancel ────────────────────────────────────────────────────
    socket.on("interview:cancel", (payload) => {
      void (async () => {
        const { interviewId } = payload;
        try {
          await assertInterviewAccess(socket, interviewId);
          const fakeAuthReq = { auth: { userId: socket.data.userId } } as Parameters<
            typeof cancelInterviewService
          >[0];
          await cancelInterviewService(fakeAuthReq, interviewId);

          await deleteSocketSession(interviewId);

          const stateChange: InterviewStateChangePayload = {
            eventVersion: EVENT_VERSION,
            event: "interview:state_change",
            interviewId,
            status: "CANCELLED",
            timestamp: new Date().toISOString(),
          };
          io.to(INTERVIEW_ROOM(interviewId)).emit("interview:state_change", stateChange);
          logger.info({ socketId: socket.id, interviewId }, "[ws] interview cancelled");
        } catch (err) {
          const code = toWsErrorCode(err);
          socket.emit("ws:error", wsError(code, `Cancel failed: ${code}`, interviewId));
        }
      })();
    });

    socket.on("interview:end", (payload) => {
      void (async () => {
        const { interviewId } = payload;
        try {
          // endInterviewService is deliberately idempotent. Ownership is the
          // only gateway precondition so a duplicate request can receive the
          // terminal result instead of being rejected after the first wins.
          await assertInterviewOwnership(socket, interviewId);
          const fakeAuthReq = { auth: { userId: socket.data.userId } } as Parameters<typeof endInterviewService>[0];
          const updated = await endInterviewService(fakeAuthReq, interviewId);
          await deleteSocketSession(interviewId);
          const stateChange: InterviewStateChangePayload = {
            eventVersion: EVENT_VERSION,
            event: "interview:state_change",
            interviewId,
            status: updated?.interviewStatus ?? "CANCELLED",
            timestamp: new Date().toISOString(),
          };
          io.to(INTERVIEW_ROOM(interviewId)).emit("interview:state_change", stateChange);
        } catch (err) {
          const code = toWsErrorCode(err);
          socket.emit("ws:error", wsError(code, `End failed: ${code}`, interviewId));
        }
      })();
    });

    // ── heartbeat:ack ───────────────────────────────────────────────────────
    socket.on("heartbeat:ack", () => {
      // No-op — Socket.IO transport ping/pong handles dead connection detection.
    });

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      logger.info(
        { socketId: socket.id, userId: socket.data.userId, reason },
        "[ws] disconnect event",
      );
      // Wrap async handler in void IIFE to satisfy no-misused-promises
      void handleDisconnect(socket, io);
    });
  });
}
