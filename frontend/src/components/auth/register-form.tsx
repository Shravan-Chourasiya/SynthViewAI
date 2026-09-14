import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/stores/auth.store'
import { PasswordChecklist, passwordIsValid } from '@/pages/auth/password-checklist'
import { ApiError } from '@/lib/http'

export function RegisterForm({ onSuccess, showModeLink = true }: { onSuccess: (email: string) => void; showModeLink?: boolean }) {
    const register = useAuthStore((s) => s.register)
    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [usernameTouched, setUsernameTouched] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (loading) return
        setError(null)
        if (!name.trim()) return setError('Please enter your name.')
        setUsernameTouched(true)
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return setError('Username must be 3-30 characters and contain only letters, numbers, or underscores.')
        if (!email.includes('@')) return setError('Please enter a valid email address.')
        if (!passwordIsValid(password)) return setError('Password does not meet the requirements below.')
        if (password !== confirm) return setError('Passwords do not match.')
        setLoading(true)
        try {
            await register(name.trim(), username.trim(), email.trim().toLowerCase(), password)
            setDone(true)
        } catch (err) {
            if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
                const fields = (err.details as { fields?: { field?: string; message?: string }[] } | undefined)?.fields
                setError(fields?.length
                    ? fields.map((field) => `${field.field ? `${field.field}: ` : ''}${field.message ?? 'Invalid value'}`).join(' ')
                    : err.message)
            } else {
                setError(err instanceof Error ? err.message : 'Unable to create your account. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    if (done) return <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center"><span className="flex size-12 items-center justify-center rounded-full bg-(--signal-strong)/15 ring-1 ring-(--signal-strong)/30"><CheckCircle2 className="size-5 text-signal-strong" /></span><h2 className="text-2xl font-semibold tracking-tight">Account created</h2><p className="text-sm leading-relaxed text-muted-foreground">We sent a 6-digit verification code to <span className="text-foreground">{email}</span>.</p><Button className="h-10 w-full" onClick={() => onSuccess(email)}>Verify email</Button></div>

    return <div className="mx-auto w-full max-w-md"><h2 className="text-2xl font-semibold tracking-tight">Create your account</h2><p className="mt-2 text-base text-muted-foreground">Start practicing adaptive AI interviews today.</p><form className="mt-8 flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <div className="flex flex-col gap-1.5"><Label htmlFor="register-name">Full name</Label><Input id="register-name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="register-username">Username</Label><Input id="register-username" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} onBlur={() => setUsernameTouched(true)} aria-invalid={usernameTouched && !/^[a-zA-Z0-9_]{3,30}$/.test(username)} />{usernameTouched && !/^[a-zA-Z0-9_]{3,30}$/.test(username) ? <p className="text-xs text-destructive">Username must be 3-30 characters and contain only letters, numbers, or underscores.</p> : null}</div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="register-email">Email</Label><Input id="register-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="register-password">Password</Label><div className="relative"><Input id="register-password" type={showPassword ? 'text' : 'password'} placeholder="Create a password" className="pr-10" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div><PasswordChecklist value={password} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="register-confirm">Confirm password</Label><Input id="register-confirm" type={showPassword ? 'text' : 'password'} placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        <Button type="submit" className="mt-2 h-12 w-full text-base" disabled={loading}>{loading ? <><Loader2 className="size-4 animate-spin" />Creating account…</> : 'Create account'}</Button>
    </form>{showModeLink ? <p className="mt-5 text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></p> : null}</div>
}
