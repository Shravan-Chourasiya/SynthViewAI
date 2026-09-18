import * as React from 'react'
import {
  AlertTriangle,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Sparkles,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  Maximize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'
export type AIState = 'idle' | 'preparing' | 'evaluating' | 'adapting' | 'ready' | 'unavailable'

/* ---------------- connection indicator (FR-12) ---------------- */

const CONN_META: Record<
  ConnectionState,
  { label: string; dot: string; text: string; pulse: boolean }
> = {
  idle: { label: 'Idle', dot: 'bg-muted-foreground', text: 'text-muted-foreground', pulse: false },
  connecting: { label: 'Connecting…', dot: 'bg-primary', text: 'text-primary', pulse: true },
  connected: { label: 'Connected', dot: 'bg-[var(--signal-strong)]', text: 'text-[var(--signal-strong)]', pulse: false },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-[var(--signal-vague)]', text: 'text-[var(--signal-vague)]', pulse: true },
  disconnected: { label: 'Disconnected', dot: 'bg-[var(--signal-weak)]', text: 'text-[var(--signal-weak)]', pulse: false },
  error: { label: 'Connection error', dot: 'bg-[var(--signal-weak)]', text: 'text-[var(--signal-weak)]', pulse: false },
}

export function ConnectionIndicator({ state }: { state: ConnectionState }) {
  const meta = CONN_META[state]
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-2 font-mono text-[11px]', meta.text)}
    >
      <span className="relative flex size-2">
        {meta.pulse ? (
          <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', meta.dot)} />
        ) : null}
        <span className={cn('relative inline-flex size-2 rounded-full', meta.dot)} />
      </span>
      {state === 'reconnecting' ? (
        <WifiOff className="size-3.5" />
      ) : state === 'connected' ? (
        <Wifi className="size-3.5" />
      ) : null}
      {meta.label}
    </span>
  )
}

/* ---------------- AI status bar (FR-13/14, NFR-11) ---------------- */

const AI_LABEL: Record<AIState, string> = {
  idle: 'AI interviewer standing by',
  preparing: 'AI interviewer is preparing your next question',
  evaluating: 'AI interviewer is evaluating your response',
  adapting: 'Adapting the interview — routing your next question',
  ready: 'AI interviewer ready — answer when you are set',
  unavailable:
    'AI service temporarily unavailable — retrying automatically, your session is safe',
}

export function AiStatusBar({ state }: { state: AIState }) {
  const busy = state === 'preparing' || state === 'evaluating' || state === 'adapting'
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 transition-colors',
        state === 'unavailable'
          ? 'border-(--signal-vague)/30 bg-(--signal-vague)/5'
          : 'border-border bg-card',
      )}
    >
      {state === 'unavailable' ? (
        <AlertTriangle className="size-3.5 shrink-0 text-signal-vague" />
      ) : busy ? (
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
      ) : (
        <Sparkles className="size-3.5 shrink-0 text-primary" />
      )}
      <span
        key={state}
        className={cn(
          'animate-fade-in flex-1 font-mono text-[11px]',
          state === 'unavailable' ? 'text-signal-vague' : 'text-muted-foreground',
        )}
      >
        {AI_LABEL[state]}
      </span>
      {busy ? <TypingBars /> : null}
    </div>
  )
}

function TypingBars() {
  return (
    <span className="flex items-end gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-0.5 h-2.5 origin-bottom rounded-full bg-primary"
          style={{
            height: 10,
            animation: 'typing-bar 1s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </span>
  )
}

/* ---------------- timer (FR-25) ---------------- */

export function InterviewTimer({ seconds }: { seconds: number }) {
  const s = Math.max(0, seconds)
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  const warn = s > 0 && s < 120
  return (
    <span
      aria-label="Time remaining"
      className={cn(
        'rounded-md px-2.5 py-1 font-mono text-sm tabular-nums ring-1 transition-colors',
        warn
          ? 'bg-(--signal-weak)/10 text-signal-weak ring-(--signal-weak)/30'
          : 'bg-background text-foreground ring-border',
      )}
    >
      {mm}:{ss}
    </span>
  )
}

/* ---------------- candidate video tile (FR-09/10) ---------------- */

export function VideoTile({
  cameraOn,
  sharing,
  name,
  stream,
}: {
  cameraOn: boolean
  sharing: boolean
  name: string
  stream?: MediaStream | null
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    if (videoRef.current) {
      // Set the video source to the stream if available and camera is on
      videoRef.current.srcObject = (cameraOn && stream) ? stream : null;
    }
  }, [stream, cameraOn])

  const ini = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/40">
      {stream && cameraOn ? (
        <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 size-full object-cover" />
      ) : null}
      {sharing ? (
        <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 font-mono text-[10px] text-signal-weak ring-1 ring-(--signal-weak)/30">
          <span className="size-1.5 animate-pulse rounded-full bg-signal-weak" />
          SHARING
        </span>
      ) : null}
      
      {cameraOn ? (
        <>
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary ring-1 ring-primary/30">
            {ini}
          </span>
          <span className="mt-2 font-mono text-[10px] text-muted-foreground">Camera on</span>
        </>
      ) : (
        <>
          <VideoOff className="size-6 text-muted-foreground" />
          <span className="mt-2 font-mono text-[10px] text-muted-foreground">Camera off</span>
        </>
      )}
      <span className="absolute bottom-2.5 left-2.5 rounded-md bg-background/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
        You
      </span>
    </div>
  )
}

/* ---------------- candidate controls (FR-09/10/11) ---------------- */

export function CandidateControls({
  cameraOn,
  micOn,
  sharing,
  onToggleCamera,
  onToggleMic,
  onToggleShare,
  onEnd,
}: {
  cameraOn: boolean
  micOn: boolean
  sharing: boolean
  onToggleCamera: () => void
  onToggleMic: () => void
  onToggleShare: () => void
  onEnd: () => void
}) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-border bg-card/60 px-4 py-3 backdrop-blur-xl">
      <ControlButton
        active={cameraOn}
        onClick={onToggleCamera}
        label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
        IconOn={Video}
        IconOff={VideoOff}
      />
      <ControlButton
        active={micOn}
        onClick={onToggleMic}
        label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        IconOn={Mic}
        IconOff={MicOff}
      />
      <ControlButton
        active={sharing}
        onClick={onToggleShare}
        label={sharing ? 'Stop screen sharing' : 'Start screen sharing'}
        IconOn={Monitor}
        IconOff={MonitorOff}
        tone="primary"
      />
      <span className="mx-2 h-6 w-px bg-border" aria-hidden="true" />
      <Button variant="destructive" size="sm" className="h-10 gap-2 px-5" onClick={onEnd}>
        <PhoneOff className="size-4" />
        End
      </Button>
    </div>
  )
}

function ControlButton({
  active,
  onClick,
  label,
  IconOn,
  IconOff,
  tone = 'danger',
}: {
  active: boolean
  onClick: () => void
  label: string
  IconOn: typeof Video
  IconOff: typeof Video
  tone?: 'danger' | 'primary'
}) {
  const activeCls =
    tone === 'primary'
      ? 'bg-primary/15 text-primary ring-primary/30 hover:bg-primary/25'
      : 'bg-background text-foreground ring-border hover:bg-accent'
  const inactiveCls =
    tone === 'primary'
      ? 'bg-background text-muted-foreground ring-border hover:bg-accent'
      : 'bg-[var(--signal-weak)]/15 text-[var(--signal-weak)] ring-[var(--signal-weak)]/30 hover:bg-[var(--signal-weak)]/25'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex size-11 items-center justify-center rounded-full ring-1 transition-all',
        active ? activeCls : inactiveCls,
      )}
    >
      {active ? <IconOn className="size-4.5" /> : <IconOff className="size-4.5" />}
    </button>
  )
}

/* ---------------- end-interview dialog (FR-11, FR-26) ---------------- */

export function EndInterviewDialog({
  open,
  answeredCount,
  onConfirm,
  onClose,
}: {
  open: boolean
  answeredCount: number
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--signal-weak)/10 ring-1 ring-(--signal-weak)/30">
            <PhoneOff className="size-4 text-signal-weak" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">End interview?</h2>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              This closes the live session
            </p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You have answered {answeredCount} question{answeredCount === 1 ? '' : 's'}. Are you sure you want to end this interview? The live session cannot be resumed after ending it.
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Keep interviewing
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            <PhoneOff className="size-4" />
            End interview
          </Button>
        </div>
      </div>
    </Dialog>
  )
}