import * as Popover from '@radix-ui/react-popover'
import { Bell, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUiStore, useUnreadCount } from '@/lib/stores/ui-store'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<string, string> = {
  interview: 'Session',
  report: 'Report',
  system: 'System',
}

export function NotificationBell() {
  const notifications = useUiStore((s) => s.notifications)
  const markRead = useUiStore((s) => s.markRead)
  const markAllRead = useUiStore((s) => s.markAllRead)
  const unread = useUnreadCount()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className="relative text-muted-foreground"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-[9px] font-semibold text-primary-foreground tabular-nums">
              {unread}
            </span>
          ) : null}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Notifications
            </span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 rounded font-mono text-[10px] uppercase tracking-wider text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Check className="size-3" />
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto" data-lenis-prevent>
            {notifications.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => markRead(item.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60"
                >
                  <span
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      item.read ? 'bg-border' : 'bg-primary',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                        {formatRelative(item.createdAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {item.body}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      {KIND_LABEL[item.kind] ?? item.kind}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
