import { pgTable, uuid, varchar, integer, pgEnum, jsonb, timestamp } from "drizzle-orm/pg-core";
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
  answerData: varchar("answer_data", { length: 5000 }).notNull(),
  answerType: answerTypeEnum("answer_type").notNull(),
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
