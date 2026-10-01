import { pgTable, uuid, varchar, timestamp, pgEnum, index } from "drizzle-orm/pg-core";

/**
 * Admin audit trail.
 *
 * Deliberately holds **no foreign keys**. An audit entry has to outlive the rows
 * it refers to: a candidate deleting their account cascades to their interviews,
 * and the record of which admin looked at that session must survive it. Both ids
 * are therefore plain uuids, and the human-meaningful reference is denormalised
 * beside them so an entry stays readable after the interview is gone.
 *
 * Nothing here may ever carry candidate content. Ids, the anonymized candidate
 * reference, the actor's role and the request origin are the entire payload —
 * see interview-metrics.service.ts, which is the only writer today.
 */

export const adminAuditActionEnum = pgEnum("admin_audit_action", [
  "interview_metrics_viewed",
]);

export const adminAuditLogTable = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Admin who performed the action. Not a FK — see the comment above. */
    adminId: uuid("admin_id").notNull(),
    /** Role the actor held at the time, so a later demotion cannot rewrite history. */
    adminRole: varchar("admin_role", { length: 32 }).notNull(),
    action: adminAuditActionEnum("action").notNull(),
    /** Session that was viewed. */
    interviewId: uuid("interview_id").notNull(),
    /** Anonymized candidate reference at the time of the action, not an identity. */
    candidateRef: varchar("candidate_ref", { length: 32 }),
    /** Request origin, from the trusted proxy chain (`trust proxy` is set in prod). */
    ip: varchar("ip", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // "What has this admin been looking at?" is the access-review query, so the
    // actor is the leading column.
    index("admin_audit_log_admin_created_at_idx").on(t.adminId, t.createdAt),
    index("admin_audit_log_interview_idx").on(t.interviewId),
  ],
);
