import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import getPgDb from "../../../db/postgres.init.js";
import { logger } from "../../../utils/logger.js";
import { AppError } from "../../../utils/AppError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
import { notificationsTable } from "../schemas/notification.schema.js";
import type { notificationTypeEnum } from "../schemas/notification.schema.js";

export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

interface CreateNotificationPayload {
  title: string;
  body: string;
  relatedInterviewId?: string | null;
}

/**
 * Creates one in-app notification row. Called *alongside* the existing email
 * sends in the reminder jobs — email behaviour is untouched; this only adds a
 * parallel persistence path. Failures must never break the caller: the email
 * path and the reminder dedupe stamps are already committed by the time this
 * runs, and a missed in-app notification is strictly less important than a
 * broken reminder job.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: CreateNotificationPayload,
): Promise<void> {
  try {
    await getPgDb()
      .insert(notificationsTable)
      .values({
        userId,
        type,
        title: payload.title,
        body: payload.body,
        relatedInterviewId: payload.relatedInterviewId ?? null,
      });
  } catch (error) {
    // Logged, never thrown — see the docstring.
    logger.error({ userId, type, err: error }, "createNotification failed");
  }
}

/**
 * GET /notifications — the authenticated user's own notifications, newest first.
 */
export async function listNotifications(
  userId: string,
  query: { page: number; limit: number; unreadOnly: boolean },
) {
  const db = getPgDb();
  const offset = (query.page - 1) * query.limit;

  const where = query.unreadOnly
    ? and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt))
    : eq(notificationsTable.userId, userId);

  const [items, [countRow]] = await Promise.all([
    db
      .select()
      .from(notificationsTable)
      .where(where)
      .orderBy(desc(notificationsTable.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(notificationsTable).where(where),
  ]);

  return {
    items,
    page: query.page,
    limit: query.limit,
    total: countRow?.total ?? 0,
  };
}

/**
 * PATCH /notifications/:id/read — marks one notification read. A notification
 * owned by someone else is indistinguishable from one that does not exist
 * (404, not 403) so ownership is not leaked.
 */
export async function markNotificationRead(userId: string, notificationId: string) {
  const db = getPgDb();
  const [updated] = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.id, notificationId), eq(notificationsTable.userId, userId)))
    .returning();

  if (!updated) {
    throw new AppError(
      "Notification not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.RESOURCE_NOT_FOUND,
      { isOperational: true },
    );
  }
  return updated;
}

/**
 * PATCH /notifications/read-all — marks every unread notification of the user read.
 */
export async function markAllNotificationsRead(userId: string) {
  const db = getPgDb();
  const updated = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt)))
    .returning({ id: notificationsTable.id });
  return { updated: updated.length };
}
