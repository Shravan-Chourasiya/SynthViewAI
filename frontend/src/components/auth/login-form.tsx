import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { useAuthStore } from '@/lib/stores/auth.store'

export function LoginForm({ onSuccess, showModeLink = true }: { onSuccess: () => void; showModeLink?: boolean }) {
    const login = useAuthStore((s) => s.login)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [remember, setRemember] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [locked, setLocked] = useState(false)
    const [lockSeconds, setLockSeconds] = useState(0)
    const fails = useRef(0)

    useEffect(() => {
        if (!locked || lockSeconds <= 0) return
        const id = setTimeout(() => {
            if (lockSeconds === 1) setLocked(false)
            setLockSeconds((s) => s - 1)
        }, 1000)
        return () => clearTimeout(id)
    }, [locked, lockSeconds])

    const startLock = () => {
        fails.current = 0
        setLocked(true)
        setLockSeconds(10)
        setError('Too many failed attempts. Sign-in is rate-limited for a moment (FR-31).')
    }

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (loading || locked) return
        setError(null)
        if (!email.trim() || !password) {
            setError('Please enter both email and password.')
            return
        }
        setLoading(true)
        try {
            await login(email, password)
            onSuccess()
        } catch (err) {
            if (err instanceof ApiError && err.code === 'RATE_LIMITED') startLock()
            else {
                fails.current += 1
                if (fails.current >= 3) startLock()
                else setError('Invalid email or password. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30 shadow-[0_0_28px_-8px_var(--primary)]">
                <Lock className="size-5 text-primary" strokeWidth={1.75} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Sign in to continue your interview practice.</p>
            <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
                {error ? <Alert variant={locked ? 'warning' : 'destructive'} icon={locked ? <Lock className="size-4" /> : <AlertTriangle className="size-4" />}>{error}{locked ? ` (${lockSeconds}s)` : ''}</Alert> : null}
                <div className="flex flex-col gap-1.5"><Label htmlFor="login-email">Email</Label><Input id="login-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="login-password">Password</Label><div className="relative"><Input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" className="pr-10" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>
                <div className="flex items-center justify-between"><label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-3.5 accent-primary" />Keep me signed in</label><Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link></div>
                <Button type="submit" className="mt-1 h-10 w-full" disabled={loading || locked}>{loading ? <><Loader2 className="size-4 animate-spin" />Signing in…</> : locked ? `Locked (${lockSeconds}s)` : 'Sign in'}</Button>
            </form>
            {showModeLink ? <p className="mt-6 text-center text-xs text-muted-foreground">New here? <Link to="/register" className="font-medium text-primary hover:underline">Create an account</Link></p> : null}
        </div>
    )
}
