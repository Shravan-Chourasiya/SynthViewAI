import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
        <Icon className="size-5 text-primary" />
      </span>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function ErrorState({
  code,
  title,
  body,
  actions,
  className,
}: {
  code?: string
  title: string
  body?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-h-[60vh] flex-col items-center justify-center px-6 text-center', className)}>
      {code ? (
        <span className="font-mono text-6xl font-semibold tracking-tight text-primary/30 sm:text-7xl">
          {code}
        </span>
      ) : null}
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {body ? (
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty">{body}</p>
      ) : null}
      {actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  )
}
