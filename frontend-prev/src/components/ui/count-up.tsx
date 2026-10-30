import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Counts a number up once when it mounts with a value, over 700ms using the
 * app's standard ease. Why: the hero numbers of the dashboard (average, best)
 * previously snapped to their final value while bars elsewhere animated —
 * the one element that is THE result of the work felt the least alive.
 * Runs once per mount (not on every prop change) so re-renders never restart
 * the motion, and renders `null` as an em dash like the rest of the app.
 * Respects prefers-reduced-motion by rendering the final value immediately.
 */
export function CountUp({
  value,
  className,
  suffix,
}: {
  value: number | null
  className?: string
  /** Rendered after the number, muted (e.g. "%"). */
  suffix?: string
}) {
  const [display, setDisplay] = useState<number | null>(null)
  const rafRef = useRef<number>(0)
  const doneRef = useRef(false)

  useEffect(() => {
    if (value == null || doneRef.current) return
    doneRef.current = true
    // All setState calls happen inside rAF callbacks, never synchronously in the
    // effect body. Reduced motion is handled by collapsing the duration to 0, so
    // the first frame lands on the final value with no motion.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduce ? 0 : 700
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
    const startedAt = performance.now()
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration)
      setDisplay(Math.round(easeOut(t) * value))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  if (value == null) return <span className={cn('text-muted-foreground', className)}>—</span>

  return (
    <span className={cn('tabular-nums', className)}>
      {display ?? value}
      {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
    </span>
  )
}
