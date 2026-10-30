import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Feather, KeyRound, Monitor, Moon, Palette, Save, Sparkles, Sun, User } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Label } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTheme } from '@/components/theme-context'
import { useMotion } from '@/components/motion-context'
import { useAuthStore } from '@/lib/stores/auth-store'
import { DIFFICULTY_OPTIONS, EXPERIENCE_LEVELS } from '@/lib/constants/interview'
import { cn } from '@/lib/utils'

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-3.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-primary"
      />
    </label>
  )
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { motion, resolvedMotion, setMotion } = useMotion()
  const user = useAuthStore((s) => s.user)
  const patchUser = useAuthStore((s) => s.patchUser)
  const updateProfile = useAuthStore((s) => s.updateProfile)

  const [email, setEmail] = useState(user?.email ?? '')
  const [defaultLevel, setDefaultLevel] = useState('senior')
  const [defaultDifficulty, setDefaultDifficulty] = useState('medium')
  const [notifications, setNotifications] = useState({
    reportReady: true,
    weekly: true,
    product: false,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings."
        lede="Account details, appearance, interview defaults and security."
      />

      <Tabs defaultValue="account">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="account">
            <User className="size-3.5" />
            Account
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Palette className="size-3.5" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="size-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <KeyRound className="size-3.5" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-4">
          <Panel flush>
            <PanelHeader title="Account" description="Used on reports and shared links" />
            <div className="space-y-5 p-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="settings-name">Name</Label>
                  <Input
                    id="settings-name"
                    defaultValue={user?.name ?? user?.username ?? ''}
                    onBlur={(e) => {
                      const firstName = e.target.value.split(' ')[0]
                      const lastName = e.target.value.split(' ').slice(1).join(' ') || undefined
                      void updateProfile({ firstName, lastName }).catch(() =>
                        toast.error('Could not save your name'),
                      )
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-username">Username</Label>
                  <Input id="settings-username" value={user?.username ?? ''} readOnly className="font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-email">Email</Label>
                <Input id="settings-email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => toast.success('Account updated')}>
                  <Save className="size-4" />
                  Save
                </Button>
                <Badge variant="neutral">role: {user?.role ?? user?.userrole ?? 'candidate'}</Badge>
              </div>
            </div>

            <div className="space-y-3 border-t border-border p-5">
              <div>
                <p className="text-sm font-medium">Prototype role</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  This build ships with mock auth. Switch roles to look at the admin surfaces.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['candidate', 'reviewer', 'admin'] as const).map((role) => (
                  <Button
                    key={role}
                    variant={(user?.role ?? user?.userrole) === role ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      patchUser({ role })
                      toast.success(`Now viewing as ${role}`)
                    }}
                  >
                    {role}
                  </Button>
                ))}
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4 space-y-4">
          <Panel flush>
            <PanelHeader title="Appearance" description="Applies immediately, remembered on this device" />
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              {[
                { value: 'dark', label: 'Dark', icon: Moon, hint: 'Deep blue-slate, the default' },
                { value: 'light', label: 'Light', icon: Sun, hint: 'Cool off-white' },
                { value: 'system', label: 'System', icon: Monitor, hint: 'Follow the OS setting' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value as 'dark' | 'light' | 'system')}
                  aria-pressed={theme === option.value}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    theme === option.value
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <option.icon className="size-4 text-primary" />
                  <span className="mt-3 block text-sm font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel flush>
            <PanelHeader title="Motion" description="Animations, 3D and page transitions" />
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              {[
                { value: 'full', label: 'Full', icon: Sparkles, hint: 'Everything on — the way it was designed' },
                { value: 'reduced', label: 'Reduced', icon: Feather, hint: 'Static UI, no movement at all' },
                { value: 'system', label: 'System', icon: Monitor, hint: 'Follow the OS setting' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMotion(option.value as 'full' | 'reduced' | 'system')}
                  aria-pressed={motion === option.value}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    motion === option.value
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <option.icon className="size-4 text-primary" />
                  <span className="mt-3 block text-sm font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span>
                </button>
              ))}
            </div>
            {motion === 'system' && resolvedMotion === 'reduced' ? (
              <p className="border-t border-border px-5 py-3 text-xs leading-relaxed text-muted-foreground">
                Your system asks apps to reduce motion, so animations are off. Choose{' '}
                <span className="font-medium text-foreground">Full</span> to see them anyway.
              </p>
            ) : null}
          </Panel>

          <Panel flush>
            <PanelHeader title="Interview defaults" description="Pre-filled when you start a new session" />
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="default-level">Experience level</Label>
                <Select value={defaultLevel} onValueChange={setDefaultLevel}>
                  <SelectTrigger id="default-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-difficulty">Difficulty</Label>
                <Select value={defaultDifficulty} onValueChange={setDefaultDifficulty}>
                  <SelectTrigger id="default-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border-t border-border px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => toast.success('Defaults saved')}>
                <Save className="size-3.5" />
                Save defaults
              </Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Panel flush>
            <PanelHeader title="Notifications" description="What we email and what shows in the bell" />
            <div className="divide-y divide-border px-5">
              <Toggle
                label="Report ready"
                description="Email me the moment a session finishes evaluating."
                checked={notifications.reportReady}
                onChange={(value) => setNotifications((n) => ({ ...n, reportReady: value }))}
              />
              <Toggle
                label="Weekly insight"
                description="A short summary of your trend and the one thing to practise."
                checked={notifications.weekly}
                onChange={(value) => setNotifications((n) => ({ ...n, weekly: value }))}
              />
              <Toggle
                label="Product updates"
                description="New formats and evaluation changes, roughly monthly."
                checked={notifications.product}
                onChange={(value) => setNotifications((n) => ({ ...n, product: value }))}
              />
            </div>
            <div className="border-t border-border px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => toast.success('Preferences saved')}>
                Save preferences
              </Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="security" className="mt-4 space-y-4">
          <Panel flush>
            <PanelHeader title="Password" />
            <div className="space-y-5 p-5">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input id="current-password" type="password" placeholder="••••••••" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input id="new-password" type="password" placeholder="At least 8 characters" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm</Label>
                  <Input id="confirm-password" type="password" />
                </div>
              </div>
              <Button onClick={() => toast.success('Password changed')}>
                <KeyRound className="size-4" />
                Update password
              </Button>
            </div>
          </Panel>

          <Panel flush>
            <PanelHeader
              title="Active sessions"
              description="Devices currently signed in to your account"
              aside={
                <Link to="/settings/sessions" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                  Manage
                </Link>
              }
            />
            <p className="p-5 text-sm text-muted-foreground">
              Revoke any device you do not recognise. Signing out everywhere ends every session except this one.
            </p>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
