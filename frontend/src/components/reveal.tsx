import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { gsap } from '@/lib/gsap'
import { useMotion } from '@/components/motion-context'
import { cn } from '@/lib/utils'

/**
 * Scroll-triggered entrance, driven by GSAP ScrollTrigger.
 *
 * Two modes:
 *  - default — the wrapper itself rises and fades in once, when it reaches the
 *    trigger point;
 *  - `stagger` — direct children cascade instead, which is what most card
 *    grids, step lists and table rows want.
 *
 * Nothing is hidden in CSS: the "from" state only exists inside the tween, so
 * if the script never runs the content is simply there. Under reduced motion no
 * tween is created at all.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
  stagger,
  staggerSelector,
  y = 26,
  start = 'top 88%',
}: {
  children: ReactNode
  className?: string
  /** milliseconds before the tween starts */
  delay?: number
  as?: 'div' | 'section' | 'li' | 'article'
  /** milliseconds between children; switches to child-staggered mode */
  stagger?: number
  /** CSS selector (scoped to this element) whose matches cascade instead */
  staggerSelector?: string
  /** px of vertical travel */
  y?: number
  /** ScrollTrigger start string */
  start?: string
}) {
  const ref = useRef<HTMLElement | null>(null)
  const { resolvedMotion } = useMotion()
  const reduced = resolvedMotion === 'reduced'

  useLayoutEffect(() => {
    const node = ref.current
    if (!node || reduced) return

    const targets: Element[] =
      stagger === undefined
        ? [node]
        : staggerSelector
          ? Array.from(node.querySelectorAll(staggerSelector))
          : Array.from(node.children).filter((child) => child.nodeType === 1)
    if (!targets.length) return

    const ctx = gsap.context(() => {
      gsap.from(targets, {
        y,
        opacity: 0,
        duration: 0.7,
        delay: delay / 1000,
        stagger: (stagger ?? 0) / 1000,
        scrollTrigger: { trigger: node, start, once: true },
      })
    }, node)

    return () => ctx.revert()
    // `children` is deliberately absent: a new element identity every render
    // would revert and replay the entrance on unrelated re-renders.
  }, [reduced, delay, stagger, staggerSelector, y, start])

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={cn('min-w-0', className)}
    >
      {children}
    </Tag>
  )
}
