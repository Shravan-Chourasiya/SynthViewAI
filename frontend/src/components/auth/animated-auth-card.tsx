import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '@/components/brand-mark'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'

export type AuthMode = 'login' | 'register'

type AnimatedAuthCardProps = {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  loginSlot: ReactNode
  registerSlot: ReactNode
  showModeSwitcher?: boolean
}

function AuthPanel({ active, children, label }: { active: boolean; children: ReactNode; label: string }) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (panel) (panel as HTMLDivElement & { inert: boolean }).inert = !active
  }, [active])

  return (
    <div
      ref={panelRef}
      aria-hidden={!active}
      aria-label={label}
      className={cn(
        'absolute inset-x-0 top-0 w-full px-6 py-8 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-10 sm:py-10',
        active
          ? 'pointer-events-auto translate-x-0 scale-100 opacity-100 animate-auth-flip-in'
          : 'pointer-events-none translate-x-8 scale-95 opacity-0',
      )}
    >
      {children}
    </div>
  )
}

/** A single glass auth card modeled on the supplied design, using the app's real forms. */
export function AnimatedAuthCard({
  mode,
  onModeChange,
  loginSlot,
  registerSlot,
  showModeSwitcher = true,
}: AnimatedAuthCardProps) {
  const loginActive = mode === 'login'
  const [switching, setSwitching] = useState(false)
  const switchTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => () => {
    if (switchTimer.current) window.clearTimeout(switchTimer.current)
  }, [])

  // /login and /register render the same route component, so reset the outgoing
  // state once navigation has supplied the incoming mode.
  useEffect(() => {
    setSwitching(false)
  }, [mode])

  const switchMode = (nextMode: AuthMode) => {
    if (switching || nextMode === mode) return
    setSwitching(true)
    switchTimer.current = window.setTimeout(() => onModeChange(nextMode), 280)
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[12%] -top-[12%] size-[45vw] rounded-full bg-primary/20 blur-3xl animate-ambient-drift" />
        <div className="absolute -bottom-[16%] -right-[12%] size-[52vw] rounded-full bg-signal-strong/10 blur-3xl animate-ambient-drift [animation-delay:-4s]" />
        <div className="absolute left-[45%] top-[42%] size-[28vw] rounded-full bg-primary/10 blur-3xl animate-ambient-drift [animation-delay:-8s]" />
      </div>

      <header className="relative z-10 mx-auto flex h-18 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5" aria-label="SynthView home">
          <BrandMark className="size-9 drop-shadow-lg" />
          <span className="text-[15px] font-semibold tracking-tight">SynthView <span className="text-primary">AI</span></span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-14 pt-5">
        <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/70 bg-card/75 shadow-2xl shadow-black/25 backdrop-blur-2xl">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-primary/5" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25" />

          <div className={cn('relative transition-[height,transform,opacity,filter] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]', loginActive ? 'h-[33rem]' : 'h-[40rem]', switching && 'scale-90 opacity-0 blur-sm')} style={{ transformStyle: 'preserve-3d' }}>
            <AuthPanel active={loginActive} label="Sign in form">{loginSlot}</AuthPanel>
            <AuthPanel active={!loginActive} label="Create account form">{registerSlot}</AuthPanel>
          </div>

          <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-all duration-300', switching ? 'scale-100 opacity-100' : 'scale-50 opacity-0')}>
            <span className="relative flex size-20 items-center justify-center rounded-3xl bg-primary/15 ring-1 ring-primary/30 shadow-[0_0_45px_-10px_var(--primary)]"><BrandMark className="size-11" /></span>
          </div>

          {showModeSwitcher ? (
            <div className="relative z-10 border-t border-border/60 px-6 py-5 text-center text-sm text-muted-foreground sm:px-10">
              {loginActive ? (
                <>Don&apos;t have an account? <button type="button" onClick={() => switchMode('register')} className="font-semibold text-primary transition-colors hover:text-primary/75 hover:underline">Sign up</button></>
              ) : (
                <>Already have an account? <button type="button" onClick={() => switchMode('login')} className="font-semibold text-primary transition-colors hover:text-primary/75 hover:underline">Sign in</button></>
              )}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}
