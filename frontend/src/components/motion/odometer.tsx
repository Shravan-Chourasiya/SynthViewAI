import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * Mechanical digit roll. Each place value is a vertical strip of 0–9 that
 * translates to the target digit, so score numbers roll instead of snapping.
 */
export function Odometer({
  value,
  className,
  duration = 1100,
  pad = 0,
}: {
  value: number
  className?: string
  duration?: number
  pad?: number
}) {
  const reduced = usePrefersReducedMotion()
  const target = Math.round(value)
  const targetChars = String(Math.abs(target)).padStart(pad, '0').split('')
  const [shown, setShown] = useState(reduced ? target : 0)

  useEffect(() => {
    if (reduced) {
      setShown(target)
      return
    }
    const id = window.setTimeout(() => setShown(target), 80)
    return () => window.clearTimeout(id)
  }, [target, reduced])

  const shownChars = String(Math.abs(shown))
    .padStart(targetChars.length, '0')
    .split('')

  return (
    <span className={cn('inline-flex tabular-nums', className)}>
      <span className="sr-only">{target}</span>
      {target < 0 ? <span aria-hidden>-</span> : null}
      <span aria-hidden className="inline-flex">
        {targetChars.map((_, index) => {
          const place = Number(shownChars[index] ?? '0')
          return (
            <span
              key={index}
              className="relative inline-block overflow-hidden"
              style={{ height: '1em', width: '0.62em' }}
            >
              <span
                className="absolute inset-x-0 top-0 flex flex-col items-center"
                style={{
                  transform: `translateY(${-place}em)`,
                  transition: reduced ? 'none' : `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                  transitionDelay: `${index * 65}ms`,
                }}
              >
                {DIGITS.map((digit) => (
                  <span key={digit} className="flex items-center justify-center" style={{ height: '1em' }}>
                    {digit}
                  </span>
                ))}
              </span>
            </span>
          )
        })}
      </span>
    </span>
  )
}
