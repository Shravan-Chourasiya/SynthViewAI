import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './use-media-query'

/** Page scroll progress as 0..1, rAF-throttled. */
export function useScrollProgress(enabled = true) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let raf = 0
    const measure = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [enabled])

  return progress
}

/**
 * Scroll-linked vertical parallax. The element drifts relative to how far it
 * sits from the viewport centre, written straight to `transform` (no renders).
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>(strength = 40) {
  const ref = useRef<T | null>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return

    let raf = 0
    const apply = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const viewport = window.innerHeight
      if (rect.bottom < -200 || rect.top > viewport + 200) return
      const centre = rect.top + rect.height / 2
      const offset = ((centre - viewport / 2) / viewport) * strength
      el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }

    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
      el.style.transform = ''
    }
  }, [reduced, strength])

  return ref
}

/** Keyboard shortcut matcher, e.g. ⌘K / Ctrl+K. */
export function useHotkey(
  match: (event: KeyboardEvent) => boolean,
  handler: (event: KeyboardEvent) => void,
) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (match(event)) {
        event.preventDefault()
        handler(event)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export function isCommandK(event: KeyboardEvent) {
  return event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)
}
