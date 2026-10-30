import type { LiveStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const TONE: Record<LiveStatus, { core: string; ring: string; halo: string; speed: string }> = {
  idle: {
    core: 'from-muted-foreground/40 to-muted-foreground/5',
    ring: 'border-muted-foreground/25',
    halo: 'bg-muted-foreground/20',
    speed: '[animation-duration:18s]',
  },
  listening: {
    core: 'from-primary/80 to-primary/10',
    ring: 'border-primary/40',
    halo: 'bg-primary/30',
    speed: '[animation-duration:7s]',
  },
  evaluating: {
    core: 'from-signal-vague/80 to-signal-vague/10',
    ring: 'border-signal-vague/45',
    halo: 'bg-signal-vague/30',
    speed: '[animation-duration:3.4s]',
  },
  generating: {
    core: 'from-signal-strong/80 to-signal-strong/10',
    ring: 'border-signal-strong/45',
    halo: 'bg-signal-strong/30',
    speed: '[animation-duration:2.2s]',
  },
}

/**
 * The interviewer's presence: a glowing core wrapped in three gyroscope rings
 * that spin at a speed and colour matching what it is doing right now.
 */
export function AiOrb({ status, size = 128 }: { status: LiveStatus; size?: number }) {
  const tone = TONE[status]
  const active = status !== 'idle'

  return (
    <div
      aria-hidden
      className="relative grid place-items-center"
      style={{ width: size, height: size, perspective: '700px', display: 'grid' }}
    >
      <span
        className={cn(
          'absolute size-1/2 rounded-full blur-xl transition-colors duration-500',
          tone.halo,
          active && 'animate-breathe',
        )}
      />
      <span
        className={cn(
          'absolute inset-0 animate-orbit-y rounded-full border border-dashed [transform-style:preserve-3d] transition-colors duration-500',
          tone.ring,
          tone.speed,
        )}
      />
      <span
        className={cn(
          'absolute inset-2 animate-orbit-x rounded-full border [transform-style:preserve-3d] transition-colors duration-500',
          tone.ring,
          tone.speed,
        )}
        style={{ animationDirection: 'reverse' }}
      />
      <span
        className={cn(
          'absolute inset-4 animate-orbit-y rounded-full border border-dotted [transform-style:preserve-3d] transition-colors duration-500',
          tone.ring,
          tone.speed,
        )}
      />

      {/* core */}
      <span
        className={cn(
          'relative size-8 rounded-full bg-gradient-to-br ring-1 ring-inset ring-white/20 transition-all duration-500',
          tone.core,
          active && 'scale-110',
        )}
      />
      {status === 'listening' ? (
        <span className="absolute size-8 animate-ring-pulse rounded-full border border-primary/60" />
      ) : null}
    </div>
  )
}
