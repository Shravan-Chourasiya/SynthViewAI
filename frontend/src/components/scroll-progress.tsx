import { useLayoutEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { useMotion } from '@/components/motion-context'
import { useScrollProgress } from '@/hooks/use-scroll-progress'

/**
 * Hairline page-progress indicator pinned under the public nav.
 *
 * Scrubbed straight off the scroll position (no React state, no re-renders).
 * When Lenis is off, a plain scroll listener drives the same bar so the
 * indicator still works without motion.
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement | null>(null)
  const { resolvedMotion } = useMotion()
  const reduced = resolvedMotion === 'reduced'
  const fallback = useScrollProgress(!reduced)

  useLayoutEffect(() => {
    if (reduced) return
    const node = barRef.current
    if (!node) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        node,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          transformOrigin: 'left center',
          scrollTrigger: {
            trigger: document.documentElement,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.35,
          },
        },
      )
    })
    return () => ctx.revert()
  }, [reduced])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-16 z-40 h-px bg-transparent"
      data-print-hide
    >
      <div
        ref={barRef}
        className="h-px origin-left bg-primary/70"
        style={{
          transform: reduced ? `scaleX(${fallback})` : undefined,
          boxShadow: '0 0 12px color-mix(in oklab, var(--primary) 60%, transparent)',
        }}
      />
    </div>
  )
}
