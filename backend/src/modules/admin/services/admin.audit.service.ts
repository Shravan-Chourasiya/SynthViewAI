import { getPgDb } from "../../../db/postgres.init.js";
import { adminAuditLogTable } from "../schemas/admin.schema.js";
import { logger } from "../../../utils/logger.js";

/**
 * Writes to the admin audit trail.
 *
 * Kept apart from the feature that uses it so there is exactly one place that
 * knows how an entry is recorded — and so its failure mode is explicit.
 *
 * **Callers must treat a rejection as fatal to the request.** The only current
 * caller (interview-metrics.service.ts) refuses to return metrics when this
 * throws. An access decision that cannot be recorded is an access that should not
 * happen, and silently swallowing the error here would make the audit log look
 * complete while access went on unlogged.
 */

export type AdminAuditAction = "interview_metrics_viewed";

export interface AdminAuditEntry {
  adminId: string;
  /** Role held at the time of the action, so a later demotion cannot rewrite history. */
  adminRole: string;
  action: AdminAuditAction;
  /** Session the action concerned. */
  interviewId: string;
  /** Anonymized candidate reference — never a name, email or raw user id. */
  candidateRef?: string | null;
  ip?: string | null;
}

export async function recordAdminAudit(entry: AdminAuditEntry): Promise<void> {
  const db = getPgDb();

  await db.insert(adminAuditLogTable).values({
    adminId: entry.adminId,
    adminRole: entry.adminRole,
    action: entry.action,
    interviewId: entry.interviewId,
    candidateRef: entry.candidateRef ?? null,
    ip: entry.ip ?? null,
  });

  // Deliberately logged at info with the actor and subject only. The audit trail's
  // job is accountability for the access, and that is easier to act on from the
  // application log than from the table alone.
  logger.info(
    {
      event: "admin.audit",
      action: entry.action,
      adminId: entry.adminId,
      adminRole: entry.adminRole,
      interviewId: entry.interviewId,
      candidateRef: entry.candidateRef ?? undefined,
    },
    "[audit] admin action recorded",
  );
}
