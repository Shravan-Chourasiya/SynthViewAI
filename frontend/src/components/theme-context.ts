import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

export interface ThemeSnapshot {
  theme: Theme
  resolvedTheme: ResolvedTheme
}

export interface ThemeActions {
  setTheme: (theme: Theme) => void
  toggle: () => void
}

export const ThemeContext = createContext<ThemeActions | null>(null)

const listeners = new Set<() => void>()
let currentStorageKey = 'synthview-theme'

function readThemeFromStorage(): Theme {
  try {
    const stored = window.localStorage.getItem(currentStorageKey)
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  } catch {
    // Storage can be disabled; the document's pre-paint class remains authoritative.
  }
  return typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function createSnapshot(theme: Theme): ThemeSnapshot {
  return Object.freeze({ theme, resolvedTheme: resolveTheme(theme) })
}

let snapshot = createSnapshot(readThemeFromStorage())

export function getThemeSnapshot(): ThemeSnapshot {
  return snapshot
}

export function configureThemeStorageKey(storageKey: string): void {
  currentStorageKey = storageKey
  publishThemeSnapshot(createSnapshot(readThemeFromStorage()))
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishThemeSnapshot(next: ThemeSnapshot): void {
  if (snapshot.theme === next.theme && snapshot.resolvedTheme === next.resolvedTheme) return
  snapshot = Object.freeze(next)
  listeners.forEach((listener) => listener())
}

export function readStoredTheme(storageKey: string, fallback: Theme): Theme {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  } catch {
    // Use the configured default if storage is unavailable.
  }
  return fallback
}

export function useTheme() {
  const actions = useContext(ThemeContext)
  if (!actions) throw new Error('useTheme must be used inside <ThemeProvider>')
  const state = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeSnapshot)
  return useMemo(() => ({ ...state, ...actions }), [actions, state])
}
