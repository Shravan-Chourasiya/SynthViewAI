import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SignalBand } from '@/lib/types'
import { CountUp } from '@/components/ui/count-up'
import { useSpotlight } from '@/hooks/use-tilt'

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  index = 0,
  numeric,
  suffix,
  className,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  index?: number
  numeric?: boolean
  suffix?: string
  className?: string
}) {
  const spotRef = useSpotlight<HTMLDivElement>()

  return (
    <div
      ref={spotRef}
      className={cn(
        'sv-spotlight animate-rise-in relative isolate overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors duration-300 hover:border-primary/40',
        className,
      )}
      style={{ '--stagger-i': index } as React.CSSProperties}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
        <Icon className="size-4.5 text-primary" />
      </span>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {numeric && typeof value === 'number' ? <CountUp value={value} suffix={suffix} /> : value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

const BAND_CHIP: Record<SignalBand, string> = {
  strong: 'bg-signal-strong/10 text-signal-strong ring-signal-strong/25',
  good: 'bg-signal-good/10 text-signal-good ring-signal-good/25',
  vague: 'bg-signal-vague/10 text-signal-vague ring-signal-vague/25',
  weak: 'bg-signal-weak/10 text-signal-weak ring-signal-weak/25',
}

export function bandOf(score: number | null | undefined): SignalBand {
  if (score === null || score === undefined) return 'vague'
  if (score >= 82) return 'strong'
  if (score >= 70) return 'good'
  if (score >= 58) return 'vague'
  return 'weak'
}

/** Score chip coloured by band — used in timelines, tables and report strips. */
export function ScoreChip({
  score,
  className,
  size = 'default',
  showMax = true,
}: {
  score: number | null | undefined
  className?: string
  size?: 'sm' | 'default' | 'lg'
  showMax?: boolean
}) {
  if (score === null || score === undefined) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground ring-1 ring-border tabular-nums',
          className,
        )}
      >
        —
      </span>
    )
  }
  return (
    <span
      className={cn(
        'score-chip inline-flex items-center rounded-md font-mono tabular-nums ring-1',
        BAND_CHIP[bandOf(score)],
        size === 'sm' && 'px-1.5 py-0.5 text-[10px]',
        size === 'default' && 'px-2 py-0.5 text-[11px]',
        size === 'lg' && 'px-2.5 py-1 text-sm font-semibold',
        className,
      )}
    >
      {Math.round(score)}
      {showMax ? <span className="ml-0.5 opacity-60">/100</span> : null}
    </span>
  )
}
