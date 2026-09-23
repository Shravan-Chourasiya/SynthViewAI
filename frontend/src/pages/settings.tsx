import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronDown, Loader2 } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores/auth.store'
import { usePreferencesStore } from '@/lib/stores/preferences.store'
import type { Difficulty, EndingCriteria, ExperienceLevel, InterviewStyle, InterviewType } from '@/lib/types'
import { notifyError, notifySuccess } from '@/lib/notify'

const selectCls =
  'h-10 w-full appearance-none rounded-md border border-input bg-transparent pl-3 pr-9 text-base shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring'

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

export function SettingsPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  /* preferences
   * Draft state is seeded from the persisted store and committed on save, so the
   * "Save preferences" button stays the single explicit write. These values are
   * re-applied by the New Interview wizard and the interview lobby. */
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

  // Enumerate available input devices for the preference dropdowns. Device
  // labels stay blank until the candidate has granted access once; the
  // fallback labels below keep the options distinguishable either way.
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.()
      ?.then((devices) => {
        setCameraDevices(devices.filter((d) => d.kind === 'videoinput'))
        setMicDevices(devices.filter((d) => d.kind === 'audioinput'))
      })
      ?.catch(() => {})
  }, [])

  /* danger */
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Commits the draft to the persisted preferences store. Unlike the previous
  // implementation this is a real write — the saved values are what the New
  // Interview wizard and the interview lobby read back.
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
    
    // Reset the prefsSaved flag after 3 seconds so the message disappears
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
              <SelectShell>
                <select id="type" className={selectCls} value={defaultType} onChange={(e) => setDefaultType(e.target.value as InterviewType)}>
                  {TYPE_OPTIONS.map((t) => (
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
                  onChange={(e) => setDefaultDifficulty(e.target.value as Difficulty)}
                >
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </SelectShell>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="experience">Default experience level</Label>
              <SelectShell>
                <select
                  id="experience"
                  className={selectCls}
                  value={defaultExperience}
                  onChange={(e) => setDefaultExperience(e.target.value as ExperienceLevel)}
                >
                  {EXPERIENCE_OPTIONS.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </SelectShell>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="style">Default interview style</Label>
              <SelectShell>
                <select
                  id="style"
                  className={selectCls}
                  value={defaultStyle}
                  onChange={(e) => setDefaultStyle(e.target.value as InterviewStyle)}
                >
                  {STYLE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </SelectShell>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="duration">Default duration</Label>
              <SelectShell>
                <select
                  id="duration"
                  className={selectCls}
                  value={defaultDuration}
                  onChange={(e) => setDefaultDuration(Number(e.target.value))}
                >
                  {DURATION_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m} minutes</option>
                  ))}
                </select>
              </SelectShell>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ending">End interview</Label>
              <SelectShell>
                <select
                  id="ending"
                  className={selectCls}
                  value={defaultEnding}
                  onChange={(e) => setDefaultEnding(e.target.value as EndingCriteria)}
                >
                  {ENDING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </SelectShell>
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

          {/* Device + lobby prompt preferences — applied on every interview lobby */}
          <h3 className="mt-6 text-sm font-semibold">Device &amp; permissions</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The interview lobby requests camera, microphone and screen access
            before every interview. Choose the devices it should ask for here.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preferredCamera">Default camera</Label>
              <SelectShell>
                <select
                  id="preferredCamera"
                  className={selectCls}
                  value={preferredCameraId ?? ''}
                  onChange={(e) => setPreferredCameraId(e.target.value || null)}
                >
                  <option value="">Auto-select</option>
                  {cameraDevices.map((d, index) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${index + 1}`}</option>
                  ))}
                </select>
              </SelectShell>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preferredMic">Default microphone</Label>
              <SelectShell>
                <select
                  id="preferredMic"
                  className={selectCls}
                  value={preferredMicId ?? ''}
                  onChange={(e) => setPreferredMicId(e.target.value || null)}
                >
                  <option value="">Auto-select</option>
                  {micDevices.map((d, index) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${index + 1}`}</option>
                  ))}
                </select>
              </SelectShell>
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
              notifySuccess('Account deleted successfully!');
              logout();
              navigate('/');
            })
            .catch(error => {
              notifyError(error instanceof Error ? error.message : 'Unable to delete account. Please try again.');
            });
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
