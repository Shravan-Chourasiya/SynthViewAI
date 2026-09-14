import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, CircleAlert, Loader2, Mic, Monitor, Play, RefreshCw, Wifi } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { DifficultyBadge, TypeBadge } from '@/components/interview-ui'
import { api } from '@/lib/api'
import { fmtMinutes } from '@/lib/format'
import { createInterviewSocket } from '@/lib/socket/interview-socket'
import { useLiveInterviewStore } from '@/lib/stores/live-interview.store'
import type { Interview } from '@/lib/types'
import { cn } from '@/lib/utils'

type CheckKey = 'camera' | 'microphone' | 'screen' | 'connection'
type CheckState = 'checking' | 'ready' | 'supported' | 'blocked' | 'failed' | 'unsupported'
type CheckResult = { state: CheckState; detail?: string }
type Checks = Record<CheckKey, CheckResult>

const CHECKS: { key: CheckKey; label: string; desc: string; icon: typeof Camera }[] = [
  { key: 'camera', label: 'Camera', desc: 'Your presence in the interview room', icon: Camera },
  { key: 'microphone', label: 'Microphone', desc: 'Voice input (text fallback available)', icon: Mic },
  { key: 'screen', label: 'Screen sharing', desc: 'Can be requested only while in the interview', icon: Monitor },
  { key: 'connection', label: 'Real-time connection', desc: 'Authenticated WebSocket link to the interviewer', icon: Wifi },
]

function errorDetail(error: unknown, device: string): { state: 'blocked' | 'failed'; detail: string } {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return { state: 'blocked', detail: `${device} permission was denied.` }
  if (error instanceof DOMException && error.name === 'NotFoundError') return { state: 'failed', detail: `No ${device.toLowerCase()} was found.` }
  if (error instanceof DOMException && error.name === 'NotReadableError') return { state: 'failed', detail: `${device} is busy or unavailable.` }
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
  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  const enteredRef = useRef(false)
  const runRef = useRef(0)
  const setMediaStream = useLiveInterviewStore((state) => state.setMediaStream)
  const clearMediaStream = useLiveInterviewStore((state) => state.clearMediaStream)

  useEffect(() => {
    if (!id) return
    api.getInterview(id).then((it) => {
      if (!it) return setNotFound(true)
      if (it.status === 'COMPLETED' || it.status === 'CANCELLED' || it.status === 'ABANDONED' || it.status === 'EXPIRED') return setEnded(true)
      setInterview(it)
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load interview lobby.'))
  }, [id])

  const runChecks = useCallback(async () => {
    const runId = ++runRef.current
    setRunning(true)
    clearMediaStream()
    setChecks({
      camera: { state: 'checking' }, microphone: { state: 'checking' }, connection: { state: 'checking' },
      screen: typeof navigator.mediaDevices?.getDisplayMedia === 'function'
        ? { state: 'supported', detail: 'Supported — permission is requested only when you share.' }
        : { state: 'unsupported', detail: 'Screen sharing is not supported by this browser.' },
    })

    const acquire = async (key: 'camera' | 'microphone', constraints: MediaStreamConstraints): Promise<MediaStream | null> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (runId === runRef.current) setChecks((current) => ({ ...current, [key]: { state: 'failed', detail: 'Media devices are not supported by this browser.' } }))
        return null
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (runId !== runRef.current) { stream.getTracks().forEach((track) => track.stop()); return null }
        setChecks((current) => ({ ...current, [key]: { state: 'ready' } }))
        return stream
      } catch (err) {
        if (runId === runRef.current) setChecks((current) => ({ ...current, [key]: errorDetail(err, key === 'camera' ? 'Camera' : 'Microphone') }))
        return null
      }
    }

    const connection = preflightSocket()
      .then(() => { if (runId === runRef.current) setChecks((current) => ({ ...current, connection: { state: 'ready' } })) })
      .catch((err: unknown) => { if (runId === runRef.current) setChecks((current) => ({ ...current, connection: { state: 'failed', detail: err instanceof Error ? err.message : 'Unable to reach the interview WebSocket.' } })) })
    const [camera, microphone] = await Promise.all([acquire('camera', { video: true }), acquire('microphone', { audio: true })])
    await connection
    if (runId === runRef.current) {
      const tracks = [...(camera?.getVideoTracks() ?? []), ...(microphone?.getAudioTracks() ?? [])]
      if (tracks.length) setMediaStream(new MediaStream(tracks))
      setRunning(false)
    } else {
      camera?.getTracks().forEach((track) => track.stop())
      microphone?.getTracks().forEach((track) => track.stop())
    }
  }, [clearMediaStream, setMediaStream])

  useEffect(() => { if (interview) void runChecks() }, [interview, runChecks])
  useEffect(() => () => { if (!enteredRef.current) clearMediaStream() }, [clearMediaStream])

  const enterInterview = async () => {
    if (!interview) return
    setStarting(true)
    try {
      if (interview.status !== 'IN_PROGRESS') await api.startInterview(interview.id)
      enteredRef.current = true
      navigate(`/interviews/${interview.id}/live`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to start interview.')
    } finally { setStarting(false) }
  }

  if (notFound) return <AppShell title="Interview Lobby"><LobbyNotice title="Interview not found" body="This interview doesn't exist or was removed." /></AppShell>
  if (ended) return <AppShell title="Interview Lobby"><LobbyNotice title="Interview unavailable" body="This interview has already ended or its scheduled window has passed, so it can't be started or resumed." /></AppShell>
  if (error) return <AppShell title="Interview Lobby"><p className="p-6 text-sm text-destructive">{error}</p></AppShell>
  if (!interview) return <AppShell title="Interview Lobby"><div className="flex justify-center pt-24"><Loader2 className="size-5 animate-spin text-primary" /></div></AppShell>

  const connectionReady = checks.connection?.state === 'ready'
  const mediaUnavailable = ['camera', 'microphone'].some((key) => ['blocked', 'failed'].includes(checks[key as 'camera' | 'microphone']?.state ?? 'checking'))
  const resuming = interview.status === 'IN_PROGRESS'
  return <AppShell title="Interview Lobby"><div className="animate-slide-up mx-auto flex max-w-4xl flex-col gap-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Interview lobby</p><h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">{interview.roleTitle}</h1><p className="mt-1.5 text-sm text-muted-foreground">Check your environment, then enter the room.</p></div><StatusBadge status={interview.status} /></div>
    {resuming && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"><span className="font-mono text-[11px] text-primary">Resuming session — Round {interview.currentRound}/{interview.rounds} · Question {interview.currentQuestion} · {Math.round(interview.progress * 100)}% complete</span></div>}
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-border bg-card p-5"><h2 className="text-sm font-semibold">Interview summary</h2><div className="mt-2"><SummaryRow label="Role">{interview.roleTitle}</SummaryRow><SummaryRow label="Domain">{interview.domain}</SummaryRow><SummaryRow label="Company">{interview.company || '—'}</SummaryRow><SummaryRow label="Type"><TypeBadge type={interview.type} /></SummaryRow><SummaryRow label="Difficulty"><DifficultyBadge difficulty={interview.difficulty} /></SummaryRow><SummaryRow label="Duration">{fmtMinutes(interview.durationMin)}</SummaryRow><SummaryRow label="Rounds">{interview.rounds}</SummaryRow><SummaryRow label="Topics">{interview.topics.join(', ') || 'AI will choose'}</SummaryRow></div></section>
      <section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Environment check</h2><Button variant="ghost" size="sm" onClick={() => void runChecks()} disabled={running}><RefreshCw className={cn('size-3.5', running && 'animate-spin')} />Re-run</Button></div><div className="mt-3 flex flex-col gap-2.5">{CHECKS.map((check) => <CheckRow key={check.key} check={check} result={checks[check.key]} />)}</div></section></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4"><div className="max-w-md text-xs leading-relaxed text-muted-foreground"><p>Real-time connectivity is required to enter the interview.</p>{mediaUnavailable && <p className="mt-1 text-signal-vague">Camera or microphone will be off; you can continue in text mode.</p>}</div><div className="flex items-center gap-2"><Link to="/dashboard" onClick={clearMediaStream} className={cn(buttonVariants({ variant: 'ghost' }))}>Cancel</Link><Button size="lg" className="h-11 px-5" disabled={!connectionReady || running || starting} onClick={() => void enterInterview()}>{starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}{starting ? 'Starting…' : resuming ? 'Resume Interview' : 'Start Interview'}</Button></div></div>
  </div></AppShell>
}

function CheckRow({ check, result }: { check: (typeof CHECKS)[number]; result: CheckResult | undefined }) { const Icon = check.icon; const state = result?.state ?? 'checking'; const ready = state === 'ready' || state === 'supported'; const issue = state === 'blocked' || state === 'failed' || state === 'unsupported'; return <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3.5 py-3"><span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors', ready ? 'bg-(--signal-strong)/10 text-signal-strong ring-(--signal-strong)/30' : issue ? 'bg-(--signal-weak)/10 text-signal-weak ring-(--signal-weak)/30' : 'bg-secondary text-muted-foreground ring-border')}><Icon className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{check.label}</p><p className="text-xs text-muted-foreground">{result?.detail ?? check.desc}</p></div>{state === 'ready' ? <Badge variant="strong" dot>Ready</Badge> : state === 'supported' ? <Badge variant="good">Supported</Badge> : state === 'checking' ? <Loader2 className="size-4 animate-spin text-primary" /> : <span className="flex items-center gap-1 text-xs text-signal-weak"><CircleAlert className="size-3.5" />{state === 'blocked' ? 'Blocked' : 'Unavailable'}</span>}</div> }
function SummaryRow({ label, children }: { label: string; children: ReactNode }) { return <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0"><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span><span className="text-right text-sm">{children}</span></div> }
function LobbyNotice({ title, body }: { title: string; body: string }) { return <div className="mx-auto max-w-md pt-16 text-center"><h1 className="text-xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p><div className="mt-6 flex justify-center"><Link to="/interviews" className={cn(buttonVariants({ variant: 'outline' }))}>Back to interviews</Link></div></div> }
