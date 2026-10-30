import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PasswordCard } from '@/components/auth/password-card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { authService } from '@/lib/services'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const otp = searchParams.get('otp') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const mismatch = confirm.length > 0 && password !== confirm

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await authService.forgotPasswordVerify({ email, otp, newPassword: password, confirmPassword: confirm })
      toast.success('Password updated — sign in to continue')
      navigate('/login')
    } catch (err) {
      toast.error('Reset failed', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PasswordCard
      eyebrow="New password"
      title="Choose a new password."
      description="Make it something you have not used elsewhere. At least eight characters."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">Confirm password</Label>
          <Input
            id="reset-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
            required
          />
          {mismatch ? <p className="text-xs text-destructive">Passwords do not match.</p> : null}
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting || mismatch || password.length < 8}
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          {submitting ? 'Updating' : 'Update password'}
        </Button>
      </form>
    </PasswordCard>
  )
}
