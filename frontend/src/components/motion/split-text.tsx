import { useLayoutEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { useMotion } from '@/components/motion-context'
import { cn } from '@/lib/utils'

/**
 * Masked word-by-word reveal. Each word rises out of its own clipped box with a
 * slight rotateX, staggered left to right by GSAP.
 *
 * The mask markup stays (the clipping is what sells the effect); only the
 * animation is driven from script so it can be tuned per call site.
 */
export function SplitText({
  text,
  accent,
  className,
  delay = 0,
  stagger = 46,
  accentClassName = 'text-primary',
}: {
  text: string
  /** Rendered after `text` and coloured as the accent phrase. */
  accent?: string
  className?: string
  /** milliseconds before the first word */
  delay?: number
  /** milliseconds between words */
  stagger?: number
  accentClassName?: string
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const { resolvedMotion } = useMotion()
  const reduced = resolvedMotion === 'reduced'

  const words: { word: string; isAccent: boolean }[] = [
    ...text.split(' ').filter(Boolean).map((word) => ({ word, isAccent: false })),
    ...(accent ?? '').split(' ').filter(Boolean).map((word) => ({ word, isAccent: true })),
  ]

  useLayoutEffect(() => {
    const node = ref.current
    if (!node || reduced) return
    const targets = node.querySelectorAll('.sv-word')
    if (!targets.length) return

    const ctx = gsap.context(() => {
      gsap.from(targets, {
        yPercent: 118,
        rotateX: -42,
        opacity: 0,
        duration: 0.9,
        ease: 'power4.out',
        delay: delay / 1000,
        stagger: stagger / 1000,
      })
    }, node)

    return () => ctx.revert()
  }, [reduced, delay, stagger, text, accent])

  return (
    <span ref={ref} className={cn('inline', className)}>
      {words.map((item, index) => (
        <span key={`${item.word}-${index}`} className="sv-word-mask">
          <span className={cn('sv-word', item.isAccent && accentClassName)}>{item.word}</span>
          {index < words.length - 1 ? <span aria-hidden>&nbsp;</span> : null}
        </span>
      ))}
    </span>
  )
}
