import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The one heading block every page uses: a sentence-case h1, an optional lede,
 * and an optional right-aligned actions slot. Before this, each page rolled its
 * own header — some with a mono uppercase eyebrow above the title, some without —
 * which is the main reason the app read as inconsistent. The rule now:
 *
 *   - the top bar already names the section, so the h1 says what THIS page does
 *     ("Good morning, Ada." / "Interview history" / "Configure your interview"),
 *     not what the section is
 *   - mono uppercase is reserved for data (dates, counts, statuses); page headers
 *     are sans — that split is the typographic system of the app
 *   - actions sit on the same baseline row as the title on wide screens and wrap
 *     below it on small ones
 */
export function PageHeader({
  title,
  lede,
  actions,
  className,
}: {
  title: ReactNode
  /** One sentence of orientation under the title. Omit when the page is self-evident. */
  lede?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-pretty sm:text-3xl">{title}</h1>
        {lede ? (
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">{lede}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
