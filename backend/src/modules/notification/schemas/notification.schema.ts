import { pgTable, uuid, varchar, pgEnum, timestamp, index } from "drizzle-orm/pg-core";
import { dbNow } from "../../../utils/db.util.js";
import { usersTable } from "../../auth/schemas/user.schema.js";
import { interviewsTable } from "../../interview/schemas/interview.schema.js";

/**
 * Notification types are restricted to events the system already detects and
 * emails today (the two scheduled-interview reminders and the paused-interview
 * reminder). No type may be added here without a corresponding trigger point.
 */
export const notificationTypeEnum = pgEnum("notification_type", [
  "REMINDER_24H",
  "REMINDER_1H",
  "INTERVIEW_PAUSED",
]);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: varchar("body", { length: 550 }).notNull(),
    relatedInterviewId: uuid("related_interview_id").references(() => interviewsTable.id, {
      onDelete: "cascade",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(dbNow),
  },
  (t) => [index("notifications_user_created_at_idx").on(t.userId, t.createdAt)],
);
