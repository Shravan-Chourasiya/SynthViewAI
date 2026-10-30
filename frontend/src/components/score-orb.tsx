import { Odometer } from '@/components/motion/odometer'
import type { SignalBand } from '@/lib/types'
import { cn } from '@/lib/utils'

const RING: Record<SignalBand, { stroke: string; text: string; glow: string }> = {
  strong: { stroke: 'stroke-signal-strong', text: 'text-signal-strong', glow: 'bg-signal-strong/25' },
  good: { stroke: 'stroke-signal-good', text: 'text-signal-good', glow: 'bg-signal-good/25' },
  vague: { stroke: 'stroke-signal-vague', text: 'text-signal-vague', glow: 'bg-signal-vague/25' },
  weak: { stroke: 'stroke-signal-weak', text: 'text-signal-weak', glow: 'bg-signal-weak/25' },
}

/**
 * A layered 3D score display: a solid arc for the score, plus two gyroscope
 * rings rotating on different axes around an odometer readout.
 */
export function ScoreOrb({
  score,
  band,
  size = 208,
  className,
  label = 'Overall score',
}: {
  score: number
  band: SignalBand
  size?: number
  className?: string
  label?: string
}) {
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const tone = RING[band]

  return (
    <div
      className={cn('relative shrink-0 place-items-center', className)}
      style={{ width: size, height: size, display: 'grid', perspective: '900px' }}
      role="img"
      aria-label={`${label}: ${score} out of 100`}
    >
      <span
        aria-hidden
        className={cn('absolute size-3/4 animate-breathe rounded-full blur-2xl', tone.glow)}
      />

      {/* rotating gyroscope rings */}
      <span
        aria-hidden
        className="absolute inset-0 animate-orbit-y rounded-full border border-dashed border-primary/25 [transform-style:preserve-3d]"
      />
      <span
        aria-hidden
        className="absolute inset-3 animate-orbit-x rounded-full border border-dotted border-signal-strong/30 [transform-style:preserve-3d]"
      />
      <span
        aria-hidden
        className="absolute inset-6 animate-orbit-y rounded-full border border-primary/10 [transform-style:preserve-3d] [animation-duration:22s] [animation-direction:reverse]"
      />

      {/* score arc */}
      <svg viewBox="0 0 120 120" className="absolute size-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="5" className="stroke-secondary" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className={tone.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, score)) / 100)}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>

      <span className="relative flex flex-col items-center">
        <span className={cn('flex items-baseline font-mono text-4xl font-semibold', tone.text)}>
          <Odometer value={score} />
        </span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          /100
        </span>
      </span>
    </div>
  )
}
