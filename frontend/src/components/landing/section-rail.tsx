import { useEffect, useState } from 'react'
import { useMotion } from '@/components/motion-context'
import { useSmoothScroll } from '@/components/motion/smooth-scroll-context'
import { cn } from '@/lib/utils'

export interface RailItem {
  id: string
  label: string
}

/**
 * Vertical section rail for long public pages: shows where you are in the page
 * and gets you anywhere in one click.
 *
 * The spy is a thin band at the middle of the viewport rather than a whole
 * section intersection, so the marker tracks the content you are actually
 * reading instead of jumping the moment a section edge appears.
 */
export function SectionRail({ items, className }: { items: RailItem[]; className?: string }) {
  const { scrollTo } = useSmoothScroll()
  const { resolvedMotion } = useMotion()
  const reduced = resolvedMotion === 'reduced'
  const [activeId, setActiveId] = useState(items[0]?.id ?? '')
  const [visible, setVisible] = useState(false)

  // Appear once the hero is behind you.
  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      setVisible(window.scrollY > 380)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const nodes = items
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node))
    if (!nodes.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        })
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [items])

  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId))
  const progress = items.length > 1 ? (activeIndex / (items.length - 1)) * 100 : 0

  return (
    <nav
      aria-label="Sections"
      data-print-hide
      className={cn(
        'pointer-events-none fixed top-1/2 right-6 z-40 hidden -translate-y-1/2 xl:block',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-auto relative flex flex-col items-end gap-1 transition-opacity duration-500',
          visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        {/* track */}
        <span aria-hidden className="absolute top-2 right-[5px] bottom-2 w-px bg-border" />
        <span
          aria-hidden
          className="absolute top-2 right-[5px] w-px bg-primary/60 transition-[height] duration-500 ease-out"
          style={{ height: `calc(${progress}% - 8px)` }}
        />

        {items.map((item) => {
          const active = item.id === activeId
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => (item.id === 'top' ? scrollTo(0, { duration: 1.1 }) : scrollTo(item.id, { offset: -72, duration: 1.1 }))}
              className="group relative flex items-center gap-3 py-1.5 pr-px pl-3"
            >
              <span
                className={cn(
                  'pointer-events-none absolute right-6 rounded-md border border-border bg-popover px-2 py-1 font-mono text-[10px] uppercase tracking-wider whitespace-nowrap text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100',
                  active && 'opacity-100',
                )}
              >
                {item.label}
              </span>
              <span
                aria-hidden
                className={cn(
                  'relative z-10 size-2.5 rounded-full border transition-all duration-300',
                  active
                    ? 'scale-110 border-primary bg-primary'
                    : 'border-border bg-background group-hover:border-primary/60',
                  reduced && 'transition-none',
                )}
              />
              <span className="sr-only">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
