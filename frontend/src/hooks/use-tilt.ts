import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from './use-media-query'

/** Only run pointer-driven effects on devices with a real cursor. */
export function hasFinePointer() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
}

/**
 * 3D tilt driven by pointer position.
 *
 * Writes `transform` and the `--tilt-x/--tilt-y` glare variables directly on the
 * element inside one rAF loop with lerped values, so nothing re-renders React
 * and the motion stays smooth even on a busy page.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>({
  max = 8,
  lift = 12,
  base = 900,
}: { max?: number; lift?: number; base?: number } = {}) {
  const ref = useRef<T | null>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduced || !hasFinePointer()) return

    let raf = 0
    let targetX = 0
    let targetY = 0
    let targetZ = 0
    let currentX = 0
    let currentY = 0
    let currentZ = 0

    const render = () => {
      currentX += (targetX - currentX) * 0.12
      currentY += (targetY - currentY) * 0.12
      currentZ += (targetZ - currentZ) * 0.12
      el.style.transform = `perspective(${base}px) rotateX(${(-currentY * max).toFixed(2)}deg) rotateY(${(
        currentX * max
      ).toFixed(2)}deg) translateZ(${currentZ.toFixed(2)}px)`
      const settled =
        Math.abs(targetX - currentX) < 0.001 &&
        Math.abs(targetY - currentY) < 0.001 &&
        Math.abs(targetZ - currentZ) < 0.02
      raf = settled ? 0 : requestAnimationFrame(render)
    }

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(render)
    }

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const px = (event.clientX - rect.left) / rect.width
      const py = (event.clientY - rect.top) / rect.height
      targetX = px * 2 - 1
      targetY = py * 2 - 1
      el.style.setProperty('--tilt-x', `${(px * 100).toFixed(2)}%`)
      el.style.setProperty('--tilt-y', `${(py * 100).toFixed(2)}%`)
      kick()
    }

    const onEnter = () => {
      targetZ = lift
      kick()
    }

    const onLeave = () => {
      targetX = 0
      targetY = 0
      targetZ = 0
      kick()
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointerleave', onLeave)

    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
      el.style.transform = ''
    }
  }, [reduced, max, lift, base])

  return ref
}

/** Cursor-following highlight. Pair with the `sv-spotlight relative` classes. */
export function useSpotlight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--spot-x', `${(event.clientX - rect.left).toFixed(1)}px`)
      el.style.setProperty('--spot-y', `${(event.clientY - rect.top).toFixed(1)}px`)
    }
    el.addEventListener('pointermove', onMove)
    return () => el.removeEventListener('pointermove', onMove)
  }, [])

  return ref
}

/** Subtle magnetic pull toward the cursor, for primary actions. */
export function useMagnetic<T extends HTMLElement = HTMLElement>({
  strength = 0.26,
  max = 12,
}: { strength?: number; max?: number } = {}) {
  const ref = useRef<T | null>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduced || !hasFinePointer()) return

    let raf = 0
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0

    const render = () => {
      currentX += (targetX - currentX) * 0.18
      currentY += (targetY - currentY) * 0.18
      el.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`
      const settled = Math.abs(targetX - currentX) < 0.05 && Math.abs(targetY - currentY) < 0.05
      raf = settled ? 0 : requestAnimationFrame(render)
    }

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(render)
    }

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      targetX = Math.max(-max, Math.min(max, dx * strength))
      targetY = Math.max(-max, Math.min(max, dy * strength))
      kick()
    }

    const onLeave = () => {
      targetX = 0
      targetY = 0
      kick()
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)

    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
      el.style.transform = ''
    }
  }, [reduced, strength, max])

  return ref
}
