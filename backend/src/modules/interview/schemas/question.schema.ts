import { pgTable, uuid, varchar, integer, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { dbNow } from "../../../utils/db.util.js";
import { interviewsTable, interviewDifficultyEnum } from "./interview.schema.js";

export const questionTypeEnum = pgEnum("question_type", ["BEHAVIORAL", "TECHNICAL", "MIXED"]);
export const questionStateEnum = pgEnum("question_state", [
  "PENDING",
  "ANSWERED",
  "SKIPPED",
  "TIMED_OUT",
  "EVALUATED",
]);
export const timeoutBehaviorEnum = pgEnum("timeout_behavior", [
  "AUTO_SKIP",
  "EMPTY_SUBMIT",
  "PENALISE",
]);

export const interviewQuestionsTable = pgTable("interview_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .references(() => interviewsTable.id, { onDelete: "cascade" }),
  sequenceNumber: integer("sequence_number").notNull(),
  questionTitle: varchar("question_title", { length: 255 }).notNull(),
  questionDescription: varchar("question_description", { length: 550 }),
  questionType: questionTypeEnum("question_type").notNull(),
  /**
   * Difficulty in force when this question was generated — i.e. what the
   * adaptive engine had decided at that point, not the session's starting
   * difficulty.
   *
   * Persisted because it was previously only ever held in the Redis session
   * context (`performanceState.difficultyHistory`), which expires minutes after
   * the interview ends. That made "which difficulty was this question?"
   * unanswerable for any session viewed afterwards — including from the admin
   * metrics view, which is why the column exists.
   *
   * Nullable: questions asked before this column existed were never recorded.
   */
  questionDifficulty: interviewDifficultyEnum("question_difficulty"),
  questionState: questionStateEnum("question_state").notNull().default("PENDING"),
  timedOutAt: timestamp("timed_out_at", { withTimezone: true }),
  timeoutBehavior: timeoutBehaviorEnum("timeout_behavior"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(dbNow),
});
