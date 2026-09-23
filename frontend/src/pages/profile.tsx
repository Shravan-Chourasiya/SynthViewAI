import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2, Monitor } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores/auth.store'
import { fmtDate } from '@/lib/format'
import { PasswordRulesInfo, passwordIsValid } from '@/pages/auth/password-checklist'
import { notifyError, notifySuccess } from '@/lib/notify'

function displayName(user: { firstName?: string | null; lastName?: string | null; username: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username
}

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  const [nameVal, setNameVal] = useState('')
  const [seeded, setSeeded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* security — password update moved here from the Settings page */
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  // Seed the editable name only after the user is known. The previous code
  // seeded `useState(name)` unconditionally and then returned `null` before
  // the hooks below — an early return before hooks breaks the Rules of Hooks
  // and blanks the whole page when bootstrap is still resolving.
  useEffect(() => {
    if (user && !seeded) {
      setNameVal(displayName(user))
      setSeeded(true)
    }
  }, [user, seeded])

  // While bootstrap resolves there is no user yet — render a skeleton instead
  // of `null` so the route never flashes a blank page.
  if (!user) {
    return (
      <AppShell title="Profile">
        <div className="mx-auto flex max-w-2xl flex-col gap-4" aria-busy="true">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </AppShell>
    )
  }

  const name = displayName(user)
  const initials = name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError(null)
    if (!nameVal.trim()) return setError("Name can't be empty.")
    setSaving(true)
    try {
      await api.updateProfile({ name: nameVal.trim() })
      await bootstrap()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwLoading) return
    if (!current) {
      notifyError('Enter your current password.')
      return
    }
    if (!passwordIsValid(next)) {
      notifyError('New password does not meet the requirements.')
      return
    }
    if (next !== confirm) {
      notifyError('Passwords do not match.')
      return
    }
    setPwLoading(true)
    try {
      await api.changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      notifySuccess('Password updated successfully!')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Unable to update password. Please try again.')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <AppShell title="Profile">
      <div className="animate-slide-up mx-auto flex max-w-2xl flex-col gap-5">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Account
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">Profile</h1>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-xl font-semibold text-primary ring-1 ring-primary/30">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight">{name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">@{user.username}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="default" dot>
                  {user.userrole}
                </Badge>
                <Badge variant="outline">Joined {fmtDate(user.createdAt)}</Badge>
                <Badge variant="outline">ID {user.id}</Badge>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Edit profile</h2>
          <form className="mt-4 flex flex-col gap-4" onSubmit={save} noValidate>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            {saved ? (
              <Alert variant="strong" icon={<CheckCircle2 className="size-4" />}>
                Profile updated.
              </Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={nameVal} onChange={(e) => setNameVal(e.target.value)} />
            </div>
            <div>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </form>
        </section>

        {/* Security — password update (moved from Settings). The always-visible
            checklist is replaced by an info button that reveals the password
            rules on hover / keyboard focus. */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Security</h2>
          <form className="mt-4 flex flex-col gap-4" onSubmit={changePassword} noValidate>
            <div className="flex items-center gap-2">
              <Label htmlFor="current">Current password</Label>
              <PasswordRulesInfo value={next} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="next">New password</Label>
                <Input
                  id="next"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pwLoading}>
                {pwLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Update password'
                )}
              </Button>
              <Link
                to="/settings/sessions"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Monitor className="size-3.5" />
                Active sessions
              </Link>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  )
}
