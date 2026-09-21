import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  pgEnum,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { dbNow } from "../../../utils/db.util.js";
import { usersTable } from "../../auth/schemas/user.schema.js";

export const interviewStatusEnum = pgEnum("interview_status", [
  "DRAFT",
  "READY",
  "SCHEDULED",
  "INPROGRESS",
  "COMPLETED",
  "CANCELLED",
  "ABANDONED",
  "EXPIRED",
  "TIMED_OUT",
]);
export const interviewCompanyStyleEnum = pgEnum("interview_company_style", [
  "MANGOS",
  "FAANG",
  "MAANG",
  "STARTUP",
  "CUSTOM",
  // CUSTOM remains available for explicitly bespoke/internal styles; REGULAR is
  // the candidate-facing standard interview option with no culture slant.
  "REGULAR",
]);
export const interviewTypeEnum = pgEnum("interview_type", ["BEHAVIORAL", "TECHNICAL", "MIXED"]);
export const interviewVerdictEnum = pgEnum("interview_verdict", ["PASS", "FAIL", "INCONCLUSIVE"]);

export const interviewDifficultyEnum = pgEnum("interview_difficulty", ["EASY", "MEDIUM", "HARD"]);

export const interviewsTable = pgTable("interviews", {
  // Base fields
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  // Config fields (typed columns — stable scalars promoted out of jsonb)
  interviewTitle: varchar("interview_title", { length: 255 }).notNull(),
  interviewDescription: varchar("interview_description", { length: 550 }),
  interviewType: interviewTypeEnum("interview_type").notNull(),
  interviewCompanyStyle: interviewCompanyStyleEnum("interview_company_style").notNull(),
  interviewDifficulty: interviewDifficultyEnum("interview_difficulty").notNull().default("MEDIUM"),
  interviewDuration: integer("interview_duration").notNull(),

  // Dynamic metadata (jobRole, skills and end conditions — fields that vary per interview)
  interviewMetaData: jsonb("interview_meta_data")
    .$type<{
      jobRole?: string;
      domain?: string;
      experience?: string;
      jobSkills?: string[];
      targetedCompany?: string;
      maxFollowUps?: number;
      targetedCompanyOther?: string;
      endingCriteria?: "QUESTION_COUNT" | "DURATION";
      questionCount?: number;
      isAdaptive?: boolean;
    }>()
    .notNull(),

  // Status fields
  interviewStatus: interviewStatusEnum("interview_status").notNull().default("READY"),
  isInterviewScheduled: boolean("is_interview_scheduled").notNull().default(false),
  interviewScheduledDate: timestamp("interview_scheduled_date", { withTimezone: true }),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  interviewStartedAt: timestamp("interview_started_at", { withTimezone: true }),

  // Notification dedupe timestamps — stamped when a reminder has been queued so
  // the interval job cannot resend the same reminder on every tick. Timestamps
  // (not booleans) so we also know *when* each reminder went out.
  reminder24hSentAt: timestamp("reminder_24h_sent_at", { withTimezone: true }),
  reminder1hSentAt: timestamp("reminder_1h_sent_at", { withTimezone: true }),
  pausedReminderSentAt: timestamp("paused_reminder_sent_at", { withTimezone: true }),

  // Outcome fields
  interviewQuestionsGeneratedCount: integer("interview_questions_generated_count"),
  interviewQuestionsAnsweredCount: integer("interview_questions_answered_count"),
  interviewOutcome: jsonb("interview_outcome").$type<{
    finalScore: number;
    finalVerdict: "PASS" | "FAIL" | "INCONCLUSIVE";
    questionWiseScore: {
      questionId: string;
      score: number;
      answerId?: string;
    }[];
    finalFeedBack: string;
    suggestedImprovements?: string;
    helpfulResources?: string;
  }>(),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(dbNow),

  // TODO(codebox): Add isCodingInterview boolean and codingConfig jsonb columns here
  // once src/integrations/codebox is ready. codingConfig shape:
  //   { language: string; sandboxConfig?: Record<string, unknown> }
  // Requires a migration; the Zod schema (interview.zschema.ts) must be updated in the same PR.
});
