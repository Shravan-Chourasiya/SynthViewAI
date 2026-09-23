import { httpGet, httpPatch } from "../http";
import { ENDPOINTS } from "../constants/endpoints";

/**
 * In-app notification payloads mirror the backend `notifications` table row.
 * `relatedInterviewId` is present only for interview-scoped notifications.
 */
export interface NotificationItem {
  id: string;
  userId: string;
  type: "REMINDER_24H" | "REMINDER_1H" | "INTERVIEW_PAUSED";
  title: string;
  body: string;
  relatedInterviewId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  page: number;
  limit: number;
  total: number;
}

/**
 * Notification service — mirrors the service-module shape used by
 * `analytics.service.ts`. The http helpers unwrap the backend's
 * `{ success, data }` envelope, so these resolve to the payload itself.
 */
class NotificationService {
  /** GET /notifications — newest first, paginated, optional unread filter. */
  async getNotifications(page = 1, limit = 20, unreadOnly = false): Promise<NotificationListResponse> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      unreadOnly: String(unreadOnly),
    });
    return httpGet<NotificationListResponse>(`${ENDPOINTS.notifications.list}?${params.toString()}`);
  }

  /** PATCH /notifications/:id/read — marks one notification read. */
  async markNotificationRead(id: string): Promise<void> {
    await httpPatch(ENDPOINTS.notifications.read(id));
  }

  /** PATCH /notifications/read-all — marks every unread notification read. */
  async markAllNotificationsRead(): Promise<void> {
    await httpPatch(ENDPOINTS.notifications.readAll);
  }
}

export const notificationService = new NotificationService();
