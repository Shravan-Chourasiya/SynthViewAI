export type MotionPreference = 'full' | 'reduced' | 'system'
export type ResolvedMotion = 'full' | 'reduced'

export const MOTION_STORAGE_KEY = 'synthview-motion'

/**
 * Default is `full`.
 *
 * The OS "reduce motion" flag is treated as a hint the visitor opts into with
 * `system`, not a switch that silently strips the product's motion design —
 * on Windows that flag is a global Explorer setting, so honouring it blindly
 * turns every animation off for reasons that have nothing to do with this app.
 * `reduced` stays one click away in Settings → Preferences and the palette.
 */
export const DEFAULT_MOTION: MotionPreference = 'full'

export function systemPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isMotionPreference(value: unknown): value is MotionPreference {
  return value === 'full' || value === 'reduced' || value === 'system'
}

export function readStoredMotion(): MotionPreference {
  if (typeof window === 'undefined') return DEFAULT_MOTION
  const stored = window.localStorage.getItem(MOTION_STORAGE_KEY)
  return isMotionPreference(stored) ? stored : DEFAULT_MOTION
}

export function resolveMotion(preference: MotionPreference): ResolvedMotion {
  if (preference === 'system') return systemPrefersReducedMotion() ? 'reduced' : 'full'
  return preference
}

/** Writes the resolved value to `<html data-motion>` and returns it. */
export function applyMotion(preference: MotionPreference): ResolvedMotion {
  const resolved = resolveMotion(preference)
  if (typeof document !== 'undefined') document.documentElement.dataset.motion = resolved
  return resolved
}

/**
 * Single source of truth for code that decides whether to animate: prefers the
 * attribute the pre-paint script already set, and falls back to the stored
 * preference when the provider has not mounted yet.
 */
export function shouldReduceMotion(): boolean {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.dataset.motion
    if (attr === 'reduced' || attr === 'full') return attr === 'reduced'
  }
  return resolveMotion(readStoredMotion()) === 'reduced'
}
