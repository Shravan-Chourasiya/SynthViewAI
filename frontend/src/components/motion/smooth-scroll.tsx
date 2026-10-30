import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { useMotion } from '@/components/motion-context'
import { SmoothScrollContext, type SmoothScrollValue } from './smooth-scroll-context'

/** Height of the fixed public nav, used to keep in-page anchors clear of it. */
const HEADER_OFFSET = -72

/**
 * Lenis smooth scrolling, driven by GSAP's ticker.
 *
 * Sharing one clock matters: Lenis emits scroll on its own rAF loop, so if
 * ScrollTrigger updated on the browser's scroll event instead, every scrub
 * tween would lag a frame behind the content it is pinned to.
 *
 * Skipped entirely under reduced motion — the page then scrolls natively and
 * every scrub-driven effect in the app is inert as well.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const { resolvedMotion } = useMotion()
  const smooth = resolvedMotion === 'full'
  const lenisRef = useRef<Lenis | null>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!smooth) return
    const lenis = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
      smoothWheel: true,
      autoRaf: false,
    })
    lenisRef.current = lenis

    const onScroll = () => ScrollTrigger.update()
    lenis.on('scroll', onScroll)

    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    // Radix locks the page behind a dialog, popover or select — via
    // `data-scroll-locked` plus an injected `overflow: hidden` rule, not an
    // inline style. Lenis writes scroll positions itself, so it sails straight
    // past that lock unless it is parked for the duration.
    const isLocked = () =>
      document.body.hasAttribute('data-scroll-locked') ||
      document.body.style.overflow === 'hidden' ||
      getComputedStyle(document.body).overflow === 'hidden'

    const syncLock = () => {
      if (isLocked()) lenis.stop()
      else lenis.start()
    }
    const lockWatcher = new MutationObserver(syncLock)
    lockWatcher.observe(document.body, { attributes: true, attributeFilter: ['style', 'data-scroll-locked'] })
    lockWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    syncLock()

    return () => {
      lockWatcher.disconnect()
      gsap.ticker.remove(tick)
      gsap.ticker.lagSmoothing(500, 33)
      lenis.off('scroll', onScroll)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [smooth])

  // In-page anchors glide, and land below the fixed nav instead of under it.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a[href^="#"]')
      if (!anchor) return
      const hash = anchor.getAttribute('href') ?? ''
      if (hash.length < 2) return
      const target = document.getElementById(hash.slice(1))
      if (!target) return
      event.preventDefault()
      if (lenisRef.current) {
        lenisRef.current.scrollTo(target, { offset: HEADER_OFFSET, duration: 1.1 })
      } else {
        // Reduced motion (or Lenis absent): jump, but still respect the offset.
        const top = target.getBoundingClientRect().top + window.scrollY + HEADER_OFFSET
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // New route: start at the top, then let ScrollTrigger re-measure the page.
  useEffect(() => {
    if (lenisRef.current) lenisRef.current.scrollTo(0, { immediate: true })
    else window.scrollTo({ top: 0, behavior: 'auto' })
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  const value = useMemo<SmoothScrollValue>(
    () => ({
      smooth,
      scrollTo: (target, options) => {
        // A bare section id is the common case here ("how-it-works"), and Lenis
        // only understands selectors, so resolve to an element first.
        const element =
          typeof target === 'string'
            ? (document.getElementById(target.replace(/^#/, '')) ?? document.querySelector(target))
            : target

        const lenis = lenisRef.current
        if (lenis) {
          lenis.scrollTo(element as number | string | HTMLElement, options)
          return
        }
        if (typeof element === 'number') {
          window.scrollTo({ top: element, behavior: 'auto' })
          return
        }
        if (element instanceof HTMLElement) {
          const top = element.getBoundingClientRect().top + window.scrollY + (options?.offset ?? 0)
          window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
        }
      },
    }),
    [smooth],
  )

  return <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>
}
