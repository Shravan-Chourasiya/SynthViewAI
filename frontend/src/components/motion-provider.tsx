import { useCallback, useEffect, useMemo, useState } from 'react'
import { MotionContext } from './motion-context'
import {
  applyMotion,
  readStoredMotion,
  resolveMotion,
  MOTION_STORAGE_KEY,
  type MotionPreference,
  type ResolvedMotion,
} from '@/lib/motion'

/** Reads what the pre-paint script already applied, so first render matches. */
function currentResolved(): ResolvedMotion {
  if (typeof document === 'undefined') return 'full'
  const attr = document.documentElement.dataset.motion
  if (attr === 'full' || attr === 'reduced') return attr
  return resolveMotion(readStoredMotion())
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [motion, setMotionState] = useState<MotionPreference>(() => readStoredMotion())
  const [resolvedMotion, setResolved] = useState<ResolvedMotion>(currentResolved)

  useEffect(() => {
    setResolved(applyMotion(motion))
    window.localStorage.setItem(MOTION_STORAGE_KEY, motion)
  }, [motion])

  // Only follow the OS while the preference is actually 'system'.
  useEffect(() => {
    if (motion !== 'system') return
    const list = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setResolved(applyMotion('system'))
    list.addEventListener('change', handler)
    return () => list.removeEventListener('change', handler)
  }, [motion])

  const setMotion = useCallback((next: MotionPreference) => setMotionState(next), [])

  const toggleMotion = useCallback(
    () => setMotionState(resolvedMotion === 'reduced' ? 'full' : 'reduced'),
    [resolvedMotion],
  )

  const value = useMemo(
    () => ({ motion, resolvedMotion, setMotion, toggleMotion }),
    [motion, resolvedMotion, setMotion, toggleMotion],
  )

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
}
