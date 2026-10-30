import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { BrandMark, Wordmark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuthStore } from '@/lib/stores/auth-store'
import { cn } from '@/lib/utils'

export type AuthMode = 'login' | 'register' | 'verify'

// ── Shell ─────────────────────────────────────────────────────────────────────

function Shell({
  mode,
  onSwitch,
  children,
}: {
  mode: AuthMode
  onSwitch: (mode: AuthMode) => void
  children: ReactNode
}) {
  const [switching, setSwitching] = useState(false)

  const switchTo = (next: AuthMode) => {
    if (next === mode) return
    setSwitching(true)
    window.setTimeout(() => {
      onSwitch(next)
      setSwitching(false)
    }, 260)
  }

  const footer =
    mode === 'login'
      ? { prompt: "Don't have an account?", action: 'Sign up', next: 'register' as AuthMode }
      : mode === 'register'
        ? { prompt: 'Already have an account?', action: 'Sign in', next: 'login' as AuthMode }
        : { prompt: 'Wrong address?', action: 'Start over', next: 'register' as AuthMode }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-70" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 size-96 animate-ambient-drift rounded-full bg-primary/20 blur-3xl [animation-delay:-2s]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-32 size-[26rem] animate-ambient-drift rounded-full bg-signal-strong/10 blur-3xl [animation-delay:-6s]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/4 size-80 animate-ambient-drift rounded-full bg-primary/10 blur-3xl [animation-delay:-9s]"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <BrandMark className="size-9" />
          <Wordmark />
        </div>

        <div className="sv-conic-border relative animate-auth-card-in overflow-hidden rounded-3xl border border-border/70 bg-card/75 shadow-2xl shadow-black/20 backdrop-blur-2xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/8 to-primary/8"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25"
          />

          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-200',
              switching ? 'opacity-100' : 'opacity-0',
            )}
          >
            <span className="flex size-16 items-center justify-center rounded-2xl bg-background/90 shadow-lg ring-1 ring-primary/30">
              <BrandMark className="size-8" />
            </span>
          </div>

          <div
            className={cn(
              'relative transition-all duration-200',
              switching && 'scale-[0.97] opacity-30 blur-sm',
            )}
          >
            <div key={mode} className="animate-auth-flip-in p-6 sm:p-8">
              {children}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {footer.prompt}{' '}
          <button
            type="button"
            onClick={() => switchTo(footer.next)}
            className="rounded font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {footer.action}
          </button>
        </p>
      </div>
    </div>
  )
}

// ── Login panel ───────────────────────────────────────────────────────────────

function LoginPanel() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed'
      setError(msg)
      toast.error('Sign in failed', { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Sign in</p>
        <h1 className="text-xl font-semibold tracking-tight">Pick up where you left off.</h1>
        <p className="text-sm text-muted-foreground">Your sessions, scores and reports are waiting.</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link
              to="/forgot-password"
              className="rounded text-xs text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {submitting ? 'Signing in…' : 'Sign in'}
          {!submitting ? <ArrowRight className="size-4" /> : null}
        </Button>
      </form>
    </div>
  )
}

// ── Register panel ────────────────────────────────────────────────────────────

function RegisterPanel({ onSwitch }: { onSwitch: (m: AuthMode) => void }) {
  const register = useAuthStore((s) => s.register)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await register(name, username, email, password)
      toast.success('Account created — check your inbox for the verification code')
      onSwitch('verify')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      setError(msg)
      toast.error('Registration failed', { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Create account</p>
        <h1 className="text-xl font-semibold tracking-tight">Start your first interview.</h1>
        <p className="text-sm text-muted-foreground">Free while in preview. No card, no recruiter.</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reg-name">Full name</Label>
          <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Okonkwo" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-username">Username</Label>
          <Input
            id="reg-username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
            placeholder="ada.o"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-email">Email</Label>
          <Input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-password">Password</Label>
          <Input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </div>

        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 size-4 rounded border-input accent-primary"
            required
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" className="text-primary hover:underline">terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-primary hover:underline">privacy policy</Link>.
          </span>
        </label>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {submitting ? 'Creating account…' : 'Create account'}
          {!submitting ? <ArrowRight className="size-4" /> : null}
        </Button>
      </form>
    </div>
  )
}

// ── Verify panel ──────────────────────────────────────────────────────────────

function VerifyPanel({ onSwitch }: { onSwitch: (m: AuthMode) => void }) {
  const verifyOtp = useAuthStore((s) => s.verifyOtp)
  const pendingEmail = useAuthStore((s) => s.pendingEmail)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => { inputRef.current?.focus() }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingEmail) return
    setSubmitting(true)
    setError(null)
    try {
      await verifyOtp(pendingEmail, code)
      setDone(true)
      toast.success('Email verified — you can now sign in')
      window.setTimeout(() => {
        onSwitch('login')
        navigate('/login', { replace: true })
      }, 1500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed'
      setError(msg)
      toast.error('Verification failed', { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Verify email</p>
        <h1 className="text-xl font-semibold tracking-tight">Confirm it&apos;s really you.</h1>
        <p className="text-sm text-muted-foreground">
          We sent a six-digit code to your inbox. Paste it below to finish setting up.
        </p>
      </header>

      {pendingEmail ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/25">
            <Mail className="size-4 text-primary" />
          </span>
          <p className="font-mono text-[11px] text-muted-foreground truncate">{pendingEmail}</p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          placeholder="000000"
          aria-label="Verification code"
          className="h-12 text-center font-mono text-lg tracking-[0.5em] tabular-nums"
        />

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={code.length !== 6 || submitting || done}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {done ? 'Verified ✓' : submitting ? 'Verifying…' : 'Verify email'}
        </Button>
      </form>

      {done ? (
        <div className="flex items-center gap-2 rounded-xl border border-signal-strong/30 bg-signal-strong/5 px-3 py-2.5 text-sm">
          <CheckCircle2 className="size-4 text-signal-strong" />
          <span>Email confirmed. Redirecting to sign in…</span>
        </div>
      ) : null}
    </div>
  )
}

// ── AuthPage ──────────────────────────────────────────────────────────────────

export function AuthPage({ initialMode = 'login' }: { initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const navigate = useNavigate()

  const switchMode = (next: AuthMode) => {
    setMode(next)
    if (next === 'register') navigate('/register', { replace: true })
    else if (next === 'login') navigate('/login', { replace: true })
  }

  return (
    <Shell mode={mode} onSwitch={switchMode}>
      {mode === 'login' ? <LoginPanel /> : null}
      {mode === 'register' ? <RegisterPanel onSwitch={switchMode} /> : null}
      {mode === 'verify' ? <VerifyPanel onSwitch={switchMode} /> : null}
    </Shell>
  )
}
