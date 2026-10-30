import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { gsap } from '@/lib/gsap'
import { useMotion } from '@/components/motion-context'
import { cn } from '@/lib/utils'

/**
 * Scroll-linked drift. The element travels `distance` px up (or down, with a
 * negative value) as it crosses the viewport, so layered artwork separates from
 * the content scrolling over it.
 *
 * Use it on a dedicated wrapper: it owns the element's `transform`.
 */
export function Parallax({
  children,
  className,
  distance = 48,
  scrub = 0.6,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  /** Total travel in px across the whole viewport pass. Negative drifts down. */
  distance?: number
  /** Seconds of catch-up. 0 tracks the scroll position exactly. */
  scrub?: number
  as?: 'div' | 'section' | 'article' | 'span'
}) {
  const ref = useRef<HTMLElement | null>(null)
  const { resolvedMotion } = useMotion()
  const reduced = resolvedMotion === 'reduced'

  useLayoutEffect(() => {
    const node = ref.current
    if (!node || reduced) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        node,
        { y: distance / 2 },
        {
          y: -distance / 2,
          ease: 'none',
          scrollTrigger: { trigger: node, start: 'top bottom', end: 'bottom top', scrub },
        },
      )
    }, node)
    return () => ctx.revert()
  }, [reduced, distance, scrub])

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={cn('will-change-transform', className)}
    >
      {children}
    </Tag>
  )
}
