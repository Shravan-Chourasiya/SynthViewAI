import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/stores/auth.store'
import { cn } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'

interface VerifyEmailFormProps {
  onSuccess: () => void
}

export function VerifyEmailForm({ onSuccess }: VerifyEmailFormProps) {
  const verifyOtp = useAuthStore((s) => s.verifyOtp)
  const pendingEmail = useAuthStore((s) => s.pendingEmail)
  const email = pendingEmail || ''
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle')
  const [cooldown, setCooldown] = useState(0)

  const code = digits.join('')

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const setDigit = (i: number, value: string) => {
    const ch = value.replace(/\D/g, '').slice(-1)
    setDigits((d) => d.map((x, idx) => (idx === i ? ch : x)))
    if (ch && i < 5) refs.current[i + 1]?.focus()
  }

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  const verify = async () => {
    if (state === 'loading') return
    if (code.length < 6) {
      notifyError('Please enter the full 6-digit code.')
      return
    }
    setState('loading')
    try {
      if (!email) {
        notifyError('Your registration email is missing. Please start registration again.')
        setState('idle')
        return
      }
      await verifyOtp(email, code)
      notifySuccess('Email verified successfully!')
      setState('success')
      setTimeout(() => onSuccess(), 900)
    } catch (err) {
      notifyError('Verification failed. Please try again.')
      setState('idle')
    }
  }

  if (state === 'success') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-(--signal-strong)/15 ring-1 ring-(--signal-strong)/30">
          <svg className="size-5 text-signal-strong" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22,4 12,14.01 9,11.01" />
          </svg>
        </span>
        <h2 className="text-2xl font-semibold tracking-tight">Email verified!</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your account has been successfully verified.
        </p>
        <div className="pt-2">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Verify your email</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Enter the 6-digit code sent to <span className="text-foreground font-medium">{email}</span></p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              maxLength={2}
              aria-label={`Digit ${i + 1}`}
              className={cn(
                'size-11 rounded-lg border border-input bg-background text-center font-mono text-lg font-semibold tabular-nums transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                d && 'border-primary/40',
              )}
            />
          ))}
        </div>

        <Button className="h-10 w-full" onClick={verify} disabled={state === 'loading'}>
          {state === 'loading' ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Verifying…
            </>
          ) : (
            'Verify Email'
          )}
        </Button>
      </div>
    </div>
  )
}