import { httpGet, httpPatch } from '../http'
import type { NotificationResponse } from '../api-types'

/**
 * Rows come straight from the `notifications` table: a reminder/paused `type`
 * enum and a nullable `readAt`, not the bell's `kind` + `read` pair
 * (backend/src/modules/notification/schemas/notification.schema.ts).
 */
interface BackendNotification {
  id: string
  type: 'REMINDER_24H' | 'REMINDER_1H' | 'INTERVIEW_PAUSED'
  title: string
  body: string
  relatedInterviewId: string | null
  readAt: string | null
  createdAt: string
}

interface BackendNotificationList {
  items: BackendNotification[]
  page: number
  limit: number
  total: number
}

function mapNotification(row: BackendNotification): NotificationResponse {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    // Every notification type the backend can create is interview-related
    // (two schedule reminders and the paused-session reminder), so all three
    // render under the "Session" kind in the bell.
    kind: 'interview',
    read: row.readAt != null,
    createdAt: row.createdAt,
  }
}

export const notificationService = {
  list: async (): Promise<NotificationResponse[]> => {
    const raw = await httpGet<BackendNotificationList>('/notifications')
    // Tolerate an unwrapped array so an older envelope cannot break the bell.
    const items = Array.isArray(raw) ? raw : (raw.items ?? [])
    return items.map(mapNotification)
  },

  readAll: (): Promise<void> => httpPatch('/notifications/read-all'),

  read: (id: string): Promise<void> => httpPatch(`/notifications/${id}/read`),
}
