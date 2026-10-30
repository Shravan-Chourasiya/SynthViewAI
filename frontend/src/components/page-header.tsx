import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  lede,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode
  lede?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{eyebrow}</div>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {lede ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">{lede}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
