import type { ReactNode } from 'react'
import { useMagnetic } from '@/hooks/use-tilt'
import { cn } from '@/lib/utils'

/** Wraps a primary action so it drifts slightly toward the cursor. */
export function Magnetic({
  children,
  className,
  strength,
  max,
}: {
  children: ReactNode
  className?: string
  strength?: number
  max?: number
}) {
  const ref = useMagnetic<HTMLSpanElement>({ strength, max })
  return (
    <span ref={ref} className={cn('inline-flex will-change-transform', className)}>
      {children}
    </span>
  )
}
