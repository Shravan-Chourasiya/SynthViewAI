import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, Check, CircleAlert, Loader2, Mic, MonitorUp, Play, RefreshCw, Wifi } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Dialog } from '@/components/ui/dialog'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { DifficultyBadge, TypeBadge } from '@/components/interview-ui'
import { api } from '@/lib/api'
import { fmtMinutes } from '@/lib/format'
import { createInterviewSocket } from '@/lib/socket/interview-socket'
import { usePreferencesStore } from '@/lib/stores/preferences.store'
import { useLiveInterviewStore } from '@/lib/stores/live-interview.store'
import type { Interview } from '@/lib/types'
import { cn } from '@/lib/utils'

type CheckKey = 'camera' | 'microphone' | 'connection' | 'screen'
type CheckState = 'checking' | 'ready' | 'needs-action' | 'skipped' | 'blocked' | 'failed' | 'unsupported'
interface CheckResult { state: CheckState; detail?: string }
interface Checks {
  camera?: CheckResult
  microphone?: CheckResult
  connection?: CheckResult
  screen?: CheckResult
}

const CHECKS: { key: CheckKey; label: string; desc: string; icon: typeof Camera; optional?: boolean }[] = [
  { key: 'camera', label: 'Camera', desc: 'Your presence in the interview room', icon: Camera },
  { key: 'microphone', label: 'Microphone', desc: 'Voice input (text fallback available)', icon: Mic },
  { key: 'connection', label: 'Real-time connection', desc: 'Authenticated WebSocket link to the interviewer', icon: Wifi },
  // Optional, user-initiated probe (B5): rendered only when the candidate has
  // screen-share-in-lobby enabled, never blocks entry, and never auto-runs —
  // `getDisplayMedia` cannot open a picker without a click on the page.
  { key: 'screen', label: 'Screen sharing — optional', desc: 'Share your screen with the interviewer', icon: MonitorUp, optional: true },
]

// Fixed read-through gate for the rules dialog (Part 1). Deliberately not
// configurable and not affected by prefers-reduced-motion — reduced motion
// governs animation, not this safety pause.
const RULES_GATE_SECONDS = 7

// Maps a getUserMedia/getDisplayMedia rejection onto a check result. The
// two "needs-action" cases exist because browsers refuse to open a picker
// without a click on the page, which is not a permission failure.
function errorDetail(error: unknown, device: string): CheckResult {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return { state: 'blocked', detail: `${device} permission was denied.` }
    if (error.name === 'NotFoundError') return { state: 'failed', detail: `No ${device.toLowerCase()} was found.` }
    if (error.name === 'NotReadableError') return { state: 'failed', detail: `${device} is busy or unavailable.` }
    if (error.name === 'AbortError') return { state: 'needs-action', detail: `${device} was cancelled before a source was chosen.` }
    if (error.name === 'InvalidStateError') return { state: 'needs-action', detail: `${device} needs a click on this page before the picker can open.` }
  }
  return { state: 'failed', detail: error instanceof Error ? error.message : `${device} is unavailable.` }
}

async function preflightSocket(): Promise<void> {
  const socket = createInterviewSocket()
  socket.io.opts.reconnection = false
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error('The real-time connection timed out.')), 8000)
    const finish = (error?: Error) => {
      window.clearTimeout(timeout)
      socket.off('connect', onConnect)
      socket.off('connect_error', onError)
      socket.disconnect()
      if (error) reject(error)
      else resolve()
    }
    const onConnect = () => finish()
    const onError = (error: Error) => finish(error)
    socket.once('connect', onConnect)
    socket.once('connect_error', onError)
    socket.connect()
  })
}

export function LobbyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [interview, setInterview] = useState<Interview | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checks, setChecks] = useState<Partial<Checks>>({})
  const [permissionNotice, setPermissionNotice] = useState(false)
  const [mediaNoticeDismissed, setMediaNoticeDismissed] = useState(false)
  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  // Rules dialog (Part 1): opens on Start, gates `enterInterview` behind a
  // fixed 7-second read-through.
  const [rulesOpen, setRulesOpen] = useState(false)
  const [rulesCountdown, setRulesCountdown] = useState(RULES_GATE_SECONDS)
  const enteredRef = useRef(false)
  const runRef = useRef(0)
  const gateTimerRef = useRef<number | null>(null)
  const setMediaStream = useLiveInterviewStore((state) => state.setMediaStream)
  const clearMediaStream = useLiveInterviewStore((state) => state.clearMediaStream)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  // Device + prompt preferences saved in Settings. Read here so every newly
  // created interview's lobby applies the candidate's saved choices.
  const preferredCameraDeviceId = usePreferencesStore((s) => s.media.preferredCameraDeviceId)
  const preferredMicDeviceId = usePreferencesStore((s) => s.media.preferredMicDeviceId)
  const requestScreenShareInLobby = usePreferencesStore((s) => s.media.requestScreenShareInLobby)

  useEffect(() => {
    if (!id) return
    api.getInterview(id).then((it) => {
      if (!it) return setNotFound(true)
      if (it.status === 'COMPLETED' || it.status === 'CANCELLED' || it.status === 'ABANDONED' || it.status === 'EXPIRED') return setEnded(true)
      setInterview(it)
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load interview lobby.'))
  }, [id])

  // Screen sharing, by platform rule, can never be granted ahead of time: the
  // browser has to show its own picker and it requires a real click on the page
  // (`getDisplayMedia` rejects with InvalidStateError without transient user
  // activation), so this cannot be fired automatically on load. The lobby offers
  // a one-click grant instead, and offers it before every interview.
  const requestScreenAccess = useCallback(async () => {
    if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      setChecks((c) => ({ ...c, screen: { state: 'unsupported', detail: 'Screen sharing is not supported by this browser.' } }))
      return
    }
    setChecks((c) => ({ ...c, screen: { state: 'checking', detail: 'Pick the screen or window you would share…' } }))
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const surface = stream.getVideoTracks()[0]?.label
      // Probe only — release the capture immediately so the OS "sharing"
      // indicator does not stay lit while the candidate reads this page. The
      // live room opens its own picker when sharing is actually started.
      stream.getTracks().forEach((track) => track.stop())
      setChecks((c) => ({
        ...c,
        screen: {
          state: 'ready',
          detail: surface
            ? `Access granted for “${surface}”. Your browser will confirm again when you start sharing.`
            : 'Access granted. Your browser will confirm again when you start sharing.',
        },
      }))
    } catch (err) {
      setChecks((c) => ({ ...c, screen: errorDetail(err, 'Screen sharing') }))
    }
  }, [])

  const runChecks = useCallback(async () => {
    const runId = ++runRef.current
    setRunning(true)
    setPermissionNotice(false)
    setMediaNoticeDismissed(false)
    clearMediaStream()

    setChecks({
      camera: { state: 'checking' },
      microphone: { state: 'checking' },
      connection: { state: 'checking' },
    })

    // Release anything left over from a previous run before asking again.
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null

    // Camera and microphone are requested on every lobby visit. getUserMedia is
    // the only way to raise the browser prompt, and once a decision has been
    // remembered for this origin the browser resolves it immediately instead of
    // asking again — that stored decision can only be cleared from the browser's
    // own site settings, never from JavaScript.
    const requestDevice = async (
      key: 'camera' | 'microphone',
      constraints: MediaStreamConstraints,
    ): Promise<MediaStream | null> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (runId === runRef.current) setChecks((c) => ({ ...c, [key]: { state: 'failed', detail: 'Media devices are not supported by this browser.' } }))
        return null
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (runId !== runRef.current) { stream.getTracks().forEach((t) => t.stop()); return null }
        setChecks((c) => ({ ...c, [key]: { state: 'ready' } }))
        return stream
      } catch (err) {
        if (runId === runRef.current) setChecks((c) => ({ ...c, [key]: errorDetail(err, key === 'camera' ? 'Camera' : 'Microphone') }))
        return null
      }
    }

    // Saved device preferences from Settings → Interview preferences, applied as
    // an `ideal` hint so a missing/unplugged device still falls back gracefully.
    const cameraConstraints: MediaStreamConstraints = preferredCameraDeviceId
      ? { video: { deviceId: { ideal: preferredCameraDeviceId } } }
      : { video: true }
    const micConstraints: MediaStreamConstraints = preferredMicDeviceId
      ? { audio: { deviceId: { ideal: preferredMicDeviceId } } }
      : { audio: true }

    const connection = preflightSocket()
      .then(() => { if (runId === runRef.current) setChecks((current) => ({ ...current, connection: { state: 'ready' } })) })
      .catch((err: unknown) => { if (runId === runRef.current) setChecks((current) => ({ ...current, connection: { state: 'failed', detail: err instanceof Error ? err.message : 'Unable to reach the interview WebSocket.' } })) })

    setPermissionNotice(true)
    const [camera, microphone] = await Promise.all([
      requestDevice('camera', cameraConstraints),
      requestDevice('microphone', micConstraints),
    ])
    if (runId === runRef.current) setPermissionNotice(false)
    await connection
    if (runId === runRef.current) {
      const tracks = [...(camera?.getVideoTracks() ?? []), ...(microphone?.getAudioTracks() ?? [])]
      if (tracks.length) {
        const stream = new MediaStream(tracks)
        mediaStreamRef.current = stream
        setMediaStream(stream)
      }
      setRunning(false)
    }
  }, [clearMediaStream, setMediaStream, preferredCameraDeviceId, preferredMicDeviceId])

  // B5: the optional screen check starts as `skipped` (never `failed`) so it
  // never blocks entry, and gains a grant action on its row. The other checks
  // render their own spinner while `checks` has no entry yet.
  useEffect(() => {
    if (interview && requestScreenShareInLobby) {
      setChecks((c) => ({ screen: { state: 'skipped', detail: 'Not requested yet.' }, ...c }))
    }
  }, [interview, requestScreenShareInLobby])

  useEffect(() => { if (interview) void runChecks() }, [interview, runChecks])
  useEffect(() => () => {
    if (!enteredRef.current) {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      clearMediaStream()
    }
  }, [clearMediaStream])

  // 7-second rules gate. The countdown runs only while the dialog is open and
  // always restarts from 7 when it reopens (cancel mid-count must not resume a
  // stale timer). One interval, cleaned up on close/unmount; the tick is a
  // functional update so re-renders during the count cannot double-fire it.
  useEffect(() => {
    if (!rulesOpen) return
    setRulesCountdown(RULES_GATE_SECONDS)
    const timer = window.setInterval(() => {
      setRulesCountdown((seconds) => (seconds > 0 ? seconds - 1 : 0))
    }, 1000)
    return () => {
      window.clearInterval(timer)
      gateTimerRef.current = null
    }
  }, [rulesOpen])
  useEffect(() => () => {
    if (gateTimerRef.current !== null) window.clearInterval(gateTimerRef.current)
  }, [])

  // B5: the screen row carries its own grant action (the browser requires a
  // click to open the picker, so this can never be part of the auto-run).
  const grantScreenAccess = useCallback(() => {
    void requestScreenAccess()
  }, [requestScreenAccess])

  const connectionReady = checks.connection?.state === 'ready'

  const openRules = useCallback(() => {
    if (!connectionReady || running || starting) return
    setRulesOpen(true)
  }, [connectionReady, running, starting])

  const closeRules = useCallback(() => {
    setRulesOpen(false)
  }, [])

  const enterInterview = async () => {
    if (!interview) return
    setStarting(true)
    try {
      if (interview.status !== 'IN_PROGRESS') await api.startInterview(interview.id)
      enteredRef.current = true
      navigate(`/interviews/${interview.id}/live`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to start interview.')
    } finally {
      setStarting(false)
    }
  }

  const confirmRules = () => {
    if (rulesCountdown > 0) return
    setRulesOpen(false)
    void enterInterview()
  }

  if (notFound) return <AppShell title="Interview Lobby"><LobbyNotice title="Interview not found" body="This interview doesn't exist or was removed." /></AppShell>
  if (ended) return <AppShell title="Interview Lobby"><LobbyNotice title="Interview unavailable" body="This interview has already ended or its scheduled window has passed, so it can't be started or resumed." /></AppShell>
  if (error) return <AppShell title="Interview Lobby"><p className="p-6 text-sm text-destructive">{error}</p></AppShell>
  if (!interview) return <AppShell title="Interview Lobby"><div className="flex justify-center pt-24"><Loader2 className="size-5 animate-spin text-primary" /></div></AppShell>

  const mediaUnavailable = ['camera', 'microphone'].some((key) => ['blocked', 'failed'].includes(checks[key as 'camera' | 'microphone']?.state ?? 'checking'))
  const resuming = interview.status === 'IN_PROGRESS'
  const startLabel = starting ? 'Starting…' : resuming ? 'Resume Interview' : 'Start Interview'
  const gateActive = rulesOpen && rulesCountdown > 0
  return <AppShell title="Interview Lobby"><div className="animate-slide-up mx-auto flex max-w-4xl flex-col gap-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Interview lobby</p><h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">{interview.roleTitle}</h1><p className="mt-1.5 text-sm text-muted-foreground">Check your environment, then enter the room.</p></div><StatusBadge status={interview.status} /></div>
    {permissionNotice ? (
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm">
        <Loader2 className="size-3.5 animate-spin text-primary" />
        <span className="text-muted-foreground">Requesting camera and microphone access…</span>
      </div>
    ) : null}
    {resuming && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"><span className="font-mono text-[11px] text-primary">Resuming session — Round {interview.currentRound}/{interview.rounds} · Question {interview.currentQuestion} · {Math.round(interview.progress * 100)}% complete</span></div>}
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-border bg-card p-5"><h2 className="text-sm font-semibold">Interview summary</h2><div className="mt-2"><SummaryRow label="Role">{interview.roleTitle}</SummaryRow><SummaryRow label="Domain">{interview.domain}</SummaryRow><SummaryRow label="Company">{interview.company || '—'}</SummaryRow><SummaryRow label="Type"><TypeBadge type={interview.type} /></SummaryRow><SummaryRow label="Difficulty"><DifficultyBadge difficulty={interview.difficulty} /></SummaryRow><SummaryRow label="Duration">{fmtMinutes(interview.durationMin)}</SummaryRow><SummaryRow label="Rounds">{interview.rounds}</SummaryRow><SummaryRow label="Topics">{interview.topics.join(', ') || 'AI will choose'}</SummaryRow></div></section>
      <section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Environment check</h2><Button variant="ghost" size="sm" onClick={() => void runChecks()} disabled={running}><RefreshCw className={cn('size-3.5', running && 'animate-spin-slow')} />Re-run</Button></div>
        {/* B3: three required checks rendered as one progress story. The screen
            row is optional and user-initiated, so it is excluded from the rail
            and from the start-gating. */}
        <CheckRail checks={checks} />
        <div className="mt-3 flex flex-col gap-2.5">
          {CHECKS.filter((check) => !check.optional || requestScreenShareInLobby).map((check) => (
            <CheckRow
              key={check.key}
              check={check}
              result={checks[check.key]}
              running={running}
              action={check.key === 'screen' ? { label: 'Grant access', onClick: grantScreenAccess } : undefined}
            />
          ))}
        </div>
        {requestScreenShareInLobby ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Screen sharing is optional — grant it only if you want it available in the room.
          </p>
        ) : null}
      </section></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4"><div className="max-w-md text-xs leading-relaxed text-muted-foreground"><p>Real-time connectivity is required to enter the interview.</p>{mediaUnavailable && !mediaNoticeDismissed ? (<p className="mt-1 flex items-center gap-1.5 text-signal-vague"><CircleAlert className="size-3.5" />Camera or microphone will be off; you can continue in text mode.<button type="button" onClick={() => setMediaNoticeDismissed(true)} className="ml-1 underline underline-offset-1">Dismiss</button></p>) : null}</div><div className="flex items-center gap-2"><Link to="/dashboard" onClick={clearMediaStream} className={cn(buttonVariants({ variant: 'ghost' }))}>Cancel</Link><Button size="lg" className={cn('h-11 px-5', connectionReady && !running && !starting && 'animate-ready-enter')} disabled={!connectionReady || running || starting} onClick={openRules}>{starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}{startLabel}</Button></div></div>
    <Dialog open={rulesOpen} onClose={closeRules} className="max-w-lg">
      <h2 className="text-lg font-semibold tracking-tight">Before you begin</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        A quick read-through so the session runs smoothly. The interview is timed
        and adaptive — every answer shapes the next question.
      </p>
      <ul className="mt-4 flex flex-col gap-2.5 text-sm leading-relaxed">
        {[
          'Your camera and microphone stay on; you can answer by text at any time.',
          'Answer on your own — no external help, notes, or a second screen.',
          `The session runs for about ${fmtMinutes(interview.durationMin)}; each question has its own time budget.`,
          'Submit each answer once — answers cannot be re-done after submission.',
          'If the connection drops, your answers are saved and you can rejoin to resume.',
          'The session can be ended at any time from the controls in the room.',
        ].map((rule) => (
          <li key={rule} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-signal-strong" />
            <span className="text-muted-foreground">{rule}</span>
          </li>
        ))
        }
      </ul>
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={closeRules}>Cancel</Button>
        <Button
          onClick={confirmRules}
          disabled={gateActive || starting}
          className={cn(!gateActive && !starting && 'animate-glow-pulse-once')}
        >
          {starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {starting ? 'Starting…' : gateActive ? `${startLabel} (${rulesCountdown})` : startLabel}
        </Button>
      </div>
    </Dialog>
  </div></AppShell>
}

/** B3: one progress story for the three required checks, 60ms stagger. */
function CheckRail({ checks }: { checks: Partial<Checks> }) {
  const required = CHECKS.filter((check) => !check.optional)
  return (
    <div className="mt-3 flex gap-1.5" aria-hidden="true">
      {required.map((check, index) => {
        const state = checks[check.key]?.state
        const passed = state === 'ready'
        const settled = passed || state === 'blocked' || state === 'failed'
        return (
          <span
            key={check.key}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-150',
              passed ? 'bg-(--signal-strong)' : settled ? 'bg-(--signal-weak)' : 'bg-border',
            )}
            style={settled ? { transitionDelay: `${index * 60}ms` } : undefined}
          />
        )
      })}
    </div>
  )
}

function CheckRow({
  check,
  result,
  action,
  running,
}: {
  check: (typeof CHECKS)[number]
  result: CheckResult | undefined
  action?: { label: string; onClick: () => void }
  running: boolean
}) {
  const Icon = check.icon
  const state = result?.state ?? 'checking'
  const ready = state === 'ready'
  const issue = state === 'blocked' || state === 'failed' || state === 'unsupported'
  // B4: a fixed minimum height so a re-check never shifts the layout, and a
  // one-shot re-enter on re-run while the rows show the checking spinner.
  // B5: optional rows get a distinct badge so "skipped/unsupported" never reads
  // as a failure.
  return (
    <div className={cn('flex min-h-16 items-center gap-3 rounded-xl border border-border bg-background/50 px-3.5 py-3', running && 'animate-row-reenter')}>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors duration-150', ready ? 'bg-(--signal-strong)/10 text-signal-strong ring-(--signal-strong)/30' : issue ? 'bg-(--signal-weak)/10 text-signal-weak ring-(--signal-weak)/30' : 'bg-secondary text-muted-foreground ring-border', issue && 'animate-shake-once')}><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{check.label}</p>
        <p className="text-xs text-muted-foreground">{result?.detail ?? check.desc}</p>
      </div>
      {ready ? (
        <>
          {/* B1: the check draws in via stroke-dashoffset on ready. */}
          <Check className="size-4 animate-draw-check text-signal-strong" />
          <Badge variant="strong" dot>{check.optional ? 'Granted' : 'Ready'}</Badge>
        </>
      ) : state === 'checking' ? (
        <Loader2 className="size-4 animate-spin-slow text-primary" />
      ) : state === 'skipped' || state === 'unsupported' ? (
        action ? (
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : (
          <Badge variant="outline">{check.optional ? 'Optional' : 'Skipped'}</Badge>
        )
      ) : (
        <span className="flex items-center gap-1 text-xs text-signal-weak"><CircleAlert className="size-3.5" />{state === 'blocked' ? 'Blocked' : 'Unavailable'}</span>
      )}
    </div>
  )
}
function SummaryRow({ label, children }: { label: string; children: ReactNode }) { return <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0"><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span><span className="text-right text-sm">{children}</span></div> }
function LobbyNotice({ title, body }: { title: string; body: string }) { return <div className="mx-auto max-w-md pt-16 text-center"><h1 className="text-xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p><div className="mt-6 flex justify-center"><Link to="/interviews" className={cn(buttonVariants({ variant: 'outline' }))}>Back to interviews</Link></div></div> }
