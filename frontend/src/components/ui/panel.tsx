import { cn } from '@/lib/utils'

/**
 * The one boxed surface. Pages hand-roll `rounded-2xl border border-border
 * bg-card p-6` (dashboards) while the Card primitive uses rounded-xl plus a
 * shadow — two visual systems for the same concept, which is why surfaces drift.
 * Panel is the single definition; boxed content composes these sub-elements so
 * radius, border, depth and header treatment stop varying page to page.
 */
export function Panel({
  children,
  className,
  flush = false,
}: {
  children: React.ReactNode
  className?: string
  /** Set when children need to reach the edges (full-bleed tables/lists) — padding moves to the header instead. */
  flush?: boolean
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card',
        className,
      )}
    >
      {flush ? children : <div className="p-5 sm:p-6">{children}</div>}
    </section>
  )
}

/** Optional titled header row inside a Panel; the hairline separates it from the body. */
export function PanelHeader({
  title,
  aside,
  className,
}: {
  title: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-3',
        className,
      )}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      {aside ? <div className="flex items-center gap-2">{aside}</div> : null}
    </div>
  )
}

/**
 * The one meter. Dashboard, analytics and progress bars all animate now; before,
 * analytics bars eased while dashboard bars snapped. Render the empty meter
 * synchronously when the width is unknown so the fill transition runs when the
 * value lands.
 */
export function Meter({
  value,
  className,
  barClassName,
}: {
  /** 0–100; null/undefined renders an empty meter so the fill animates when the value arrives. */
  value?: number | null
  className?: string
  barClassName?: string
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={value == null ? undefined : Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 overflow-hidden rounded-full bg-secondary', className)}
    >
      <div
        className={cn('h-full rounded-full bg-primary transition-[width] duration-700 ease-out', barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
