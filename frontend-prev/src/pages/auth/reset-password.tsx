import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { AuthLayout } from '@/components/auth-layout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, api } from '@/lib/api'
import { PasswordChecklist, PasswordRulesInfo, passwordIsValid } from './password-checklist'
import { notifyError, notifySuccess } from '@/lib/notify'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email ?? ''
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [expired, setExpired] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || expired) return
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
      if (!email) {
        notifyError('Your reset email is missing. Please request a new reset.')
        return
      }
      if (!/^\d{6}$/.test(otp)) {
        notifyError('Enter the 6-digit verification code.')
        return
      }
      await api.resetPassword(email, otp, password)
      notifySuccess('Password reset successfully!');
      navigate('/login')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AUTH_INVALID_CREDENTIALS') {
        setExpired(true)
        notifyError('This reset link has expired. Please request a new one.');
      } else {
        notifyError(err instanceof Error ? err.message : 'Unable to reset password.');
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a strong password you haven't used before.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {expired ? (
          <Alert variant="warning" icon={<AlertTriangle className="size-4" />}>
            This reset link has expired.{' '}
            <Link to="/forgot-password" className="font-medium underline underline-offset-2">
              Request a new one
            </Link>
            .
          </Alert>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otp">Verification code</Label>
          <Input id="otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <div>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <PasswordChecklist value={password} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <div>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" className="h-10 w-full" disabled={loading || expired}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Resetting…
            </>
          ) : (
            'Reset password'
          )}
        </Button>

      </form>
    </AuthLayout>
  )
}
