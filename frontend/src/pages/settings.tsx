import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronDown, Loader2, Monitor } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores/auth.store'
import { PasswordChecklist, passwordIsValid } from '@/pages/auth/password-checklist'

const selectCls =
  'h-10 w-full appearance-none rounded-md border border-input bg-transparent pl-3 pr-9 text-base shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring'

export function SettingsPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  /* security */
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)

  /* preferences */
  const [defaultType, setDefaultType] = useState('Mixed')
  const [defaultDifficulty, setDefaultDifficulty] = useState('Adaptive')
  const [followUps, setFollowUps] = useState(true)
  const [prefsSaved, setPrefsSaved] = useState(false)

  /* danger */
  const [deleteOpen, setDeleteOpen] = useState(false)

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwLoading) return
    setPwError(null)
    setPwSaved(false)
    if (!current) return setPwError('Enter your current password.')
    if (!passwordIsValid(next)) return setPwError('New password does not meet the requirements.')
    if (next !== confirm) return setPwError('Passwords do not match.')
    setPwLoading(true)
    try {
      await api.changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 2500)
    } finally {
      setPwLoading(false)
    }
  }

  const savePrefs = () => {
    setPrefsSaved(true)
    setTimeout(() => setPrefsSaved(false), 2500)
  }

  return (
    <AppShell title="Settings">
      <div className="animate-slide-up mx-auto flex max-w-2xl flex-col gap-5">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Account
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        </header>

        {/* security */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Security</h2>
          <form className="mt-4 flex flex-col gap-4" onSubmit={changePassword} noValidate>
            {pwError ? <Alert variant="destructive">{pwError}</Alert> : null}
            {pwSaved ? (
              <Alert variant="strong" icon={<CheckCircle2 className="size-4" />}>
                Password updated.
              </Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="next">New password</Label>
                <Input id="next" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </div>
            <PasswordChecklist value={next} />
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

        {/* preferences */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Interview preferences</h2>
          {prefsSaved ? (
            <div className="mt-3">
              <Alert variant="strong" icon={<CheckCircle2 className="size-4" />}>
                Preferences saved.
              </Alert>
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Default interview type</Label>
              <SelectShell>
                <select id="type" className={selectCls} value={defaultType} onChange={(e) => setDefaultType(e.target.value)}>
                  {['Behavioral', 'Technical', 'Coding', 'Mixed'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </SelectShell>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="difficulty">Default difficulty</Label>
              <SelectShell>
                <select
                  id="difficulty"
                  className={selectCls}
                  value={defaultDifficulty}
                  onChange={(e) => setDefaultDifficulty(e.target.value)}
                >
                  {['Adaptive', 'Easy', 'Medium', 'Hard'].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </SelectShell>
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={followUps}
              onChange={(e) => setFollowUps(e.target.checked)}
              className="size-4 accent-primary"
            />
            Enable adaptive follow-up questions (FR-17)
          </label>
          <div className="mt-4">
            <Button variant="outline" onClick={savePrefs}>
              Save preferences
            </Button>
          </div>
        </section>

        {/* danger zone */}
        <section className="rounded-2xl border border-destructive/30 bg-card p-6">
          <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Deleting your account removes every interview, report and metric
            permanently. This cannot be undone.
          </p>
          <div className="mt-4">
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete account
            </Button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete account?"
        description="This permanently deletes your account, interviews and reports. This action cannot be undone."
        confirmLabel="Delete forever"
        destructive
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          void api.deleteAccount().then(() => logout()).then(() => navigate('/'))
        }}
      />
    </AppShell>
  )
}

function SelectShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
