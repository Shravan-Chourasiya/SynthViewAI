import { createContext, useContext } from 'react'

export interface SmoothScrollOptions {
  offset?: number
  duration?: number
  immediate?: boolean
}

export interface SmoothScrollValue {
  /** True while Lenis is driving the page (never under reduced motion). */
  smooth: boolean
  scrollTo: (target: number | string | HTMLElement, options?: SmoothScrollOptions) => void
}

export const SmoothScrollContext = createContext<SmoothScrollValue>({ smooth: false, scrollTo: () => {} })

/** Programmatic scrolling target — works with or without Lenis. */
export function useSmoothScroll() {
  return useContext(SmoothScrollContext)
}
