import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { PasswordCard } from '@/components/auth/password-card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { authService } from '@/lib/services'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await authService.forgotPassword({ email })
      setSent(true)
      toast.success('If that address is registered, a reset code is on its way')
    } catch {
      // Never reveal whether the address exists — keep the form for a retry.
      toast.error('Could not send the reset link', {
        description: 'Check your connection and try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PasswordCard
      eyebrow="Reset password"
      title="We'll email you a link."
      description="Enter the address you signed up with and we will send a one-time reset link."
    >
      {sent ? (
        <div className="rounded-xl border border-signal-strong/30 bg-signal-strong/5 px-4 py-3 text-sm">
          If <span className="font-mono text-[12px]">{email}</span> is registered, the link is on its way. It
          expires in 30 minutes.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitting ? 'Sending' : 'Send reset link'}
          </Button>
        </form>
      )}
    </PasswordCard>
  )
}
