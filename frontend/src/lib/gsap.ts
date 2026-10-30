import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Single registration point for GSAP + plugins.
 *
 * Import `gsap` and `ScrollTrigger` from here rather than from the package
 * directly so the plugin is only registered once, defaults stay consistent, and
 * swapping the scroll source (see `motion/smooth-scroll.tsx`) stays a one-line
 * change.
 */
gsap.registerPlugin(ScrollTrigger)

gsap.defaults({ ease: 'power3.out', duration: 0.7 })

// Mobile browsers fire resize when the URL bar collapses; re-measuring on every
// one of those makes pinned/scrubbed scenes jump.
ScrollTrigger.config({ ignoreMobileResize: true })

if (import.meta.env.DEV) {
  // Debug handle: `__sv.gsap.ticker.frame` answers "is the ticker running?"
  // and `__sv.gsap.globalTimeline.paused()` answers "why is nothing moving?".
  ;(window as unknown as { __sv?: { gsap: typeof gsap; ScrollTrigger: typeof ScrollTrigger } }).__sv = {
    gsap,
    ScrollTrigger,
  }
}

export { gsap, ScrollTrigger }
