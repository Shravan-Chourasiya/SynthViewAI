import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { notificationService, type NotificationItem } from '@/lib/services/notification.service'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Top-bar notification bell (doc 07, Task B).
 *
 * The app has no Popover/DropdownMenu primitive — its anchored-panel convention
 * is the `<details>`/button + absolutely-positioned panel used by ExportMenu in
 * `pages/interviews/shared.tsx`, so the bell follows that instead of
 * introducing a new primitive. Updates arrive via a 60-second poll: the
 * Socket.IO connection is scoped to live interviews and must not be repurposed.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    try {
      // One request covers both numbers: the badge uses `total` of the unread
      // filter, the panel shows the newest page. Two states, one round-trip.
      const [list, unreadList] = await Promise.all([
        notificationService.getNotifications(1, 10),
        notificationService.getNotifications(1, 1, true),
      ])
      setItems(list.items)
      setUnread(unreadList.total)
    } catch {
      // The bell is a secondary element — fail silent, keep the last state.
    }
  }, [])

  // Initial fetch + 60s poll. Only while the shell is mounted; the fetch is
  // best-effort, so no error surface is needed here. The initial fetch goes
  // through a macrotask so no state update happens synchronously in the effect.
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), 60_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [refresh])

  // Dismiss on outside click / Escape, matching the shell's other overlays.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function markRead(item: NotificationItem) {
    if (!item.readAt) {
      // Optimistic flip; refetch reconciles if the request fails.
      setItems((current) =>
        current.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
      )
      setUnread((count) => Math.max(0, count - 1))
      try {
        await notificationService.markNotificationRead(item.id)
      } catch {
        void refresh()
      }
    }
    if (item.relatedInterviewId) {
      setOpen(false)
      navigate(`/interviews/${item.relatedInterviewId}/report`)
    }
  }

  async function markAllRead() {
    setItems((current) => current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    setUnread(0)
    try {
      await notificationService.markAllNotificationsRead()
    } catch {
      void refresh()
    }
  }

  const unreadCount = unread

  return (
    <div ref={containerRef} className="relative" data-notifications-root>
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold leading-none text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="animate-fade-in absolute right-0 z-40 mt-2 w-80 rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-sm text-muted-foreground">
                You're all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void markRead(item)}
                      className={cn(
                        'flex w-full flex-col gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-accent',
                        !item.readAt && 'bg-primary/5',
                      )}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {!item.readAt ? (
                            <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                          ) : null}
                          <span className={cn('truncate text-sm', item.readAt ? 'font-normal text-muted-foreground' : 'font-medium')}>
                            {item.title}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          {timeAgo(item.createdAt)}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {item.body}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        ) : null}
    </div>
  )
}
