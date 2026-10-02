import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, Monitor } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores/auth.store'
import { usePreferencesStore } from '@/lib/stores/preferences.store'
import type { Difficulty, EndingCriteria, ExperienceLevel, InterviewStyle, InterviewType } from '@/lib/types'
import { notifyError, notifySuccess } from '@/lib/notify'

// Options for the saved interview defaults. Kept in sync with the New Interview
// wizard (pages/interviews/new.tsx) so a saved default is always selectable there.
const TYPE_OPTIONS: InterviewType[] = ['Behavioral', 'Technical', 'Mixed']
const DIFFICULTY_OPTIONS: Difficulty[] = ['Adaptive', 'Easy', 'Medium', 'Hard']
const EXPERIENCE_OPTIONS: ExperienceLevel[] = ['Entry', 'Junior', 'Mid-level', 'Senior']
const STYLE_OPTIONS: { value: InterviewStyle; label: string }[] = [
  { value: 'FAANG', label: 'FAANG' },
  { value: 'MAANG', label: 'MAANG' },
  { value: 'STARTUP', label: 'Startup' },
  { value: 'REGULAR', label: 'Other / regular' },
]
const DURATION_OPTIONS = [15, 30, 45, 60]
const ENDING_OPTIONS: { value: EndingCriteria; label: string }[] = [
  { value: 'DURATION', label: 'By duration' },
  { value: 'QUESTION_COUNT', label: 'By question count' },
]

// Radix Select forbids empty-string item values — use a sentinel for "no device chosen".
const AUTO_SELECT_SENTINEL = '__auto__'

export function SettingsPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  const interviewDefaults = usePreferencesStore((s) => s.interviewDefaults)
  const mediaPreferences = usePreferencesStore((s) => s.media)
  const preferAdaptiveFollowUps = usePreferencesStore((s) => s.preferAdaptiveFollowUps)
  const setInterviewDefaults = usePreferencesStore((s) => s.setInterviewDefaults)
  const setMediaPreferences = usePreferencesStore((s) => s.setMediaPreferences)
  const setPreferAdaptiveFollowUps = usePreferencesStore((s) => s.setPreferAdaptiveFollowUps)

  const [defaultType, setDefaultType] = useState<InterviewType>(interviewDefaults.type)
  const [defaultDifficulty, setDefaultDifficulty] = useState<Difficulty>(interviewDefaults.difficulty)
  const [defaultExperience, setDefaultExperience] = useState<ExperienceLevel>(interviewDefaults.experienceLevel)
  const [defaultStyle, setDefaultStyle] = useState<InterviewStyle>(interviewDefaults.interviewStyle)
  const [defaultDuration, setDefaultDuration] = useState(interviewDefaults.durationMin)
  const [defaultEnding, setDefaultEnding] = useState<EndingCriteria>(interviewDefaults.endingCriteria)
  const [defaultQuestionCount, setDefaultQuestionCount] = useState(interviewDefaults.questionCount)
  const [defaultTopics, setDefaultTopics] = useState(interviewDefaults.topics.join(', '))
  const [followUps, setFollowUps] = useState(preferAdaptiveFollowUps)
  const [preferredCameraId, setPreferredCameraId] = useState<string | null>(mediaPreferences.preferredCameraDeviceId)
  const [preferredMicId, setPreferredMicId] = useState<string | null>(mediaPreferences.preferredMicDeviceId)
  const [requestScreenShare, setRequestScreenShare] = useState(mediaPreferences.requestScreenShareInLobby)

  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [prefsSaved, setPrefsSaved] = useState(false)

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.()
      ?.then((devices) => {
        setCameraDevices(devices.filter((d) => d.kind === 'videoinput'))
        setMicDevices(devices.filter((d) => d.kind === 'audioinput'))
      })
      ?.catch(() => {})
  }, [])

  const [deleteOpen, setDeleteOpen] = useState(false)

  const savePrefs = () => {
    setInterviewDefaults({
      type: defaultType,
      difficulty: defaultDifficulty,
      experienceLevel: defaultExperience,
      interviewStyle: defaultStyle,
      durationMin: defaultDuration,
      endingCriteria: defaultEnding,
      questionCount: defaultQuestionCount,
      topics: defaultTopics.split(',').map((topic) => topic.trim()).filter(Boolean).slice(0, 10),
    })
    setMediaPreferences({
      preferredCameraDeviceId: preferredCameraId || null,
      preferredMicDeviceId: preferredMicId || null,
      requestScreenShareInLobby: requestScreenShare,
    })
    setPreferAdaptiveFollowUps(followUps)
    setPrefsSaved(true)
    notifySuccess('Preferences saved successfully!')
    setTimeout(() => setPrefsSaved(false), 3000)
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

        {/* preferences */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Interview preferences</h2>
          {prefsSaved ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="size-4" />
              <span>Preferences saved successfully!</span>
            </div>
          ) : null}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Saved here and re-applied every time you create a new interview, so
            the repeated configuration steps are already filled in. Role,
            domain and target company stay per-interview on purpose.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Default interview type</Label>
              <Select value={defaultType} onValueChange={(v) => setDefaultType(v as InterviewType)}>
                <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="difficulty">Default difficulty</Label>
              <Select value={defaultDifficulty} onValueChange={(v) => setDefaultDifficulty(v as Difficulty)}>
                <SelectTrigger id="difficulty"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="experience">Default experience level</Label>
              <Select value={defaultExperience} onValueChange={(v) => setDefaultExperience(v as ExperienceLevel)}>
                <SelectTrigger id="experience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_OPTIONS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="style">Default interview style</Label>
              <Select value={defaultStyle} onValueChange={(v) => setDefaultStyle(v as InterviewStyle)}>
                <SelectTrigger id="style"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="duration">Default duration</Label>
              <Select value={String(defaultDuration)} onValueChange={(v) => setDefaultDuration(Number(v))}>
                <SelectTrigger id="duration"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ending">End interview</Label>
              <Select value={defaultEnding} onValueChange={(v) => setDefaultEnding(v as EndingCriteria)}>
                <SelectTrigger id="ending"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENDING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question-count">Default question count</Label>
              <Input
                id="question-count"
                type="number"
                min={1}
                max={25}
                value={defaultQuestionCount}
                disabled={defaultEnding !== 'QUESTION_COUNT'}
                onChange={(e) => setDefaultQuestionCount(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topics">Default topics</Label>
              <Input
                id="topics"
                value={defaultTopics}
                placeholder="React, TypeScript, System Design"
                onChange={(e) => setDefaultTopics(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Separate topics with commas (up to 10). Leave blank to let the AI
            choose based on the role.
          </p>
          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={followUps}
              onChange={(e) => setFollowUps(e.target.checked)}
              className="size-4 accent-primary"
            />
            Prefer adaptive follow-up questions
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Adaptive difficulty is what currently enables follow-ups; the
            backend caps follow-up depth with its own fixed limit.
          </p>

          {/* Device + lobby prompt preferences */}
          <h3 className="mt-6 text-sm font-semibold">Device &amp; permissions</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The interview lobby requests camera, microphone and screen access
            before every interview. Choose the devices it should ask for here.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preferredCamera">Default camera</Label>
              <Select
                value={preferredCameraId ?? AUTO_SELECT_SENTINEL}
                onValueChange={(v) => setPreferredCameraId(v === AUTO_SELECT_SENTINEL ? null : v)}
              >
                <SelectTrigger id="preferredCamera"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_SELECT_SENTINEL}>Auto-select</SelectItem>
                  {cameraDevices.map((d, i) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preferredMic">Default microphone</Label>
              <Select
                value={preferredMicId ?? AUTO_SELECT_SENTINEL}
                onValueChange={(v) => setPreferredMicId(v === AUTO_SELECT_SENTINEL ? null : v)}
              >
                <SelectTrigger id="preferredMic"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_SELECT_SENTINEL}>Auto-select</SelectItem>
                  {micDevices.map((d, i) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={requestScreenShare}
              onChange={(e) => setRequestScreenShare(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              Prompt me to confirm screen sharing in the lobby before every interview
              <span className="mt-1 block text-xs">
                Browsers never remember a screen-share grant and require a click,
                so the lobby shows a one-click &ldquo;Grant access&rdquo; prompt
                instead of opening the picker on its own.
              </span>
            </span>
          </label>
          <div className="mt-4">
            <Button variant="outline" onClick={savePrefs}>
              Save preferences
            </Button>
          </div>
        </section>

        {/* security — active sessions */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Security</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Review and revoke devices currently signed in to your account.
          </p>
          <div className="mt-4">
            <Link
              to="/settings/sessions"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Monitor className="size-3.5" />
              Active sessions
            </Link>
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
          api.deleteAccount()
            .then(() => {
              notifySuccess('Account deleted successfully!')
              logout()
              navigate('/')
            })
            .catch(error => {
              notifyError(error instanceof Error ? error.message : 'Unable to delete account. Please try again.')
            })
        }}
      />
    </AppShell>
  )
}
