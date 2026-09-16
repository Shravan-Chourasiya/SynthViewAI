import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { flushSync } from 'react-dom'

type Theme = 'dark' | 'light'
type ThemeOrigin = { x: number; y: number }
type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown
}

type ThemeContextValue = {
  theme: Theme
  toggleTheme: (origin?: ThemeOrigin) => void
  setTheme: (theme: Theme, origin?: ThemeOrigin) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'synthview-theme'
let transitionTimer: ReturnType<typeof window.setTimeout> | undefined

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'covering' | 'revealing'>('idle')
  const [transitionColor, setTransitionColor] = useState('transparent')
  const [transitionOrigin, setTransitionOrigin] = useState<ThemeOrigin>({ x: 0, y: 0 })
  const [transitionRadius, setTransitionRadius] = useState(0)

  // Sync with whatever the no-flash inline script already applied.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
    const initial: Theme =
      stored ?? (document.documentElement.classList.contains('light')
        ? 'light'
        : 'dark')
    setThemeState(initial)
    applyTheme(initial)
  }, [])

  const setTheme = useCallback((next: Theme, origin?: ThemeOrigin) => {
    if (next === theme) return
    const commitTheme = () => {
      setThemeState(next)
      applyTheme(next)
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore write failures (private mode, etc.)
      }
    }

    const root = document.documentElement
    const fallbackOrigin = { x: window.innerWidth - 44, y: 44 }
    const resolvedOrigin = origin ?? fallbackOrigin
    const radius = Math.hypot(
      Math.max(resolvedOrigin.x, window.innerWidth - resolvedOrigin.x),
      Math.max(resolvedOrigin.y, window.innerHeight - resolvedOrigin.y),
    ) + 2

    // Chromium's View Transition API snapshots the real old and new page. This
    // avoids the solid-color frame produced by an overlay at the end of a wipe.
    const viewTransitionDocument = document as ViewTransitionDocument
    if (typeof viewTransitionDocument.startViewTransition === 'function') {
      root.style.setProperty('--theme-origin-x', `${resolvedOrigin.x}px`)
      root.style.setProperty('--theme-origin-y', `${resolvedOrigin.y}px`)
      root.style.setProperty('--theme-radius', `${radius}px`)
      viewTransitionDocument.startViewTransition(() => flushSync(commitTheme))
      return
    }

    // Read the next theme's color without painting it yet. The overlay then grows
    // from the actual toggle position over the still-visible current page.
    applyTheme(next)
    const nextBackground = getComputedStyle(document.documentElement)
      .getPropertyValue('--background')
      .trim()
    applyTheme(theme)
    const oldBackground = getComputedStyle(document.documentElement)
      .getPropertyValue('--background')
      .trim()
    flushSync(() => {
      setTransitionColor(nextBackground || oldBackground)
      setTransitionOrigin(resolvedOrigin)
      setTransitionRadius(radius)
      setTransitionPhase('covering')
    })
    window.requestAnimationFrame(() => {
      setTransitionPhase('revealing')
      if (transitionTimer) window.clearTimeout(transitionTimer)
      transitionTimer = window.setTimeout(() => {
        // Commit while the final pixels are still covered, then remove the
        // overlay on the following paint so no solid-color flash is visible.
        flushSync(commitTheme)
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => setTransitionPhase('idle'))
        })
      }, 960)
    })
  }, [theme])

  const toggleTheme = useCallback((origin?: ThemeOrigin) => {
    setTheme(theme === 'dark' ? 'light' : 'dark', origin)
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
      {transitionPhase !== 'idle' ? <div aria-hidden="true" className={`theme-transition-layer${transitionPhase === 'revealing' ? ' is-revealing' : ''}`} style={{ backgroundColor: transitionColor, '--theme-origin-x': `${transitionOrigin.x}px`, '--theme-origin-y': `${transitionOrigin.y}px`, '--theme-radius': `${transitionRadius}px` } as React.CSSProperties} /> : null}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
