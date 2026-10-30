import type * as React from 'react'
import { cn } from '@/lib/utils'

/** "The one boxed surface" — every card on the app is built from this. */
export function Panel({
  className,
  flush = false,
  ...props
}: React.ComponentProps<'div'> & { flush?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card',
        !flush && 'p-5 sm:p-6',
        className,
      )}
      {...props}
    />
  )
}

export function PanelHeader({
  title,
  description,
  aside,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  title: React.ReactNode
  description?: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-border bg-secondary/40 px-5 py-3',
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  )
}

export function PanelBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5 sm:p-6', className)} {...props} />
}

export function PanelFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('border-t border-border bg-secondary/30 px-5 py-3', className)}
      {...props}
    />
  )
}
