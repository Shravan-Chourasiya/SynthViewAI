import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MailCheck } from 'lucide-react'
import { AuthLayout } from '@/components/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!email.includes('@')) {
      notifyError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    try {
      await api.requestPasswordReset(email)
      notifySuccess('Password reset link sent successfully!')
      setSent(true)
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Unable to send password reset link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="If that account exists, a reset link is on its way.">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
            <MailCheck className="size-5 text-primary" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sent to <span className="text-foreground">{email}</span>. The link
            expires in 15 minutes.
          </p>
          <Link to="/reset-password" state={{ email }} className="w-full">
            <Button variant="outline" className="h-10 w-full">
              Continue to password reset
            </Button>
          </Link>
          <Link to="/login" className="font-mono text-xs text-muted-foreground hover:text-foreground">
            ← Back to sign in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a secure reset link.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-10 w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending…
            </>
          ) : (
            'Send reset link'
          )}
        </Button>
      </form>
      <p className="mt-6 text-center">
        <Link to="/login" className="font-mono text-xs text-muted-foreground hover:text-foreground">
          ← Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}