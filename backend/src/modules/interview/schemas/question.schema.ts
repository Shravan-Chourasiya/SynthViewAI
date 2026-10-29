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
/** How the candidate is expected to answer: prose, or code in an editor. */
export const answerFormatEnum = pgEnum("answer_format", ["TEXT", "CODE"]);

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
   * Whether the candidate answers in prose or in a code editor.
   *
   * Defaulted rather than nullable: every existing row was a prose answer, and a
   * question whose format is unknown must still render as a text box — never as a
   * code editor the candidate cannot escape. Only TECHNICAL questions may be CODE
   * (enforced in the AI layer, see integrations/ai/answer-format.ts).
   */
  answerFormat: answerFormatEnum("answer_format").notNull().default("TEXT"),
  /**
   * Suggested language for a CODE answer (e.g. "python", "typescript"). Null for
   * TEXT questions, and nullable for CODE ones — a missing suggestion falls back to
   * the client's default language rather than blocking the question.
   */
  codeLanguage: varchar("code_language", { length: 32 }),
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
