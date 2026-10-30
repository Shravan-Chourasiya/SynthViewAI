import { createContext, useContext } from 'react'
import type { MotionPreference, ResolvedMotion } from '@/lib/motion'

export interface MotionContextValue {
  /** What the visitor chose: full, reduced, or follow the OS. */
  motion: MotionPreference
  /** What is actually applied to `<html data-motion>`. */
  resolvedMotion: ResolvedMotion
  setMotion: (motion: MotionPreference) => void
  /** Flip between full and reduced, ignoring the OS hint. */
  toggleMotion: () => void
}

export const MotionContext = createContext<MotionContextValue | null>(null)

export function useMotion() {
  const context = useContext(MotionContext)
  if (!context) throw new Error('useMotion must be used inside <MotionProvider>')
  return context
}
