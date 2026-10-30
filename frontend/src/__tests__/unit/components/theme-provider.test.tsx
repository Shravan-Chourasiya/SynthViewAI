import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from '@/components/theme-provider'

let storedTheme: string | null = null
let mediaMatches = false
let mediaChange: ((event: MediaQueryListEvent) => void) | undefined
let frames: FrameRequestCallback[] = []

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: vi.fn(() => storedTheme),
    setItem: vi.fn((_key: string, value: string) => { storedTheme = value }),
  },
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn(() => ({
    get matches() { return mediaMatches },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((_event: string, listener: (event: MediaQueryListEvent) => void) => { mediaChange = listener }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')}>Set light</button>
      <button onClick={() => setTheme('system')}>Set system</button>
    </div>
  )
}

function renderProvider() {
  return render(<ThemeProvider><Probe /></ThemeProvider>)
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storedTheme = null
    mediaMatches = false
    mediaChange = undefined
    frames = []
    document.documentElement.className = 'dark'
    document.documentElement.dataset.theme = 'dark'
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
  })

  it('applies the pre-paint stored theme to html during initial layout', () => {
    storedTheme = 'light'
    renderProvider()

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).toHaveClass('light')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
  })

  it('applies a toggle before paint and removes transition suppression after two frames', () => {
    renderProvider()
    fireEvent.click(screen.getByRole('button', { name: 'Set light' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).toHaveClass('theme-switching')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
    expect(frames).toHaveLength(1)

    act(() => frames.shift()?.(0))
    expect(document.documentElement).toHaveClass('theme-switching')
    act(() => frames.shift()?.(16))
    expect(document.documentElement).not.toHaveClass('theme-switching')
  })

  it('persists the theme while remaining functional when storage is unavailable', () => {
    renderProvider()
    fireEvent.click(screen.getByRole('button', { name: 'Set light' }))
    expect(window.localStorage.setItem).toHaveBeenCalledWith('synthview-theme', 'light')

    vi.mocked(window.localStorage.setItem).mockImplementationOnce(() => { throw new Error('blocked') })
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Set system' }))).not.toThrow()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('follows system color-scheme changes when system mode is selected', () => {
    renderProvider()
    fireEvent.click(screen.getByRole('button', { name: 'Set system' }))
    expect(mediaChange).toBeTypeOf('function')

    mediaMatches = true
    act(() => mediaChange?.({} as MediaQueryListEvent))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveClass('theme-switching')
  })
})
