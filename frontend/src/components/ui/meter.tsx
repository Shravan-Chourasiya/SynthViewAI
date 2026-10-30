import { useEffect, useRef, useState } from 'react'
import { useMotion } from '@/components/motion-context'
import { cn } from '@/lib/utils'

export function Meter({
  value,
  max = 100,
  className,
  fillClassName,
  label,
  tone = 'primary',
  animate = true,
}: {
  /** 0..100 by default */
  value: number
  max?: number
  className?: string
  fillClassName?: string
  label?: string
  tone?: 'primary' | 'strong' | 'good' | 'vague' | 'weak'
  /** Fill from zero the first time the bar is scrolled into view. */
  animate?: boolean
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const { resolvedMotion } = useMotion()
  const reduced = resolvedMotion === 'reduced'
  const ref = useRef<HTMLDivElement | null>(null)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!animate || reduced) {
      setArmed(true)
      return
    }
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setArmed(true)
        observer.disconnect()
      },
      { threshold: 0.35 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [animate, reduced])

  const toneClass: Record<'primary' | 'strong' | 'good' | 'vague' | 'weak', string> = {
    primary: 'bg-primary',
    strong: 'bg-signal-strong',
    good: 'bg-signal-good',
    vague: 'bg-signal-vague',
    weak: 'bg-signal-weak',
  }

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-700 ease-out',
          toneClass[tone],
          fillClassName,
        )}
        style={{ width: `${armed ? pct : 0}%`, transitionDelay: armed ? '80ms' : '0ms' }}
      />
    </div>
  )
}
