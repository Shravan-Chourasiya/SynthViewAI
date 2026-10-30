import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/stores/auth.store'
import { passwordIsValid } from '@/pages/auth/password-checklist'
import { ApiError } from '@/lib/http'
import { notifyError, notifySuccess } from '@/lib/notify'

export function RegisterForm({ onSuccess, showModeLink = true }: { onSuccess: (email: string) => void; showModeLink?: boolean }) {
    const register = useAuthStore((s) => s.register)
    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [usernameTouched, setUsernameTouched] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (loading) return
        if (!name.trim()) {
            notifyError('Please enter your name.')
            return
        }
        setUsernameTouched(true)
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            notifyError('Username must be 3-30 characters and contain only letters, numbers, or underscores.')
            return
        }
        if (!email.includes('@')) {
            notifyError('Please enter a valid email address.')
            return
        }
        if (!passwordIsValid(password)) {
            notifyError('Password does not meet the requirements below.')
            return
        }
        if (password !== confirm) {
            notifyError('Passwords do not match.')
            return
        }
        setLoading(true)
        try {
            await register(name.trim(), username.trim(), email.trim().toLowerCase(), password)
            notifySuccess('Account created successfully!')
            onSuccess(email.trim().toLowerCase())
        } catch (err) {
            if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
                const fields = (err.details as { fields?: { field?: string; message?: string }[] } | undefined)?.fields
                const errorMessage = fields?.length
                    ? fields.map((field) => `${field.field ? `${field.field}: ` : ''}${field.message ?? 'Invalid value'}`).join(' ')
                    : err.message
                notifyError(errorMessage)
            } else if (err instanceof ApiError && err.message.toLowerCase().includes('already exists')) {
                notifyError('An account with this email already exists. Please sign in instead.')
            } else {
                notifyError(err instanceof Error ? err.message : 'Unable to create your account. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
      <div className="mx-auto w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
          <p className="mt-2 text-base text-muted-foreground">
            Start practicing adaptive AI interviews today
          </p>
        </div>
        
        <form className="space-y-6" onSubmit={onSubmit} noValidate>
          <div className="grid grid-cols-1 gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-name">Full name</Label>
              <Input 
                id="register-name" 
                placeholder="Your name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                autoComplete="name"
                className="h-11"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-username">Username</Label>
              <Input 
                id="register-username" 
                placeholder="Choose a username" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                onBlur={() => setUsernameTouched(true)} 
                aria-invalid={usernameTouched && !/^[a-zA-Z0-9_]{3,30}$/.test(username)}
                autoComplete="username"
                className="h-11"
              />
              {usernameTouched && !/^[a-zA-Z0-9_]{3,30}$/.test(username) ? (
                <p className="text-xs text-destructive">
                  Username must be 3-30 characters and contain only letters, numbers, or underscores
                </p>
              ) : null}
            </div>
            
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-email">Email</Label>
              <Input 
                id="register-email" 
                type="email" 
                placeholder="you@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                autoComplete="email"
                className="h-11"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="register-password">Password</Label>
                <span className="group/info relative inline-flex">
                  <button 
                    type="button" 
                    aria-label="Show password requirements" 
                    className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Info className="size-3.5" />
                  </button>
                  <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover/info:opacity-100 group-focus-within/info:opacity-100">
                    Use at least 8 characters, including a number and both uppercase and lowercase letters
                  </span>
                </span>
              </div>
              <div>
                <Input 
                  id="register-password" 
                  type="password" 
                  placeholder="Create a password" 
                  className="h-11" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-confirm">Confirm password</Label>
              <div>
                <Input 
                  id="register-confirm" 
                  type="password" 
                  placeholder="Repeat password" 
                  value={confirm} 
                  onChange={(e) => setConfirm(e.target.value)} 
                  autoComplete="new-password"
                  className="h-11"
                />
              </div>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="mt-2 h-12 w-full text-base font-medium" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> 
                Creating account…
              </>
            ) : 'Create account'}
          </Button>
        </form>
        
        {showModeLink ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        ) : null}
      </div>
    )
}
