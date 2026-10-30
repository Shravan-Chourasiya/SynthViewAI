import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/hooks/use-media-query'

export function CountUp({
  value,
  duration = 900,
  decimals = 0,
  className,
  suffix = '',
  prefix = '',
}: {
  value: number
  duration?: number
  decimals?: number
  className?: string
  suffix?: string
  prefix?: string
}) {
  const reduced = usePrefersReducedMotion()
  const [display, setDisplay] = useState(reduced ? value : 0)
  const frame = useRef<number>(0)

  useEffect(() => {
    if (reduced) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (value - from) * eased)
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [value, duration, reduced])

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  )
}
