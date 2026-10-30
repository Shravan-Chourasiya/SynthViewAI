import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { configureThemeStorageKey, ThemeContext, publishThemeSnapshot, readStoredTheme, resolveTheme, type Theme } from './theme-context'
export { useTheme } from './theme-context'

const STORAGE_KEY = 'synthview-theme'
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
let transitionGeneration = 0

function applyRootTheme(theme: Theme) {
  const root = document.documentElement
  const resolvedTheme = resolveTheme(theme)
  root.classList.toggle('dark', resolvedTheme === 'dark')
  root.classList.toggle('light', resolvedTheme === 'light')
  root.dataset.theme = resolvedTheme
  publishThemeSnapshot({ theme, resolvedTheme })
}

function withoutThemeTransitions(commit: () => void) {
  const root = document.documentElement
  const generation = ++transitionGeneration
  root.classList.add('theme-switching')
  commit()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (generation === transitionGeneration) root.classList.remove('theme-switching')
    })
  })
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = STORAGE_KEY,
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(storageKey, defaultTheme))

  // The pre-paint script handles reloads; layout effects are the only runtime
  // path that changes the document theme, before the browser can paint a toggle.
  useIsomorphicLayoutEffect(() => {
    configureThemeStorageKey(storageKey)
    applyRootTheme(theme)
    try {
      window.localStorage.setItem(storageKey, theme)
    } catch {
      // The in-memory and document theme still work when persistence is unavailable.
    }
  }, [theme, storageKey])

  useIsomorphicLayoutEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => withoutThemeTransitions(() => applyRootTheme('system'))
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    withoutThemeTransitions(() => setThemeState(next))
  }, [])

  const toggle = useCallback(() => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
    setTheme(next)
  }, [setTheme])

  const value = useMemo(() => ({ setTheme, toggle }), [setTheme, toggle])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
