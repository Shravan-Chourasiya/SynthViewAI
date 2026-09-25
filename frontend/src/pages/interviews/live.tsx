import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, Loader2 } from 'lucide-react'
import { QuestionPanel } from '@/components/interview-room/question-panel'
import {
  AiStatusBar,
  CandidateControls,
  ConnectionIndicator,
  EndInterviewDialog,
  InterviewTimer,
  VideoTile,
} from '@/components/interview-room/widgets'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useInterviewSocket } from '@/hooks/use-interview-socket'
import { useLiveInterviewStore } from '@/lib/stores/live-interview.store'
import type { Interview } from '@/lib/types'
import type { AIState, ConnectionState } from '@/components/interview-room/widgets'
import { cn } from '@/lib/utils'

export function LiveRoomPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const connectionState = useLiveInterviewStore((s) => s.connectionState)
  const aiStatus = useLiveInterviewStore((s) => s.aiStatus)
  const currentQuestion = useLiveInterviewStore((s) => s.currentQuestion)
  const questionNumber = useLiveInterviewStore((s) => s.questionNumber)
  const answeredCount = useLiveInterviewStore((s) => s.answeredCount)
  const totalQuestions = useLiveInterviewStore((s) => s.totalQuestions)
  const interviewStatus = useLiveInterviewStore((s) => s.interviewStatus)
  const socketError = useLiveInterviewStore((s) => s.error)
  const mediaStream = useLiveInterviewStore((s) => s.mediaStream)
  const clearMediaStream = useLiveInterviewStore((s) => s.clearMediaStream)
  const setMediaStream = useLiveInterviewStore((s) => s.setMediaStream)
  const [interview, setInterview] = useState<Interview | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [ended, setEnded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [cameraOn, setCameraOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement>(null); // Ref for screen video element
  const [endOpen, setEndOpen] = useState(false)
  const { submitAnswer, endInterview } = useInterviewSocket(interview?.id)

  const conn = connectionState as ConnectionState
  const ai = aiStatus === 'thinking' ? 'preparing' : aiStatus === 'generating' ? 'adapting' : aiStatus === 'evaluating' ? 'evaluating' : aiStatus === 'idle' ? 'idle' : 'ready' as AIState
  const question = currentQuestion
  const busy = ai === 'evaluating' || ai === 'adapting' || ai === 'preparing' || ai === 'unavailable'

  /* load interview + enforce state rules */
  useEffect(() => {
    if (!id) return
    api.getInterview(id).then((it) => {
      if (!it) {
        setNotFound(true)
        return
      }
      if (it.status === 'COMPLETED' || it.status === 'CANCELLED' || it.status === 'ABANDONED') {
        setEnded(true)
        return
      }
      setInterview(it)
    }).catch((err: unknown) => setLoadError(err instanceof Error ? err.message : 'Unable to load live interview.'))
  }, [id])

  // The lobby is the only place that calls getUserMedia. This room only
  // consumes that in-memory stream and cleans it up when the session ends.
  useEffect(() => {
    setCameraOn(Boolean(mediaStream?.getVideoTracks().some((track) => track.enabled)))
    setMicOn(Boolean(mediaStream?.getAudioTracks().some((track) => track.enabled)))
  }, [mediaStream])

  // Effect to handle screen stream in video element
  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  useEffect(() => () => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    screenStreamRef.current = null
    setScreenStream(null) // Clear screen stream state on unmount
    clearMediaStream()
  }, [clearMediaStream])

  const toggleCamera = async () => {
    const track = mediaStream?.getVideoTracks()[0]
    if (track) {
      track.enabled = !cameraOn
      setCameraOn(track.enabled)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        setMediaStream(new MediaStream([...(mediaStream?.getTracks() ?? []), ...stream.getVideoTracks()]))
      } catch { setMediaError('Camera permission was denied or no camera is available.') }
    }
  }

  const toggleMic = async () => {
    const track = mediaStream?.getAudioTracks()[0]
    if (track) {
      track.enabled = !micOn
      setMicOn(track.enabled)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setMediaStream(new MediaStream([...(mediaStream?.getTracks() ?? []), ...stream.getAudioTracks()]))
      } catch { setMediaError('Microphone permission was denied or no microphone is available.') }
    }
  }

  const toggleScreenShare = async () => {
    if (sharing) {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
      setScreenStream(null) // Clear screen stream state when stopping
      setSharing(false)
      return
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMediaError('Screen sharing is not supported by this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      screenStreamRef.current = stream
      setScreenStream(stream) // Set screen stream in state
      setSharing(true)
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        screenStreamRef.current = null
        setScreenStream(null) // Clear screen stream state when sharing ends
        setSharing(false)
      })
    } catch {
      setMediaError('Screen sharing was cancelled or permission was denied.')
    }
  }

  useEffect(() => {
    if (interviewStatus === 'CANCELLED' && interview) {
      clearMediaStream()
      navigate(`/interviews/${interview.id}`, { replace: true })
    }
    if (interviewStatus === 'COMPLETED' && interview) {
      clearMediaStream()
      navigate(`/interviews/${interview.id}/completed`, { replace: true })
    }
  }, [interviewStatus, interview, navigate, clearMediaStream])

  if (notFound) return <RoomNotice title="Interview not found" body="This interview doesn't exist or was removed." />
  if (ended)
    return (
      <RoomNotice
        title="Interview unavailable"
        body="This interview has already ended, so the live room can't be opened."
      />
    )

  // The not-loaded / waiting / live-room states are handled below; each keeps the
  // same room chrome so transitions between them stay within one layout.

  // The first question's arrival must not feel like a page change. The two
  // full-page states below ("interview not loaded yet" / "waiting for the first
  // question") used to be separate screens, so the room mounting over them was a
  // hard cut — header, panels and controls all popping in at once. Mounting the
  // room early with the question area as a skeleton keeps the chrome (top bar,
  // status row, side panel, controls) perfectly still, and only the question card
  // animates when the question actually arrives. `animate-fade-in` + `animate-reveal`
  // on the question container carry that one transition.
  const qIndex = questionNumber || 1
  const qTotal = totalQuestions ?? null

  // ── Not-yet-loaded interview: full-page shell with the same room chrome ─────
  // (interview metadata is unknown here, so the title block is a skeleton too.)
  if (!interview) {
    return (
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Activity className="size-4 animate-pulse text-primary" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-2.5 w-56" />
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="size-5 animate-spin text-primary" />
          <p className="font-mono text-xs text-muted-foreground">Loading session…</p>
        </div>
      </div>
    )
  }

  if (loadError) return <RoomNotice title="Interview unavailable" body={loadError} />

  if (socketError && !question) {
    return <RoomNotice title="Live session unavailable" body={socketError} />
  }

  // ── Waiting for the first question: the real room, minus the question ────────
  if (!question) {
    return (
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Activity className="size-4 text-primary" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{interview.roleTitle}</p>
              <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {interview.type} · {interview.difficulty} · Session #{interview.id}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">Live interview</span>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:overflow-hidden lg:p-5">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
              <div className="min-w-0 flex-1"><AiStatusBar state={ai} /></div>
              <ConnectionIndicator state={conn} />
              <LiveTimer />
            </div>
            {/* Skeleton shaped like the question card that will replace it — the
                page height does not jump when the real card arrives. */}
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-7 w-3/4 max-w-xl" />
              <Skeleton className="h-7 w-1/2 max-w-md" />
              <Skeleton className="mt-2 h-44 w-full" />
            </div>
          </div>

          <aside className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto">
            <VideoTile
              cameraOn={cameraOn}
              sharing={false}
              stream={mediaStream}
              name={user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username : 'Candidate'}
            />
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Progress
                </p>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">Q1/…</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: '0%' }} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Session notes
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                The interviewer adapts after every answer — strong responses raise
                difficulty, and vague ones trigger follow-ups. Your next question is
                prepared while the current answer is evaluated.
              </p>
            </div>
          </aside>
        </div>

        <CandidateControls
          cameraOn={cameraOn}
          micOn={micOn}
          sharing={sharing}
          onToggleCamera={toggleCamera}
          onToggleMic={toggleMic}
          onToggleShare={() => void toggleScreenShare()}
          onEnd={() => setEndOpen(true)}
        />

        <EndInterviewDialog
          open={endOpen}
          answeredCount={answeredCount}
          onClose={() => setEndOpen(false)}
          onConfirm={() => { setEndOpen(false); endInterview() }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <Activity className="size-4 text-primary" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{interview.roleTitle}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {interview.type} · {interview.difficulty} · Session #{interview.id}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">Live interview</span>
        </div>
      </header>

      {/* body */}
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:overflow-hidden lg:p-5">
        {/* main column */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
            <div className="min-w-0 flex-1"><AiStatusBar state={ai} /></div>
            <ConnectionIndicator state={conn} />
            <LiveTimer />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:p-6">
            {/* No code execution environment exists, so a coding question type is not
                reachable. If the backend ever delivers one, it is answered as text
                instead of rendering a run-code panel. */}
            <div key={question.id} className="animate-fade-in h-full">
              <QuestionPanel
                question={question}
                index={qIndex}
                total={qTotal}
                busy={busy}
                onSubmit={(text) => submitAnswer(question.id, text)}
              />
            </div>
          </div>
        </div>

        {/* side panel */}
        <aside className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto">
          {/* Camera tile */}
          <VideoTile 
            cameraOn={cameraOn} 
            sharing={false} 
            stream={mediaStream} 
            name={user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username : 'Candidate'} 
          />
          
          {/* Screen share tile - only show when actively sharing */}
          {sharing && screenStream && (
            <div className="animate-fade-in relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/40">
              <video 
                ref={screenVideoRef}
                autoPlay 
                muted 
                playsInline 
                className="absolute inset-0 size-full object-contain" 
              />
              <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 font-mono text-[10px] text-signal-weak ring-1 ring-(--signal-weak)/30">
                <span className="size-1.5 animate-pulse rounded-full bg-signal-weak" />
                SCREEN SHARE
              </span>
              <span className="absolute bottom-2.5 left-2.5 rounded-md bg-background/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                Screen
              </span>
            </div>
          )}
          
          {mediaError ? <p className="animate-fade-in text-xs text-signal-weak">{mediaError}</p> : null}

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Progress
              </p>
              <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                Q{qIndex}/{qTotal ?? '…'}
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{
                  width: qTotal
                    ? `${((qIndex - 1) / qTotal) * 100}%`
                    : '0%',
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>
                Round {interview.currentRound}/{interview.rounds}
              </span>
              <span>{interview.type}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Session notes
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              The interviewer adapts after every answer — strong responses raise
              difficulty, and vague ones trigger follow-ups. Your next question is
              prepared while the current answer is evaluated.
            </p>
          </div>
        </aside>
      </div>

      {/* controls */}
      <CandidateControls
        cameraOn={cameraOn}
        micOn={micOn}
        sharing={sharing}
        onToggleCamera={toggleCamera}
        onToggleMic={toggleMic}
        onToggleShare={() => void toggleScreenShare()}
        onEnd={() => setEndOpen(true)}
      />

      <EndInterviewDialog
        open={endOpen}
        answeredCount={answeredCount}
        onClose={() => setEndOpen(false)}
        onConfirm={() => { setEndOpen(false); endInterview() }}
      />
    </div>
  )
}

function RoomNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div className="animate-auth-card-in w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-6 flex justify-center">
          <Link to="/interviews" className={cn(buttonVariants({ variant: 'outline' }))}>
            Back to interviews
          </Link>
        </div>
      </div>
    </div>
  )
}

function LiveTimer() {
  const seconds = useLiveInterviewStore((state) => state.remainingSeconds)
  return <InterviewTimer seconds={seconds} />}