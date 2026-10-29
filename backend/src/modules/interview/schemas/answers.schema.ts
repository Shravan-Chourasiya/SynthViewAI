import {
  pgTable,
  uuid,
  varchar,
  integer,
  pgEnum,
  jsonb,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { dbNow } from "../../../utils/db.util.js";
import { interviewsTable } from "./interview.schema.js";
import { interviewQuestionsTable } from "./question.schema.js";

export const answerTypeEnum = pgEnum("answer_type", ["TEXT", "AUDIO", "VIDEO"]);
export const answerStateEnum = pgEnum("answer_state", ["RECEIVED", "PERSISTED", "EVALUATED"]);

export const interviewAnswersTable = pgTable("interview_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .references(() => interviewsTable.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => interviewQuestionsTable.id, { onDelete: "cascade" }),
  /**
   * The candidate's answer: transcript text, a media URL, or the code itself.
   *
   * `text` rather than varchar because a code answer is routinely longer than the
   * 5,000 the old column allowed. The 20,000-character ceiling is enforced at the
   * submission boundary (modules/interview/answer-submission.ts) so it is one rule
   * for HTTP and WebSocket alike, and so an oversized payload is rejected with a
   * validation error before it reaches the database.
   */
  answerData: text("answer_data").notNull(),
  answerType: answerTypeEnum("answer_type").notNull(),
  /**
   * Language a code answer was written in (e.g. "python"). Null for prose answers,
   * and nullable for code too — a missing language must not block an otherwise
   * valid submission. Stored beside the code instead of being prefixed into it, so
   * the evaluator and any future runner can rely on the field.
   */
  answerLanguage: varchar("answer_language", { length: 32 }),
  answerState: answerStateEnum("answer_state").notNull().default("PERSISTED"),
  evaluationData: jsonb("evaluation_data").$type<{
    score: number;
    correctness: number;
    relevance: number;
    clarity: number;
    technicalDepth: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
  }>(),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  timeTakenSeconds: integer("time_taken_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(dbNow),
});
