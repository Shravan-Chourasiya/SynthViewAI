import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Camera,
  Loader2,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  RefreshCcw,
  Video,
  VideoOff,
  Wifi,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatClock } from '@/lib/format'
import { STATUS_LABEL } from '@/lib/constants/live'
import type { LobbyCheck, LiveStatus } from '@/lib/types'

/* ------------------------------------------------------------ env check row */

export function CheckRow({
  check,
  onRun,
  disabled,
}: {
  check: LobbyCheck
  onRun: () => void
  disabled?: boolean
}) {
  const chipClass =
    check.status === 'ready'
      ? 'bg-signal-strong/10 ring-signal-strong/30 text-signal-strong'
      : check.status === 'error'
        ? 'bg-signal-weak/10 ring-signal-weak/30 text-signal-weak'
        : 'bg-primary/10 ring-primary/25 text-primary'

  return (
    <div className="flex items-center gap-4 py-3.5">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-colors',
          chipClass,
          check.status === 'error' && 'animate-shake-once',
        )}
      >
        {check.status === 'checking' ? (
          <Loader2 className="size-4.5 animate-spin" />
        ) : check.status === 'ready' ? (
          <svg viewBox="0 0 24 24" className="size-4.5" fill="none" aria-hidden>
            <path
              d="M5 12.5l4.5 4.5L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-draw-check"
            />
          </svg>
        ) : (
          <Activity className="size-4.5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{check.label}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {check.status === 'idle' ? 'not checked' : check.detail}
        </p>
      </div>

      <Button variant="ghost" size="sm" onClick={onRun} disabled={disabled || check.status === 'checking'}>
        <RefreshCcw className="size-3.5" />
        Re-run
      </Button>
    </div>
  )
}

/* --------------------------------------------------------------- camera tile */

export function CameraTile({ active }: { active: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    return () => {
      const stream = video?.srcObject as MediaStream | null
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function enable() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setStreaming(true)
      setError(false)
    } catch {
      setError(true)
    }
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-secondary/40">
      <video
        ref={videoRef}
        muted
        playsInline
        className={cn('size-full object-cover transition-opacity', streaming ? 'opacity-100' : 'opacity-0')}
      />

      {!streaming ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-grid text-center">
          {error ? (
            <>
              <VideoOff className="size-5 text-signal-weak" />
              <p className="px-4 font-mono text-[10px] uppercase tracking-wider text-signal-weak">
                camera blocked
              </p>
            </>
          ) : (
            <>
              <Camera className="size-5 text-muted-foreground" />
              <Button variant="outline" size="sm" onClick={enable}>
                Enable camera
              </Button>
            </>
          )}
        </div>
      ) : null}

      <div className="absolute top-2 left-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-signal-weak backdrop-blur">
          <span className={cn('size-1.5 rounded-full bg-signal-weak', active && 'animate-pulse-dot')} />
          REC
        </span>
      </div>

      <div className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white/80 backdrop-blur">
        {streaming ? <Video className="size-3" /> : <VideoOff className="size-3" />}
        you
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- ai status bar */

export function AiStatusBar({
  status,
  elapsedSeconds,
  muted,
  paused,
  onToggleMute,
  onTogglePause,
  onEnd,
}: {
  status: LiveStatus
  elapsedSeconds: number
  muted: boolean
  paused: boolean
  onToggleMute: () => void
  onTogglePause: () => void
  onEnd: () => void
}) {
  const bars = [0, 1, 2, 3]
  const active = status === 'listening' && !paused

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/25">
          <Activity className="size-4 text-primary" />
        </span>
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
            {STATUS_LABEL[status]}
            <span className="flex items-end gap-0.5" aria-hidden>
              {bars.map((bar) => (
                <span
                  key={bar}
                  className={cn(
                    'h-3 w-0.5 rounded-full bg-primary',
                    active ? 'animate-typing-bar' : 'opacity-30',
                  )}
                  style={active ? { animationDelay: `${bar * 130}ms` } : undefined}
                />
              ))}
            </span>
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
            {formatClock(elapsedSeconds)} elapsed
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={muted}
          onClick={onToggleMute}
        >
          {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={paused ? 'Resume session' : 'Pause session'}
          aria-pressed={paused}
          onClick={onTogglePause}
        >
          {paused ? <Mic className="size-4" /> : <Pause className="size-4" />}
        </Button>
        <Button variant="destructive" size="sm" onClick={onEnd}>
          <PhoneOff className="size-4" />
          End
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- connection chip */

export function ConnectionChip({ state }: { state: 'connected' | 'reconnecting' | 'offline' }) {
  const variant = state === 'connected' ? 'strong' : state === 'reconnecting' ? 'vague' : 'weak'
  return (
    <Badge variant={variant} dot>
      <Wifi className="size-3" />
      {state}
    </Badge>
  )
}
