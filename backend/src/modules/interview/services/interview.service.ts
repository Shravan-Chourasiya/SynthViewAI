import { eq, and, desc, lt, inArray, notInArray } from "drizzle-orm";
import getPgDb from "../../../db/postgres.init.js";
import type { interviewStatusEnum } from "../schemas/interview.schema.js";
import { interviewsTable } from "../schemas/interview.schema.js";
import { interviewAnswersTable } from "../schemas/answers.schema.js";
import { interviewQuestionsTable } from "../schemas/question.schema.js";
import { interviewResultsTable } from "../schemas/result.schema.js";
import type { AuthenticatedRequest } from "../../../types/request.js";
import { AppError } from "../../../utils/appError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
import {
  ABANDONMENT_THRESHOLD_MS,
  QUESTION_TIMEOUT_MS,
} from "../../../constants/interview.constants.js";
import { StatusCodes } from "http-status-codes";
import {
  writeInterviewContext,
  readInterviewContext,
  deleteInterviewContext,
} from "./interview.context.service.js";
import type { InterviewContext } from "../types/interview.context.js";
import {
  generateNextQuestion,
  startAiSession,
  endAiSession,
  evaluateAnswer,
} from "../../../integrations/ai/index.js";
import {
  consumeLookahead,
  writeLookahead,
  discardLookahead,
} from "../../../integrations/ai/lookahead.cache.js";
import {
  initialPerformanceState,
  updatePerformanceState,
  updateSkipCount,
  updateTimeoutCount,
  detectPatterns,
  computeAdaptation,
  elapsedMinutesSince,
} from "../../../integrations/ai/adaptive/index.js";
import type { AdaptationDecision } from "../../../integrations/ai/adaptive/index.js";
import type { IoServer } from "../../../websocket/socket.types.js";
import { EVENT_VERSION } from "../../../websocket/socket.types.js";
import { logger } from "../../../utils/logger.js";

// ── State machine ─────────────────────────────────────────────────────────────

type InterviewStatus = (typeof interviewStatusEnum.enumValues)[number];

// Terminal states — no transitions allowed out of these
const TERMINAL_STATUSES: InterviewStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "ABANDONED",
  "EXPIRED",
  "TIMED_OUT",
];

// Resumable = paused by the user (SCHEDULED), not dead
const RESUMABLE_STATUSES: InterviewStatus[] = ["SCHEDULED"];

const VALID_TRANSITIONS: Record<InterviewStatus, InterviewStatus[]> = {
  DRAFT: ["READY"],
  READY: ["INPROGRESS", "SCHEDULED", "CANCELLED"],
  SCHEDULED: ["INPROGRESS", "CANCELLED", "EXPIRED"],
  INPROGRESS: ["SCHEDULED", "COMPLETED", "CANCELLED", "ABANDONED", "TIMED_OUT"],
  COMPLETED: [],
  CANCELLED: [],
  ABANDONED: [],
  EXPIRED: [],
  TIMED_OUT: [],
};

function assertValidTransition(current: InterviewStatus, next: InterviewStatus): void {
  if (!VALID_TRANSITIONS[current].includes(next)) {
    throw new AppError(
      `Cannot transition interview from ${current} to ${next}`,
      StatusCodes.BAD_REQUEST,
      ErrorCodes.INTERVIEW_INVALID_STATE,
      { isOperational: true },
    );
  }
}

// ── Repository helper (used by ownership middleware) ──────────────────────────

export async function fetchInterviewById(id: string) {
  const db = getPgDb();
  const [interview] = await db.select().from(interviewsTable).where(eq(interviewsTable.id, id));
  return interview;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function resolveInterview(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await fetchInterviewById(interviewId);
  if (!interview || interview.userId !== authreq.auth.userId) {
    throw new AppError(
      "Interview not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.INTERVIEW_NOT_FOUND,
      { isOperational: true },
    );
  }
  return interview;
}

async function transitionInterview(
  interviewId: string,
  from: InterviewStatus,
  to: InterviewStatus,
) {
  assertValidTransition(from, to);
  const db = getPgDb();
  const [updated] = await db
    .update(interviewsTable)
    .set({ interviewStatus: to, lastActivityAt: new Date() })
    // The source status is part of the update predicate, not just a
    // precondition. This prevents concurrent terminal actions from replacing
    // one another after they have both read INPROGRESS.
    .where(and(eq(interviewsTable.id, interviewId), eq(interviewsTable.interviewStatus, from)))
    .returning();
  if (!updated) {
    throw new AppError(
      "Interview status changed before this action could complete",
      StatusCodes.CONFLICT,
      ErrorCodes.INTERVIEW_INVALID_STATE,
      { isOperational: true },
    );
  }
  return updated;
}

// ── Services ──────────────────────────────────────────────────────────────────

export async function createInterviewService(
  authreq: AuthenticatedRequest,
  interviewData: {
    jobrole: string;
    domain?: string;
    experience: string;
    jobSkills?: string[];
    difficulty: "EASY" | "MEDIUM" | "HARD";
    isAdaptive: boolean;
    interviewStyle: "MANGOS" | "FAANG" | "MAANG" | "STARTUP" | "CUSTOM" | "REGULAR";
    interviewType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
    duration: number;
    maxFollowUps: number;
    isScheduled: boolean;
    scheduledDate?: Date;
    targetedCompany?: string;
    targetedCompanyOther?: string;
    endingCriteria: "QUESTION_COUNT" | "DURATION";
    questionCount?: number;
  },
) {
  const db = getPgDb();

  const targetCompany = interviewData.targetedCompany ?? interviewData.targetedCompanyOther;
  const title = `${interviewData.jobrole}${targetCompany ? ` at ${targetCompany}` : ""} — ${interviewData.interviewType} Interview`;
  const description = interviewData.targetedCompany
    ? `Targeting ${interviewData.targetedCompany} (${interviewData.experience})`
    : `${interviewData.experience} level`;

  const [interview] = await db
    .insert(interviewsTable)
    .values({
      userId: authreq.auth.userId,
      interviewTitle: title,
      interviewDescription: description,
      interviewType: interviewData.interviewType,
      interviewCompanyStyle: interviewData.interviewStyle,
      interviewDifficulty: interviewData.difficulty,
      interviewDuration: interviewData.duration,
      interviewMetaData: {
        jobRole: interviewData.jobrole,
        ...(interviewData.domain ? { domain: interviewData.domain } : {}),
        experience: interviewData.experience,
        isAdaptive: interviewData.isAdaptive,
        ...(interviewData.jobSkills?.length ? { jobSkills: interviewData.jobSkills } : {}),
        ...(interviewData.targetedCompany ? { targetedCompany: interviewData.targetedCompany } : {}),
        maxFollowUps: interviewData.maxFollowUps,
        ...(interviewData.targetedCompanyOther ? { targetedCompanyOther: interviewData.targetedCompanyOther } : {}),
        endingCriteria: interviewData.endingCriteria,
        ...(interviewData.endingCriteria === "QUESTION_COUNT" && interviewData.questionCount
          ? { questionCount: interviewData.questionCount }
          : {}),
      },
      // Unscheduled interviews can be started immediately. Scheduled
      // interviews remain drafts until they are explicitly prepared/scheduled.
      interviewStatus: interviewData.isScheduled ? "DRAFT" : "READY",
      isInterviewScheduled: interviewData.isScheduled,
      interviewScheduledDate: interviewData.isScheduled ? interviewData.scheduledDate : null,
    })
    .returning();

  return interview;
}

export async function getAllInterviewsService(authreq: AuthenticatedRequest) {
  const db = getPgDb();
  return db.select().from(interviewsTable).where(eq(interviewsTable.userId, authreq.auth.userId));
}

export async function getInterviewByIdService(authreq: AuthenticatedRequest, interviewId: string) {
  const db = getPgDb();

  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(
      and(eq(interviewsTable.id, interviewId), eq(interviewsTable.userId, authreq.auth.userId)),
    );

  if (!interview) {
    throw new AppError(
      "Interview not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.INTERVIEW_NOT_FOUND,
      { isOperational: true },
    );
  }

  return interview;
}

/**
 * Permanently removes an interview regardless of its current state.
 * Database foreign keys cascade the related questions, answers, evaluations,
 * and result rows. Redis cleanup is best-effort so stale cache data cannot
 * prevent the database deletion.
 */
export async function deleteInterviewService(
  authreq: AuthenticatedRequest,
  interviewId: string,
) {
  const interview = await resolveInterview(authreq, interviewId);

  if (interview.interviewStatus === "INPROGRESS") {
    const context = await readInterviewContext(interviewId).catch(() => null);
    if (context?.aiContext.threadId) {
      await endAiSession({
        interviewId,
        threadId: context.aiContext.threadId,
        reason: "CANCELLED",
      }).catch((err) => {
        logger.warn({ err, interviewId }, "[ai] failed to end session during interview deletion");
      });
    }
  }

  await Promise.all([
    deleteInterviewContext(interviewId).catch((err) => {
      logger.warn({ err, interviewId }, "[redis] failed to delete interview context");
    }),
    discardLookahead(interviewId).catch((err) => {
      logger.warn({ err, interviewId }, "[redis] failed to delete interview lookahead");
    }),
  ]);

  const db = getPgDb();
  const [deleted] = await db
    .delete(interviewsTable)
    .where(
      and(eq(interviewsTable.id, interviewId), eq(interviewsTable.userId, authreq.auth.userId)),
    )
    .returning({ id: interviewsTable.id });

  return deleted;
}

export async function getResumableInterviewsService(authreq: AuthenticatedRequest) {
  const db = getPgDb();
  return db
    .select()
    .from(interviewsTable)
    .where(
      and(
        eq(interviewsTable.userId, authreq.auth.userId),
        inArray(interviewsTable.interviewStatus, RESUMABLE_STATUSES),
      ),
    )
    .orderBy(desc(interviewsTable.updatedAt));
}

export async function startInterviewService(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await resolveInterview(authreq, interviewId);
  assertValidTransition(interview.interviewStatus, "INPROGRESS");

  const now = new Date();
  const meta = interview.interviewMetaData;

  // ── Step 1: Build the session context ────────────────────────────────────
  let context: InterviewContext = {
    interviewId,
    candidateIdentity: {
      userId: authreq.auth.userId,
      experience: (meta as { experience?: string }).experience ?? "unknown",
    },
    config: {
      interviewType: interview.interviewType,
      interviewStyle: interview.interviewCompanyStyle,
      difficulty: interview.interviewDifficulty,
      durationMinutes: interview.interviewDuration,
      maxFollowUps: meta.maxFollowUps ?? 3,
      endingCriteria: meta.endingCriteria ?? "DURATION",
      ...(meta.questionCount ? { questionCount: meta.questionCount } : {}),
      ...(meta.jobRole ? { jobRole: meta.jobRole } : {}),
      ...(meta.domain ? { domain: meta.domain } : {}),
      ...(meta.targetedCompany ? { targetedCompany: meta.targetedCompany } : {}),
      ...(meta.jobSkills?.length ? { jobSkills: meta.jobSkills } : {}),
    },
    questionState: {
      currentIndex: 0,
      // This is a display estimate for duration-based sessions; an explicit
      // question target remains exact. It prevents the client from treating
      // one interview round as one total question.
      totalQuestions: meta.questionCount ?? Math.max(1, Math.ceil(interview.interviewDuration / 5)),
      currentQuestionId: null,
    },
    timerStartedAt: now.toISOString(),
    aiContext: { threadId: "" },
    performanceState: initialPerformanceState(interview.interviewDifficulty),
    adaptationHistory: [],
  };

  // ── Step 3: Persist context to Redis (atomic gate — DB untouched until this succeeds) ──
  await writeInterviewContext(context, interview.interviewDuration);

  // ── Step 4: Transition DB status — rollback Redis on failure ─────────────
  let updated;
  try {
    const db = getPgDb();
    [updated] = await db
      .update(interviewsTable)
      .set({ interviewStatus: "INPROGRESS", lastActivityAt: now, interviewStartedAt: now })
      .where(eq(interviewsTable.id, interviewId))
      .returning();
  } catch (err) {
    await deleteInterviewContext(interviewId);
    throw err;
  }

  // ── Step 5: Start AI session + generate first question (immediate-start only) ──
  // Scheduled interviews skip both: the AI session is initialised when the
  // candidate actually joins, not at scheduling time.
  if (!interview.isInterviewScheduled) {
    try {
      const { threadId } = await startAiSession({
        interviewId,
        config: context.config,
        candidateExperience: context.candidateIdentity.experience,
      });
      const contextWithThread: InterviewContext = { ...context, aiContext: { threadId } };
      await writeInterviewContext(contextWithThread, interview.interviewDuration);
      context = contextWithThread;
    } catch (err) {
      logger.warn(
        { err, interviewId },
        "[ai] startAiSession failed — continuing with empty threadId",
      );
    }

    try {
      await generateAndDeliverQuestionService(interviewId, null);
    } catch (err) {
      void err;
    }
  }

  return { interview: updated, context };
}

// ── Generate and deliver the first (or next) question ─────────────────────────
// Idempotent: if context already has a currentQuestionId, the question was
// already generated and delivered — return it without generating a new one.
// io is optional so this can be called from HTTP context (start) where the
// socket hasn't joined yet; in that case the client gets the question on join.
export async function generateAndDeliverQuestionService(
  interviewId: string,
  io: IoServer | null,
): Promise<void> {
  let context = await readInterviewContext(interviewId);
  if (!context) {
    throw new AppError(
      "Interview context not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.INTERVIEW_NOT_FOUND,
      { isOperational: true },
    );
  }

  // ── Idempotency guard ─────────────────────────────────────────────────────
  if (context.questionState.currentQuestionId !== null) {
    if (io) await redeliverCurrentQuestion(context, io);
    return;
  }

  // ── Hard duration ceiling ─────────────────────────────────────────────────
  // The adaptive engine terminates at the deadline on the next evaluated answer,
  // but a candidate who never submits (skips / per-question timeouts) must not keep
  // receiving fresh questions past the configured duration. Reaching the duration is
  // a natural completion, exactly like reaching a question target — never an
  // abandonment, and never a TIMED_OUT interview (the reaper covers the case where
  // nobody is answering at all).
  const elapsedMinutes = elapsedMinutesSince(context.timerStartedAt);
  if (context.config.durationMinutes > 0 && elapsedMinutes >= context.config.durationMinutes) {
    logger.info(
      {
        interviewId,
        elapsedMinutes: Math.floor(elapsedMinutes),
        durationMinutes: context.config.durationMinutes,
      },
      "[interview] configured duration reached — completing instead of generating a question",
    );
    const completed = await endInterviewSystemService(interviewId);
    if (completed && io) {
      io.to(`interview:${interviewId}`).emit("interview:state_change", {
        eventVersion: EVENT_VERSION,
        event: "interview:state_change",
        interviewId,
        status: completed.interviewStatus,
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }

  // ── Lazy AI session init for scheduled interviews ───────────────────────────
  // Scheduled interviews skip startAiSession at start time; the threadId is
  // empty until the candidate actually joins. Initialise it now, once.
  if (!context.aiContext.threadId) {
    try {
      const { threadId } = await startAiSession({
        interviewId,
        config: context.config,
        candidateExperience: context.candidateIdentity.experience,
      });
      context = { ...context, aiContext: { threadId } };
      await writeInterviewContext(context, context.config.durationMinutes);
    } catch (err) {
      logger.warn(
        { err, interviewId },
        "[ai] lazy startAiSession failed — continuing with empty threadId",
      );
    }
  }

  const db = getPgDb();
  const sequenceNumber = context.questionState.currentIndex + 1;

  // ── Consume lookahead cache (populated by the previous answer submission) ─
  let generated = await consumeLookahead(interviewId);

  if (generated) {
    logger.info({ interviewId, sequenceNumber }, "[ai] lookahead cache hit");
  } else {
    // ── Cache miss — fetch previous questions and generate synchronously ────
    // Recover the pending adaptation hint (set by the last evaluation pipeline)
    // so the synchronous generation path respects the same adaptive decision
    // that was used to pre-warm the (now-missing) lookahead.
    const pendingHint = context.pendingAdaptationHint;

    const previous = await db
      .select({
        questionTitle: interviewQuestionsTable.questionTitle,
        questionType: interviewQuestionsTable.questionType,
        questionState: interviewQuestionsTable.questionState,
      })
      .from(interviewQuestionsTable)
      .where(eq(interviewQuestionsTable.interviewId, interviewId))
      // Sequence order matters: the prompt uses it for the behavioural/technical
      // split, the avoid-list, and "the previous question" in follow-up mode.
      .orderBy(interviewQuestionsTable.sequenceNumber);

    logger.info(
      { interviewId, sequenceNumber },
      "[ai] lookahead cache miss — generating synchronously",
    );
    const result = await generateNextQuestion({
      interviewId,
      threadId: context.aiContext.threadId,
      sequenceNumber,
      previousQuestions: previous.map((q) => ({
        questionTitle: q.questionTitle,
        questionType: q.questionType,
        wasAnswered: q.questionState === "ANSWERED" || q.questionState === "EVALUATED",
      })),
      ...(pendingHint ? { adaptationHint: pendingHint } : {}),
    });
    generated = result.question;
  }

  // ── Persist question row ──────────────────────────────────────────────────
  const [question] = await db
    .insert(interviewQuestionsTable)
    .values({
      interviewId,
      sequenceNumber,
      questionTitle: generated.questionTitle,
      questionDescription: generated.questionDescription ?? undefined,
      questionType: generated.questionType,
      questionState: "PENDING",
    })
    .returning();

  // ── Update context with new currentQuestionId ─────────────────────────────
  const updatedContext: InterviewContext = {
    ...context,
    questionState: {
      ...context.questionState,
      currentQuestionId: question!.id,
    },
  };
  await writeInterviewContext(updatedContext, context.config.durationMinutes);

  // ── Deliver over socket if io is available ────────────────────────────────
  if (io) {
    const INTERVIEW_ROOM = `interview:${interviewId}`;
    io.to(INTERVIEW_ROOM).emit("question:delivered", {
      eventVersion: EVENT_VERSION,
      event: "question:delivered",
      interviewId,
      questionId: question!.id,
      sequenceNumber,
      totalQuestions: context.questionState.totalQuestions,
      questionTitle: generated.questionTitle,
      ...(generated.questionDescription
        ? { questionDescription: generated.questionDescription }
        : {}),
      questionType: generated.questionType,
      deliveredAt: new Date().toISOString(),
      timeoutSeconds: Math.floor(QUESTION_TIMEOUT_MS / 1000),
    });
  }
}

// Re-delivers the current question to the room (used on reconnect / idempotent re-request)
async function redeliverCurrentQuestion(context: InterviewContext, io: IoServer): Promise<void> {
  const { currentQuestionId } = context.questionState;
  if (!currentQuestionId) return;

  const db = getPgDb();
  const [question] = await db
    .select()
    .from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.id, currentQuestionId))
    .limit(1);

  if (!question) return;

  const INTERVIEW_ROOM = `interview:${context.interviewId}`;
  io.to(INTERVIEW_ROOM).emit("question:delivered", {
    eventVersion: EVENT_VERSION,
    event: "question:delivered",
    interviewId: context.interviewId,
    questionId: question.id,
    sequenceNumber: question.sequenceNumber,
    totalQuestions: context.questionState.totalQuestions,
    questionTitle: question.questionTitle,
    ...(question.questionDescription ? { questionDescription: question.questionDescription } : {}),
    questionType: question.questionType,
    deliveredAt: new Date().toISOString(),
    timeoutSeconds: Math.floor(QUESTION_TIMEOUT_MS / 1000),
  });
}

// ── Lookahead helper ───────────────────────────────────────────────────────────────
// Generates the next question in the background and stores it in the lookahead
// cache. Called fire-and-forget after an answer is persisted. Errors are logged
// but never propagated — a cache miss on the next question:next is handled
// gracefully by falling back to synchronous generation.
async function kickoffLookahead(
  interviewId: string,
  context: InterviewContext,
  decision?: AdaptationDecision,
): Promise<void> {
  try {
    const nextSequence = context.questionState.currentIndex + 2;

    // Never pre-warm a question that can no longer be delivered — the next
    // generateAndDeliverQuestionService call completes the interview instead.
    if (
      context.config.durationMinutes > 0 &&
      elapsedMinutesSince(context.timerStartedAt) >= context.config.durationMinutes
    ) {
      logger.info({ interviewId }, "[ai] lookahead skipped — configured duration reached");
      return;
    }

    const db = getPgDb();
    const previous = await db
      .select({
        questionTitle: interviewQuestionsTable.questionTitle,
        questionType: interviewQuestionsTable.questionType,
        questionState: interviewQuestionsTable.questionState,
      })
      .from(interviewQuestionsTable)
      .where(eq(interviewQuestionsTable.interviewId, interviewId))
      .orderBy(interviewQuestionsTable.sequenceNumber);

    const result = await generateNextQuestion({
      interviewId,
      threadId: context.aiContext.threadId,
      sequenceNumber: nextSequence,
      previousQuestions: previous.map((q) => ({
        questionTitle: q.questionTitle,
        questionType: q.questionType,
        wasAnswered: q.questionState === "ANSWERED" || q.questionState === "EVALUATED",
      })),
      ...(decision ? { adaptationHint: decision.hint } : {}),
    });

    await writeLookahead(interviewId, result.question);
    logger.info({ interviewId, nextSequence }, "[ai] lookahead question cached");
  } catch (err) {
    logger.warn(
      { err, interviewId },
      "[ai] lookahead generation failed — will generate synchronously on next request",
    );
  }
}

export async function pauseInterviewService(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await resolveInterview(authreq, interviewId);
  return transitionInterview(interviewId, interview.interviewStatus, "SCHEDULED");
}

export async function resumeInterviewService(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await resolveInterview(authreq, interviewId);
  return transitionInterview(interviewId, interview.interviewStatus, "INPROGRESS");
}

// ── Shared skip/timeout helper ────────────────────────────────────────────────

async function skipQuestionInternal(
  db: ReturnType<typeof getPgDb>,
  interviewId: string,
  questionId: string,
  now: Date,
  state: "SKIPPED" | "TIMED_OUT",
) {
  await db
    .update(interviewQuestionsTable)
    .set({
      questionState: state,
      ...(state === "TIMED_OUT" ? { timedOutAt: now, timeoutBehavior: "AUTO_SKIP" } : {}),
    })
    .where(eq(interviewQuestionsTable.id, questionId));

  const [answer] = await db
    .insert(interviewAnswersTable)
    .values({
      interviewId,
      questionId,
      answerData: "",
      answerType: "TEXT",
      answeredAt: now,
    })
    .returning();

  // Update performance state for skip/timeout — fire-and-forget
  void (async () => {
    try {
      const ctx = await readInterviewContext(interviewId);
      if (!ctx) return;
      const updatedPerf =
        state === "TIMED_OUT"
          ? updateTimeoutCount(ctx.performanceState)
          : updateSkipCount(ctx.performanceState);
      await writeInterviewContext(
        { ...ctx, performanceState: updatedPerf },
        ctx.config.durationMinutes,
      );
    } catch (err) {
      logger.warn(
        { err, interviewId, questionId },
        "[perf] failed to update performance state on skip/timeout",
      );
    }
  })();

  return answer;
}

// ── Services ── (continued)
export async function cancelInterviewService(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await resolveInterview(authreq, interviewId);
  return transitionInterview(interviewId, interview.interviewStatus, "CANCELLED");
}

// ── Report generation ─────────────────────────────────────────────────────────
// Authoritative evaluation source: interviewAnswersTable.evaluationData (jsonb).
// answerEvaluationTable exists in the schema but is never written to by the
// current evaluation pipeline — it is intentionally unused.
//
// Score mapping (evaluator → report column):
//   correctness  → technicalScore
//   relevance    → problemSolvingScore
//   clarity      → communicationScore
//   technicalDepth → confidenceScore  (closest semantic match available)
//   score        → overallScore (per-answer composite, averaged across answers)
//
// Aggregation: simple arithmetic mean across all evaluated answers.
// Missing/null evaluation data is excluded from the mean; it does not become 0.
// Idempotency: enforced by the UNIQUE constraint on interview_results.interview_id
// combined with an INSERT … ON CONFLICT DO NOTHING pattern.
export async function generateInterviewReportService(interviewId: string): Promise<void> {
  const db = getPgDb();

  // ── Fetch all answers with their evaluation data ──────────────────────────
  const answers = await db
    .select({
      id: interviewAnswersTable.id,
      answerData: interviewAnswersTable.answerData,
      answerState: interviewAnswersTable.answerState,
      evaluationData: interviewAnswersTable.evaluationData,
    })
    .from(interviewAnswersTable)
    .where(eq(interviewAnswersTable.interviewId, interviewId));

  // ── Fetch question states for counts ─────────────────────────────────────
  const questions = await db
    .select({ questionState: interviewQuestionsTable.questionState })
    .from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.interviewId, interviewId));

  const questionsAnswered = questions.filter(
    (q) => q.questionState === "ANSWERED" || q.questionState === "EVALUATED",
  ).length;
  const questionsSkipped = questions.filter(
    (q) => q.questionState === "SKIPPED" || q.questionState === "TIMED_OUT",
  ).length;

  // ── Collect evaluated answers only ───────────────────────────────────────
  const evaluated = answers.filter(
    (a) => a.answerState === "EVALUATED" && a.evaluationData !== null,
  );
  const questionsEvaluated = evaluated.length;

  // ── Aggregate scores — mean across evaluated answers ─────────────────────
  function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  const overallScore = mean(evaluated.map((a) => a.evaluationData!.score));
  const technicalScore = mean(evaluated.map((a) => a.evaluationData!.correctness));
  const communicationScore = mean(evaluated.map((a) => a.evaluationData!.clarity));
  const problemSolvingScore = mean(evaluated.map((a) => a.evaluationData!.relevance));
  const confidenceScore = mean(evaluated.map((a) => a.evaluationData!.technicalDepth));

  // ── Aggregate text fields — deduplicated union ────────────────────────────
  const allStrengths = [...new Set(evaluated.flatMap((a) => a.evaluationData!.strengths))];
  const allWeaknesses = [...new Set(evaluated.flatMap((a) => a.evaluationData!.weaknesses))];
  const feedback = evaluated.map((a) => a.evaluationData!.feedback).filter(Boolean).join(" ");

  // ── Fetch interview duration ──────────────────────────────────────────────
  const interview = await fetchInterviewById(interviewId);
  const totalDuration = interview?.interviewDuration ?? 0;

  // ── Upsert — ON CONFLICT DO NOTHING enforces idempotency ─────────────────
  await db
    .insert(interviewResultsTable)
    .values({
      interviewId,
      overallScore: overallScore.toFixed(2),
      technicalScore: technicalScore.toFixed(2),
      communicationScore: communicationScore.toFixed(2),
      problemSolvingScore: problemSolvingScore.toFixed(2),
      confidenceScore: confidenceScore.toFixed(2),
      questionsAnswered,
      questionsSkipped,
      questionsEvaluated,
      totalDuration,
      feedback: feedback || "",
      strengths: allStrengths,
      weaknesses: allWeaknesses,
    })
    .onConflictDoNothing();
}

export async function getInterviewReportService(
  authreq: AuthenticatedRequest,
  interviewId: string,
) {
  const interview = await resolveInterview(authreq, interviewId);

  if (interview.interviewStatus !== "COMPLETED") {
    throw new AppError(
      "Report is only available for completed interviews",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.INTERVIEW_INVALID_STATE,
      { isOperational: true },
    );
  }

  const db = getPgDb();
  const difficultyProgression = interview.interviewMetaData.isAdaptive
    ? (await readInterviewContext(interviewId))?.performanceState.difficultyHistory ?? []
    : [];
  const [report] = await db
    .select()
    .from(interviewResultsTable)
    .where(eq(interviewResultsTable.interviewId, interviewId))
    .limit(1);

  if (!report) {
    // Report not yet generated (e.g. generation failed at completion time).
    // Generate it now on-demand — no LLM call, pure DB aggregation.
    await generateInterviewReportService(interviewId);
    const [generated] = await db
      .select()
      .from(interviewResultsTable)
      .where(eq(interviewResultsTable.interviewId, interviewId))
      .limit(1);
    return generated ? { ...generated, difficultyProgression } : null;
  }

  return { ...report, difficultyProgression };
}

export async function endInterviewService(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await resolveInterview(authreq, interviewId);
  if (TERMINAL_STATUSES.includes(interview.interviewStatus)) return interview;
  const db = getPgDb();
  const answered = await db
    .select({ questionState: interviewQuestionsTable.questionState })
    .from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.interviewId, interviewId));
  const answeredCount = answered.filter((question) => question.questionState === "ANSWERED" || question.questionState === "EVALUATED").length;
  const nextStatus: InterviewStatus = answeredCount >= 3 ? "COMPLETED" : "CANCELLED";
  let updated;
  try {
    updated = await transitionInterview(interviewId, interview.interviewStatus, nextStatus);
  } catch (error) {
    // A concurrent end/cancel may have won the compare-and-set race. Preserve
    // that terminal result and never initiate a second report generation.
    const latest = await fetchInterviewById(interviewId);
    if (latest && TERMINAL_STATUSES.includes(latest.interviewStatus)) return latest;
    throw error;
  }
  if (nextStatus === "COMPLETED") {
    // Fire-and-forget — report failure must not roll back the completion.
    void generateInterviewReportService(interviewId).catch((err) => {
      logger.error({ err, interviewId }, "[report] generateInterviewReportService failed after endInterviewService");
    });
  }
  return updated;
}

// System-driven completion — called by the adaptive engine when it decides to
// terminate early. No AuthenticatedRequest needed; ownership was already verified
// at answer submission time.
export async function endInterviewSystemService(interviewId: string) {
  const interview = await fetchInterviewById(interviewId);
  if (!interview) return null;
  if (TERMINAL_STATUSES.includes(interview.interviewStatus)) return interview;
  let updated;
  try {
    updated = await transitionInterview(interviewId, interview.interviewStatus, "COMPLETED");
  } catch (error) {
    const latest = await fetchInterviewById(interviewId);
    if (latest && TERMINAL_STATUSES.includes(latest.interviewStatus)) return latest;
    throw error;
  }
  void generateInterviewReportService(interviewId).catch((err) => {
    logger.error({ err, interviewId }, "[report] generateInterviewReportService failed after endInterviewSystemService");
  });
  return updated;
}

// System-driven abandonment — called by the stale detection job, not by users
export async function abandonInterviewService(interviewId: string) {
  const db = getPgDb();
  const interview = await fetchInterviewById(interviewId);
  if (!interview) return null;
  assertValidTransition(interview.interviewStatus, "ABANDONED");
  const [updated] = await db
    .update(interviewsTable)
    .set({ interviewStatus: "ABANDONED", lastActivityAt: new Date() })
    .where(eq(interviewsTable.id, interviewId))
    .returning();
  return updated;
}

// Stale detection — finds INPROGRESS interviews inactive beyond the threshold
export async function detectAndAbandonStaleInterviews() {
  const db = getPgDb();
  const threshold = new Date(Date.now() - ABANDONMENT_THRESHOLD_MS);

  const stale = await db
    .select({ id: interviewsTable.id })
    .from(interviewsTable)
    .where(
      and(
        eq(interviewsTable.interviewStatus, "INPROGRESS"),
        lt(interviewsTable.lastActivityAt, threshold),
      ),
    );

  if (stale.length === 0) return { abandoned: 0 };

  await db
    .update(interviewsTable)
    .set({ interviewStatus: "ABANDONED" })
    .where(
      inArray(
        interviewsTable.id,
        stale.map((r) => r.id),
      ),
    );

  return { abandoned: stale.length };
}

// Scheduled interviews remain startable for six hours after their appointment.
// This uses the same state-machine transition as every other terminal change.
export async function detectAndExpireScheduledInterviews() {
  const db = getPgDb();
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const stale = await db
    .select({ id: interviewsTable.id })
    .from(interviewsTable)
    .where(
      and(
        eq(interviewsTable.interviewStatus, "SCHEDULED"),
        eq(interviewsTable.isInterviewScheduled, true),
        lt(interviewsTable.interviewScheduledDate, cutoff),
      ),
    );
  for (const interview of stale) {
    await transitionInterview(interview.id, "SCHEDULED", "EXPIRED");
  }
  return { expired: stale.length };
}

export async function getInterviewHistoryService(
  authreq: AuthenticatedRequest,
  interviewId: string,
) {
  const db = getPgDb();

  const interview = await resolveInterview(authreq, interviewId);

  if (!TERMINAL_STATUSES.includes(interview.interviewStatus)) {
    throw new AppError(
      "History is only available for finished interviews",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.INTERVIEW_INVALID_STATE,
      { isOperational: true },
    );
  }

  const questions = await db
    .select({
      questionId: interviewQuestionsTable.id,
      sequenceNumber: interviewQuestionsTable.sequenceNumber,
      questionTitle: interviewQuestionsTable.questionTitle,
      questionCreatedAt: interviewQuestionsTable.createdAt,
      questionType: interviewQuestionsTable.questionType,
      questionState: interviewQuestionsTable.questionState,
      timedOutAt: interviewQuestionsTable.timedOutAt,
      timeoutBehavior: interviewQuestionsTable.timeoutBehavior,
      answerId: interviewAnswersTable.id,
      answerData: interviewAnswersTable.answerData,
      answerType: interviewAnswersTable.answerType,
      answerState: interviewAnswersTable.answerState,
      evaluationData: interviewAnswersTable.evaluationData,
      answeredAt: interviewAnswersTable.answeredAt,
      timeTakenSeconds: interviewAnswersTable.timeTakenSeconds,
    })
    .from(interviewQuestionsTable)
    .leftJoin(
      interviewAnswersTable,
      eq(interviewAnswersTable.questionId, interviewQuestionsTable.id),
    )
    .where(eq(interviewQuestionsTable.interviewId, interviewId))
    .orderBy(interviewQuestionsTable.sequenceNumber);

  return {
    interviewId,
    interviewStatus: interview.interviewStatus,
    questions,
  };
}

/**
 * Live clients use these persisted question ids only for truthful end-dialog
 * copy. Terminal-state decisions remain exclusively in endInterviewService.
 */
export async function getAnsweredQuestionIdsService(interviewId: string): Promise<string[]> {
  const db = getPgDb();
  const questions = await db
    .select({ id: interviewQuestionsTable.id, questionState: interviewQuestionsTable.questionState })
    .from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.interviewId, interviewId));
  return questions
    .filter((question) => question.questionState === "ANSWERED" || question.questionState === "EVALUATED")
    .map((question) => question.id);
}

export async function submitAnswerService(
  authreq: AuthenticatedRequest,
  interviewId: string,
  payload: { questionId: string; answerData: string; answerType: "TEXT" | "AUDIO" | "VIDEO" },
  io?: IoServer,
) {
  const interview = await resolveInterview(authreq, interviewId);

  if (interview.interviewStatus !== "INPROGRESS") {
    throw new AppError(
      "Answers can only be submitted while the interview is INPROGRESS",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.INTERVIEW_INVALID_STATE,
      { isOperational: true },
    );
  }

  // ── Staleness guard — reject answers for non-current questions ────────────
  const context = await readInterviewContext(interviewId);
  if (!context) {
    throw new AppError(
      "Interview context not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.INTERVIEW_NOT_FOUND,
      { isOperational: true },
    );
  }
  if (context.questionState.currentQuestionId !== payload.questionId) {
    throw new AppError(
      "Answer rejected: not the current question",
      StatusCodes.CONFLICT,
      ErrorCodes.ANSWER_REJECTED,
      { isOperational: true },
    );
  }

  const db = getPgDb();
  const now = new Date();

  // ── Duplicate guard — one answer per question, ever ───────────────────────
  const [existing] = await db
    .select({ id: interviewAnswersTable.id })
    .from(interviewAnswersTable)
    .where(eq(interviewAnswersTable.questionId, payload.questionId))
    .limit(1);
  if (existing) return existing; // idempotent — return the already-persisted answer

  const isEmpty = payload.answerData.trim().length === 0;

  // Empty answer = treat as skipped
  if (isEmpty) {
    return skipQuestionInternal(db, interviewId, payload.questionId, now, "SKIPPED");
  }

  const [deliveredQuestion] = await db
    .select({ createdAt: interviewQuestionsTable.createdAt })
    .from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.id, payload.questionId))
    .limit(1);
  const timeTakenSeconds = deliveredQuestion
    ? Math.max(0, Math.round((now.getTime() - deliveredQuestion.createdAt.getTime()) / 1000))
    : null;

  // Bump lastActivityAt on every real answer submission
  await db
    .update(interviewsTable)
    .set({ lastActivityAt: now })
    .where(eq(interviewsTable.id, interviewId));

  await db
    .update(interviewQuestionsTable)
    .set({ questionState: "ANSWERED" })
    .where(eq(interviewQuestionsTable.id, payload.questionId));

  const [answer] = await db
    .insert(interviewAnswersTable)
    .values({
      interviewId,
      questionId: payload.questionId,
      answerData: payload.answerData,
      answerType: payload.answerType,
      answeredAt: now,
      timeTakenSeconds,
    })
    .returning();

  // ── Evaluation pipeline ───────────────────────────────────────────────────
  // Run async — errors are logged but never propagate to the caller so the
  // answer submission HTTP/WS response is never blocked by AI latency.
  void (async () => {
    try {
      // ── Step 1: Evaluate the answer ───────────────────────────────────────
      const [question] = await db
        .select({
          questionTitle: interviewQuestionsTable.questionTitle,
          questionType: interviewQuestionsTable.questionType,
          sequenceNumber: interviewQuestionsTable.sequenceNumber,
        })
        .from(interviewQuestionsTable)
        .where(eq(interviewQuestionsTable.id, payload.questionId))
        .limit(1);

      if (!question) return;

      io?.to(`interview:${interviewId}`).emit("ai:status", {
        eventVersion: EVENT_VERSION,
        event: "ai:status",
        interviewId,
        questionId: payload.questionId,
        stage: "evaluating",
        timestamp: new Date().toISOString(),
      });

      const evalResult = await evaluateAnswer({
        interviewId,
        threadId: context.aiContext.threadId,
        questionId: payload.questionId,
        answerId: answer!.id,
        questionTitle: question.questionTitle,
        answerData: payload.answerData,
        answerType: payload.answerType,
      });

      // ── Step 2: Persist evaluation to answer row ──────────────────────────
      await db
        .update(interviewAnswersTable)
        .set({
          evaluationData: {
            score: evalResult.score,
            correctness: evalResult.correctness,
            relevance: evalResult.relevance,
            clarity: evalResult.clarity,
            technicalDepth: evalResult.technicalDepth,
            feedback: evalResult.feedback,
            strengths: evalResult.strengths,
            weaknesses: evalResult.weaknesses,
          },
          answerState: "EVALUATED",
        })
        .where(eq(interviewAnswersTable.id, answer!.id));

      await db
        .update(interviewQuestionsTable)
        .set({ questionState: "EVALUATED" })
        .where(eq(interviewQuestionsTable.id, payload.questionId));

      const emitEvaluationFeedback = (shouldAdvance: boolean) => {
        io?.to(`interview:${interviewId}`).emit("evaluation:feedback", {
          eventVersion: EVENT_VERSION,
          event: "evaluation:feedback",
          interviewId,
          questionId: payload.questionId,
          answerId: answer!.id,
          shouldAdvance,
          score: evalResult.score,
          correctness: evalResult.correctness,
          relevance: evalResult.relevance,
          clarity: evalResult.clarity,
          technicalDepth: evalResult.technicalDepth,
          feedback: evalResult.feedback,
          strengths: evalResult.strengths,
          weaknesses: evalResult.weaknesses,
          timestamp: new Date().toISOString(),
        });
      };

      // ── Step 3: Update performance state ─────────────────────────────────
      const historyEntry = {
        questionId: payload.questionId,
        questionTitle: question.questionTitle,
        questionType: question.questionType,
        sequenceNumber: question.sequenceNumber,
        wasAnswered: true,
        score: evalResult.score,
      };

      const newPerfState = updatePerformanceState(
        context.performanceState,
        evalResult,
        historyEntry,
      );

      // ── Step 4: Detect patterns + compute adaptation ──────────────────────
      const allQuestions = await db
        .select({
          questionId: interviewQuestionsTable.id,
          questionTitle: interviewQuestionsTable.questionTitle,
          questionType: interviewQuestionsTable.questionType,
          sequenceNumber: interviewQuestionsTable.sequenceNumber,
          questionState: interviewQuestionsTable.questionState,
        })
        .from(interviewQuestionsTable)
        .where(eq(interviewQuestionsTable.interviewId, interviewId))
        // sequenceNumber order keeps "most recent answered question" (pattern
        // detection) and the category balance correct.
        .orderBy(interviewQuestionsTable.sequenceNumber);

      const questionHistory = allQuestions.map((q) => ({
        questionId: q.questionId,
        questionTitle: q.questionTitle,
        questionType: q.questionType,
        sequenceNumber: q.sequenceNumber,
        wasAnswered: q.questionState === "ANSWERED" || q.questionState === "EVALUATED",
        score: q.questionId === payload.questionId ? evalResult.score : null,
      }));

      const detection = detectPatterns(newPerfState, questionHistory);
      // Wall-clock minutes since the session started. The adaptive engine uses it
      // for the hard duration ceiling and the soft wrap-up window.
      const elapsedMinutes = elapsedMinutesSince(context.timerStartedAt);
      const decision = computeAdaptation(
        newPerfState,
        detection,
        context.config,
        questionHistory,
        elapsedMinutes,
      );

      // ── Step 5: Persist updated context atomically ────────────────────────
      const updatedPerfState = { ...newPerfState, currentDifficulty: decision.hint.difficulty };
      const updatedContext: InterviewContext = {
        ...context,
        performanceState: updatedPerfState,
        adaptationHistory: [...context.adaptationHistory, decision],
      };
      await writeInterviewContext(updatedContext, context.config.durationMinutes);

      // ── Step 6: Handle terminate ──────────────────────────────────────────
      if (decision.action === "terminate") {
        emitEvaluationFeedback(false);
        logger.info(
          { interviewId, reason: decision.reason },
          "[adaptive] terminating interview early",
        );
        await endInterviewSystemService(interviewId);
        return; // no lookahead needed
      }

      // This event is the live client's canonical cue to advance. It is sent
      // only after adaptive termination has been ruled out.
      emitEvaluationFeedback(true);

      // ── Step 7: Discard stale lookahead on topic change ───────────────────
      if (decision.action === "new_topic") {
        await discardLookahead(interviewId);
      }

      // ── Step 8: Kick off lookahead for the next question ──────────────────
      void kickoffLookahead(interviewId, updatedContext, decision);
    } catch (err) {
      logger.error(
        { err, interviewId, questionId: payload.questionId },
        "[eval] evaluation pipeline failed",
      );
      // Best-effort fallback: still kick off lookahead so the next question isn't blocked
      void kickoffLookahead(interviewId, context);
    }
  })();

  return answer;
}

// ── detectAndTimeoutStaleQuestions ────────────────────────────────────────────
// Finds PENDING questions belonging to INPROGRESS interviews that started
// > QUESTION_TIMEOUT_MS ago and marks them TIMED_OUT.
export async function detectAndTimeoutStaleQuestions() {
  const db = getPgDb();
  const now = new Date();
  const threshold = new Date(now.getTime() - QUESTION_TIMEOUT_MS);

  // Find PENDING questions belonging to INPROGRESS interviews that started before the threshold
  const stale = await db
    .select({
      questionId: interviewQuestionsTable.id,
      interviewId: interviewQuestionsTable.interviewId,
    })
    .from(interviewQuestionsTable)
    .innerJoin(interviewsTable, eq(interviewQuestionsTable.interviewId, interviewsTable.id))
    .where(
      and(
        eq(interviewQuestionsTable.questionState, "PENDING"),
        eq(interviewsTable.interviewStatus, "INPROGRESS"),
        lt(interviewsTable.lastActivityAt, threshold),
      ),
    );

  if (stale.length === 0) return { timedOut: 0 };

  for (const { questionId, interviewId } of stale) {
    await skipQuestionInternal(db, interviewId, questionId, now, "TIMED_OUT");

    // Advance context so the next question:next generates fresh
    const ctx = await readInterviewContext(interviewId);
    if (ctx && ctx.questionState.currentQuestionId === questionId) {
      await writeInterviewContext(
        {
          ...ctx,
          questionState: { ...ctx.questionState, currentQuestionId: null },
        },
        ctx.config.durationMinutes,
      );
    }
  }

  return { timedOut: stale.length };
}

// Detects INPROGRESS interviews whose wall-clock duration has been exceeded and transitions them to TIMED_OUT
export async function detectAndTimeoutOverdueInterviews() {
  const db = getPgDb();
  const now = new Date();

  // interviewDuration is stored in minutes; find interviews where startedAt + duration < now
  const overdue = await db
    .select({
      id: interviewsTable.id,
      interviewDuration: interviewsTable.interviewDuration,
      interviewStartedAt: interviewsTable.interviewStartedAt,
    })
    .from(interviewsTable)
    .where(and(eq(interviewsTable.interviewStatus, "INPROGRESS")));

  const expired = overdue.filter((r) => {
    if (!r.interviewStartedAt) return false;
    const deadlineMs = r.interviewStartedAt.getTime() + r.interviewDuration * 60 * 1000;
    return now.getTime() >= deadlineMs;
  });

  if (expired.length === 0) return { timedOut: 0 };

  await db
    .update(interviewsTable)
    .set({ interviewStatus: "TIMED_OUT", lastActivityAt: now })
    .where(
      inArray(
        interviewsTable.id,
        expired.map((r) => r.id),
      ),
    );

  return { timedOut: expired.length };
}

// ── Request next question ─────────────────────────────────────────────────────
// Guards: interview must be INPROGRESS, current question must be in a completed
// state (ANSWERED | SKIPPED | TIMED_OUT | EVALUATED). Advances the index,
// clears currentQuestionId, then delegates to generateAndDeliverQuestionService.
export async function requestNextQuestionService(
  interviewId: string,
  userId: string,
  io: IoServer,
): Promise<void> {
  const context = await readInterviewContext(interviewId);
  if (!context) {
    throw new AppError(
      "Interview context not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.INTERVIEW_NOT_FOUND,
      { isOperational: true },
    );
  }

  const { currentQuestionId } = context.questionState;
  if (!currentQuestionId) {
    // No question has been delivered yet — just generate the first one
    await generateAndDeliverQuestionService(interviewId, io);
    return;
  }

  // Verify the current question is in a completed state
  const db = getPgDb();
  const [current] = await db
    .select({ questionState: interviewQuestionsTable.questionState })
    .from(interviewQuestionsTable)
    .where(eq(interviewQuestionsTable.id, currentQuestionId))
    .limit(1);

  const completedStates = ["ANSWERED", "SKIPPED", "TIMED_OUT", "EVALUATED"] as const;
  if (!current || !(completedStates as readonly string[]).includes(current.questionState)) {
    throw new AppError(
      "Current question is not yet completed",
      StatusCodes.CONFLICT,
      ErrorCodes.QUESTION_NOT_COMPLETED,
      { isOperational: true },
    );
  }

  // Reaching a user-selected question target is a natural completion, not a
  // manual early exit. The current index is zero-based, so index + 1 is the
  // just-completed question's sequence number.
  if (
    context.config.endingCriteria === "QUESTION_COUNT" &&
    context.config.questionCount !== undefined &&
    // A restored or retried context may already be beyond the target; it is
    // still a natural completion and must never generate another question.
    context.questionState.currentIndex + 1 >= context.config.questionCount
  ) {
    const completed = await endInterviewSystemService(interviewId);
    if (completed) {
      io.to(`interview:${interviewId}`).emit("interview:state_change", {
        eventVersion: EVENT_VERSION,
        event: "interview:state_change",
        interviewId,
        status: completed.interviewStatus,
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }

  // Advance index and clear currentQuestionId so generateAndDeliver creates a new one
  const advancedContext: InterviewContext = {
    ...context,
    questionState: {
      ...context.questionState,
      currentIndex: context.questionState.currentIndex + 1,
      currentQuestionId: null,
    },
  };
  await writeInterviewContext(advancedContext, context.config.durationMinutes);

  await generateAndDeliverQuestionService(interviewId, io);
}

// Called by the evaluation pipeline once an answer has been scored
export async function markQuestionEvaluatedService(questionId: string, answerId: string) {
  const db = getPgDb();
  await db
    .update(interviewQuestionsTable)
    .set({ questionState: "EVALUATED" })
    .where(eq(interviewQuestionsTable.id, questionId));
  const [answer] = await db
    .update(interviewAnswersTable)
    .set({ answerState: "EVALUATED" })
    .where(eq(interviewAnswersTable.id, answerId))
    .returning();
  return answer;
}

export async function getInterviewMetricsService(
  authreq: AuthenticatedRequest,
  interviewId: string,
) {
  const db = getPgDb();

  const [interview] = await db
    .select({
      id: interviewsTable.id,
      interviewStatus: interviewsTable.interviewStatus,
      interviewDuration: interviewsTable.interviewDuration,
      interviewQuestionsGeneratedCount: interviewsTable.interviewQuestionsGeneratedCount,
      interviewQuestionsAnsweredCount: interviewsTable.interviewQuestionsAnsweredCount,
      interviewStartedAt: interviewsTable.interviewStartedAt,
      createdAt: interviewsTable.createdAt,
      updatedAt: interviewsTable.updatedAt,
    })
    .from(interviewsTable)
    .where(
      and(
        eq(interviewsTable.id, interviewId),
        eq(interviewsTable.userId, authreq.auth.userId),
        notInArray(
          interviewsTable.interviewStatus,
          TERMINAL_STATUSES.filter((s) => s !== "COMPLETED"),
        ),
      ),
    );

  if (!interview) {
    throw new AppError(
      "Interview not found or not eligible for metrics",
      StatusCodes.NOT_FOUND,
      ErrorCodes.INTERVIEW_NOT_FOUND,
      { isOperational: true },
    );
  }

  if (interview.interviewStatus !== "COMPLETED") {
    throw new AppError(
      "Metrics are only available for completed interviews",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.INTERVIEW_INVALID_STATE,
      { isOperational: true },
    );
  }

  const [report] = await db
    .select()
    .from(interviewResultsTable)
    .where(eq(interviewResultsTable.interviewId, interviewId))
    .limit(1);

  return {
    interviewId: interview.id,
    status: interview.interviewStatus,
    duration: interview.interviewDuration,
    questionsGenerated: interview.interviewQuestionsGeneratedCount,
    questionsAnswered: interview.interviewQuestionsAnsweredCount,
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt,
    activeSeconds: interview.interviewStartedAt
      ? Math.max(0, Math.round((interview.updatedAt.getTime() - interview.interviewStartedAt.getTime()) / 1000))
      : 0,
    report: report ?? null,
  };
}
