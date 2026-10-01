import { eq, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { StatusCodes } from "http-status-codes";
import { getPgDb } from "../../../db/postgres.init.js";
import { env } from "../../../config/env.js";
import { AppError } from "../../../utils/AppError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
import { interviewsTable } from "../../interview/schemas/interview.schema.js";
import { interviewQuestionsTable } from "../../interview/schemas/question.schema.js";
import { interviewAnswersTable } from "../../interview/schemas/answers.schema.js";
import { interviewResultsTable } from "../../interview/schemas/result.schema.js";
import { recordAdminAudit } from "./admin.audit.service.js";

/**
 * Admin interview metrics — scores and structure only.
 *
 * The rule this module exists to enforce: an admin may see *how a session was
 * scored*, never *what the candidate said*.
 *
 * Three properties make that hold, and all three are load-bearing:
 *
 *   1. The queries project named columns. `answerData` (the submitted text /
 *      transcript), `evaluationData` as a whole (it carries free-text `feedback`,
 *      `strengths` and `weaknesses`, any of which can quote the answer) and
 *      `interviews.interview_outcome` (it carries `finalFeedBack` and
 *      `suggestedImprovements`) are never selected. Only five *scalar* values are
 *      pulled out of the evaluation jsonb, via `->>`.
 *   2. `buildAdminInterviewMetrics` is the only code that shapes a response, and
 *      it builds fresh objects field by field. It never spreads a database row,
 *      so a future query that selects too much still cannot leak through it —
 *      there is a unit test that asserts exactly this.
 *   3. The candidate is referred to by a salted hash. The raw `user_id` is read
 *      (it is needed to derive that hash) and never returned.
 *
 * If you add a field, add it deliberately: it is part of a privacy promise, not
 * just an API shape.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type MetricsOutcome =
  | "completed"
  | "ended_early"
  | "time_expired"
  | "in_progress"
  | "not_started";

export interface AdminQuestionMetric {
  sequenceNumber: number;
  /** The interviewer's prompt. Explicitly allowed — it is not candidate data. */
  title: string;
  type: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  /** Null for questions asked before per-question difficulty was persisted. */
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  state: string;
  score: number | null;
  scores: {
    correctness: number | null;
    relevance: number | null;
    clarity: number | null;
    technicalDepth: number | null;
  };
  /** Seconds between the question being served and the answer being recorded. */
  timeTakenSeconds: number | null;
}

export interface AdminInterviewMetrics {
  session: {
    /** Session reference (the interview id) — not a candidate identifier. */
    ref: string;
    /** Stable, non-reversible handle for the same candidate across sessions. */
    candidateRef: string;
    title: string;
    status: string;
    outcome: MetricsOutcome;
    type: string;
    companyStyle: string;
    difficulty: string;
    durationMinutes: number;
    createdAt: Date;
    updatedAt: Date;
    startedAt: Date | null;
    jobRole: string | null;
    domain: string | null;
    targetedCompany: string | null;
    experienceLevel: string | null;
    /** Skill/subject tags chosen for the session (configuration, not answers). */
    topics: string[];
    adaptive: boolean;
    endingCriteria: string | null;
    questionTarget: number | null;
    /** Present only when the session was scored for a pass/fail decision. */
    verdict: string | null;
  };
  /** Null until a result row exists (session not finished, or unscored). */
  aggregate: {
    overallScore: number | null;
    technicalScore: number | null;
    communicationScore: number | null;
    problemSolvingScore: number | null;
    confidenceScore: number | null;
    questionsAnswered: number;
    questionsSkipped: number;
    questionsEvaluated: number;
    totalDurationSeconds: number;
  } | null;
  categoryBreakdown: {
    category: "BEHAVIORAL" | "TECHNICAL";
    questions: number;
    scored: number;
    averageScore: number | null;
  }[];
  /** Per-question difficulty in the order the questions were asked. */
  difficultyProgression: { sequenceNumber: number; difficulty: string | null }[];
  questions: AdminQuestionMetric[];
}

/** Exactly the interview fields the view needs — see the projection note above. */
export interface MetricsInterviewRow {
  id: string;
  userId: string;
  title: string;
  status: string;
  type: string;
  companyStyle: string;
  difficulty: string;
  durationMinutes: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  /** Configuration jsonb (jobRole/domain/skills/…). Whitelisted when read. */
  meta: Record<string, unknown> | null;
  verdict: string | null;
}

export interface MetricsQuestionRow {
  id: string;
  sequenceNumber: number;
  title: string;
  type: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  state: string;
  createdAt: Date;
}

export interface MetricsAnswerRow {
  questionId: string;
  answeredAt: Date | null;
  /** Persisted per-answer timing. Preferred over recomputing from timestamps. */
  timeTakenSeconds: number | null;
  /**
   * The score fields come back out of the evaluation jsonb as text, so they are
   * typed as `string | number | null` and normalised by `toScore` below. They are
   * only ever scores — the surrounding free text in that column is never read.
   */
  score: number | string | null;
  correctness: number | string | null;
  relevance: number | string | null;
  clarity: number | string | null;
  technicalDepth: number | string | null;
}

export interface MetricsResultRow {
  overallScore: number | string | null;
  technicalScore: number | string | null;
  communicationScore: number | string | null;
  problemSolvingScore: number | string | null;
  confidenceScore: number | string | null;
  questionsAnswered: number;
  questionsSkipped: number;
  questionsEvaluated: number;
  totalDuration: number;
}

// ── Anonymized candidate reference ────────────────────────────────────────────

/**
 * Derives the "same candidate, unknown identity" handle shown to admins.
 *
 * Salted with the server secret so the value cannot be recomputed from a user id
 * by anyone who only has ids (a bare SHA-256 of a uuid is trivially reproducible
 * by anyone who knows the uuid). Not reversible in practice, and stable across
 * sessions, which is what makes it useful: an admin can tell that two sessions
 * belong to the same person without learning who that person is.
 *
 * Rotating the secret changes every reference. That is accepted: the references
 * are display handles, and the audit log denormalises the one it was created
 * with so history stays readable.
 */
export function candidateReference(userId: string): string {
  const digest = createHash("sha256").update(`${userId}:${env.JWT_SECRET}`).digest("hex");
  return `C-${digest.slice(0, 10).toUpperCase()}`;
}

// ── Value coercion ────────────────────────────────────────────────────────────

/** Numeric columns arrive as strings from Postgres; jsonb scalars as text too. */
function toScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function outcomeOf(status: string): MetricsOutcome {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
    case "ABANDONED":
      return "ended_early";
    case "TIMED_OUT":
    case "EXPIRED":
      return "time_expired";
    case "INPROGRESS":
      return "in_progress";
    default:
      return "not_started";
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

// ── Shaping (pure) ────────────────────────────────────────────────────────────

/**
 * Builds the admin view model. Pure and exported so the privacy guarantee is
 * unit-testable without a database.
 *
 * Every field is copied explicitly. Do not introduce a spread of any input row:
 * that is the one change that would silently undo the redaction, and the test
 * fixture deliberately includes the forbidden fields to catch it.
 */
export function buildAdminInterviewMetrics(input: {
  interview: MetricsInterviewRow;
  questions: MetricsQuestionRow[];
  answers: MetricsAnswerRow[];
  result: MetricsResultRow | null;
}): AdminInterviewMetrics {
  const { interview, questions, answers, result } = input;

  // One answer per question: a question can accumulate a skip row and a real
  // answer, so the scored one wins regardless of ordering.
  const answerByQuestion = new Map<string, MetricsAnswerRow>();
  const answersInOrder = [...answers];
  for (const answer of answersInOrder) {
    const existing = answerByQuestion.get(answer.questionId);
    const better =
      !existing ||
      (existing.score === null && answer.score !== null) ||
      (existing.answeredAt === null && answer.answeredAt !== null);
    if (better) answerByQuestion.set(answer.questionId, answer);
  }

  const orderedQuestions = [...questions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const metrics: AdminQuestionMetric[] = orderedQuestions.map((question) => {
    const answer = answerByQuestion.get(question.id);
    // The stored duration is authoritative; the timestamp difference is the
    // fallback for rows written before it existed (or when a skip left it null).
    const timeTakenSeconds =
      answer?.timeTakenSeconds ??
      (answer?.answeredAt
        ? Math.max(0, Math.floor((answer.answeredAt.getTime() - question.createdAt.getTime()) / 1000))
        : null);

    return {
      sequenceNumber: question.sequenceNumber,
      title: question.title,
      type: question.type,
      difficulty: question.difficulty,
      state: question.state,
      score: toScore(answer?.score),
      scores: {
        correctness: toScore(answer?.correctness),
        relevance: toScore(answer?.relevance),
        clarity: toScore(answer?.clarity),
        technicalDepth: toScore(answer?.technicalDepth),
      },
      timeTakenSeconds,
    };
  });

  const categoryBreakdown = (["TECHNICAL", "BEHAVIORAL"] as const).map((category) => {
    const forCategory = metrics.filter((question) => question.type === category);
    const scored = forCategory.filter((question) => question.score !== null);
    const averageScore =
      scored.length > 0
        ? Math.round(
            (scored.reduce((sum, question) => sum + (question.score ?? 0), 0) / scored.length) * 100,
          ) / 100
        : null;
    return { category, questions: forCategory.length, scored: scored.length, averageScore };
  });

  const meta = interview.meta ?? {};

  return {
    session: {
      ref: interview.id,
      candidateRef: candidateReference(interview.userId),
      title: interview.title,
      status: interview.status,
      outcome: outcomeOf(interview.status),
      type: interview.type,
      companyStyle: interview.companyStyle,
      difficulty: interview.difficulty,
      durationMinutes: interview.durationMinutes,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt,
      startedAt: interview.startedAt,
      jobRole: stringOrNull(meta.jobRole),
      domain: stringOrNull(meta.domain),
      targetedCompany: stringOrNull(meta.targetedCompany) ?? stringOrNull(meta.targetedCompanyOther),
      experienceLevel: stringOrNull(meta.experience),
      topics: stringArray(meta.jobSkills),
      adaptive: meta.isAdaptive === true,
      endingCriteria: stringOrNull(meta.endingCriteria),
      questionTarget: typeof meta.questionCount === "number" ? meta.questionCount : null,
      verdict: interview.verdict,
    },
    aggregate: result
      ? {
          overallScore: toScore(result.overallScore),
          technicalScore: toScore(result.technicalScore),
          communicationScore: toScore(result.communicationScore),
          problemSolvingScore: toScore(result.problemSolvingScore),
          confidenceScore: toScore(result.confidenceScore),
          questionsAnswered: result.questionsAnswered,
          questionsSkipped: result.questionsSkipped,
          questionsEvaluated: result.questionsEvaluated,
          totalDurationSeconds: result.totalDuration,
        }
      : null,
    categoryBreakdown,
    difficultyProgression: metrics.map((question) => ({
      sequenceNumber: question.sequenceNumber,
      difficulty: question.difficulty,
    })),
    questions: metrics,
  };
}

// ── Data access ───────────────────────────────────────────────────────────────

/**
 * Reads a session and returns its metrics view model, recording the access.
 *
 * The audit entry is written before the payload is returned and is deliberately
 * **fail-closed**: if the entry cannot be stored, the view is refused. Serving
 * sensitive access that cannot be recorded would defeat the point of keeping the
 * log at all — and the log insert shares a database with the reads above, so a
 * failure here means the database is already in trouble.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAdminInterviewMetrics(input: {
  interviewId: string;
  adminId: string;
  adminRole: string;
  ip?: string | null;
}): Promise<AdminInterviewMetrics> {
  // A malformed id would otherwise reach Postgres and surface as a 500 on a
  // uuid cast. A bad reference is simply a session that does not exist.
  if (!UUID_PATTERN.test(input.interviewId)) {
    throw new AppError("Interview not found", StatusCodes.NOT_FOUND, ErrorCodes.INTERVIEW_NOT_FOUND, {
      isOperational: true,
    });
  }

  const db = getPgDb();

  const [interview] = await db
    .select({
      id: interviewsTable.id,
      // Needed only to derive the anonymized reference — never returned.
      userId: interviewsTable.userId,
      title: interviewsTable.interviewTitle,
      status: interviewsTable.interviewStatus,
      type: interviewsTable.interviewType,
      companyStyle: interviewsTable.interviewCompanyStyle,
      difficulty: interviewsTable.interviewDifficulty,
      durationMinutes: interviewsTable.interviewDuration,
      createdAt: interviewsTable.createdAt,
      updatedAt: interviewsTable.updatedAt,
      startedAt: interviewsTable.interviewStartedAt,
      meta: interviewsTable.interviewMetaData,
      // One scalar out of the outcome jsonb: the verdict. The rest of that column
      // is free text written for the candidate and is never read here.
      verdict: sql<string | null>`(${interviewsTable.interviewOutcome}->>'finalVerdict')`,
    })
    .from(interviewsTable)
    .where(eq(interviewsTable.id, input.interviewId))
    .limit(1);

  if (!interview) {
    throw new AppError("Interview not found", StatusCodes.NOT_FOUND, ErrorCodes.INTERVIEW_NOT_FOUND, {
      isOperational: true,
    });
  }

  const [questions, answers, results] = await Promise.all([
    db
      .select({
        id: interviewQuestionsTable.id,
        sequenceNumber: interviewQuestionsTable.sequenceNumber,
        title: interviewQuestionsTable.questionTitle,
        type: interviewQuestionsTable.questionType,
        difficulty: interviewQuestionsTable.questionDifficulty,
        state: interviewQuestionsTable.questionState,
        createdAt: interviewQuestionsTable.createdAt,
      })
      .from(interviewQuestionsTable)
      .where(eq(interviewQuestionsTable.interviewId, input.interviewId)),

    // Only five scalars are pulled out of the evaluation jsonb. Selecting the
    // column itself would bring `feedback`, `strengths` and `weaknesses` with it,
    // and any of those can quote the candidate's answer.
    db
      .select({
        questionId: interviewAnswersTable.questionId,
        answeredAt: interviewAnswersTable.answeredAt,
        timeTakenSeconds: interviewAnswersTable.timeTakenSeconds,
        score: sql<string | null>`(${interviewAnswersTable.evaluationData}->>'score')`,
        correctness: sql<string | null>`(${interviewAnswersTable.evaluationData}->>'correctness')`,
        relevance: sql<string | null>`(${interviewAnswersTable.evaluationData}->>'relevance')`,
        clarity: sql<string | null>`(${interviewAnswersTable.evaluationData}->>'clarity')`,
        technicalDepth: sql<string | null>`(${interviewAnswersTable.evaluationData}->>'technicalDepth')`,
      })
      .from(interviewAnswersTable)
      .where(eq(interviewAnswersTable.interviewId, input.interviewId)),

    db
      .select({
        overallScore: interviewResultsTable.overallScore,
        technicalScore: interviewResultsTable.technicalScore,
        communicationScore: interviewResultsTable.communicationScore,
        problemSolvingScore: interviewResultsTable.problemSolvingScore,
        confidenceScore: interviewResultsTable.confidenceScore,
        questionsAnswered: interviewResultsTable.questionsAnswered,
        questionsSkipped: interviewResultsTable.questionsSkipped,
        questionsEvaluated: interviewResultsTable.questionsEvaluated,
        totalDuration: interviewResultsTable.totalDuration,
      })
      .from(interviewResultsTable)
      .where(eq(interviewResultsTable.interviewId, input.interviewId))
      .limit(1),
  ]);

  const metrics = buildAdminInterviewMetrics({
    interview,
    questions,
    answers,
    result: results[0] ?? null,
  });

  await recordAdminAudit({
    adminId: input.adminId,
    adminRole: input.adminRole,
    action: "interview_metrics_viewed",
    interviewId: input.interviewId,
    candidateRef: metrics.session.candidateRef,
    ip: input.ip ?? null,
  });

  return metrics;
}
