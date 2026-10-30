import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Camera, Mic, Play, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckRow } from '@/components/interview-room/room-parts'
import { interviewService } from '@/lib/services'
import { RULES } from '@/lib/constants/interview'
import { DIFFICULTY_LABEL, TYPE_LABEL, formatRelative } from '@/lib/format'
import type { LobbyCheck } from '@/lib/types'
import { cn } from '@/lib/utils'

const INITIAL_CHECKS: LobbyCheck[] = [
  { id: 'camera', label: 'Camera', status: 'idle', detail: '' },
  { id: 'microphone', label: 'Microphone', status: 'idle', detail: '' },
]

export default function LobbyPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [checks, setChecks] = useState<LobbyCheck[]>(INITIAL_CHECKS)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [countdown, setCountdown] = useState(7)

  const query = useQuery({
    queryKey: ['interview', id],
    queryFn: () => interviewService.get(id),
  })

  const interview = query.data
  const isResume = interview?.status === 'in-progress'
  const allReady = checks.every((check) => check.status === 'ready')

  async function runCheck(target: 'camera' | 'microphone') {
    setChecks((current) =>
      current.map((check) => (check.id === target ? { ...check, status: 'checking' } : check)),
    )

    if (target === 'camera') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach((track) => track.stop())
        setChecks((current) =>
          current.map((check) =>
            check.id === target ? { ...check, status: 'ready', detail: '1080p · 30fps' } : check,
          ),
        )
      } catch {
        setChecks((current) =>
          current.map((check) =>
            check.id === target ? { ...check, status: 'error', detail: 'permission denied' } : check,
          ),
        )
      }
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setChecks((current) =>
        current.map((check) =>
          check.id === target ? { ...check, status: 'ready', detail: 'input level normal' } : check,
        ),
      )
    } catch {
      setChecks((current) =>
        current.map((check) =>
          check.id === target ? { ...check, status: 'error', detail: 'no input device' } : check,
        ),
      )
    }
  }

  useEffect(() => {
    if (!dialogOpen) return
    setCountdown(7)
    const timer = window.setInterval(() => {
      setCountdown((value) => (value <= 1 ? 0 : value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [dialogOpen])

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (!interview) {
    return (
      <div className="mx-auto max-w-4xl">
        <Panel className="text-center">
          <h2 className="text-base font-semibold tracking-tight">That session no longer exists</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been deleted, or the link is stale.
          </p>
          <Link to="/interviews/new" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
            Start a new interview
          </Link>
        </Panel>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow={interview.code}
        title={isResume ? 'Ready to continue?' : 'Your room is ready.'}
        lede={
          isResume
            ? 'Everything you have already answered is saved. The interviewer will pick up at the next question.'
            : 'Check your camera and microphone, read the rules once, then start.'
        }
        actions={<StatusBadge status={interview.status} />}
      />

      {isResume ? (
        <div className="animate-rise-in space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-primary">Resuming session</p>
              <p className="mt-1 text-sm">
                Round {interview.currentRound || 1} of {interview.rounds} · question{' '}
                {interview.answeredCount + 1} of {interview.questionCount} · paused{' '}
                {formatRelative(interview.updatedAt)}
              </p>
            </div>
            <div className="w-40">
              <Meter value={interview.progress * 100} label="Session progress" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel flush>
          <PanelHeader title="Interview summary" />
          <dl className="divide-y divide-border">
            {[
              { label: 'Role', value: interview.roleTitle },
              { label: 'Field', value: interview.field },
              { label: 'Company', value: interview.company ?? 'Not specified' },
              { label: 'Duration', value: `${interview.durationMinutes} minutes` },
              { label: 'Rounds', value: `${interview.rounds}` },
              { label: 'Questions', value: `${interview.questionCount}` },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="truncate text-sm">{row.value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Format</dt>
              <dd className="flex gap-1.5">
                <Badge variant="default">{TYPE_LABEL[interview.type]}</Badge>
                <Badge variant="outline">{DIFFICULTY_LABEL[interview.difficulty]}</Badge>
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel flush>
          <PanelHeader title="Environment check" description="Both must pass before you can start" />
          <div className="divide-y divide-border px-5">
            <CheckRow
              check={checks[0]!}
              onRun={() => runCheck('camera')}
            />
            <CheckRow check={checks[1]!} onRun={() => runCheck('microphone')} />
          </div>
          <div className="border-t border-border bg-secondary/30 px-5 py-3">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {allReady ? (
                <>
                  <ShieldCheck className="size-3.5 text-signal-strong" />
                  all checks passed
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3.5 text-signal-vague" />
                  checks required
                </>
              )}
            </p>
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Link to={`/interviews/${interview.id}`} className={buttonVariants({ variant: 'ghost' })}>
          Cancel
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              runCheck('camera')
              runCheck('microphone')
            }}
          >
            Run all checks
          </Button>
          <span className="relative">
            {allReady ? (
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-1 animate-glow-pulse rounded-xl bg-primary/30 blur-md"
              />
            ) : null}
            <Button
              size="lg"
              disabled={!allReady}
              onClick={() => setDialogOpen(true)}
              className={cn('relative h-11 px-6', allReady && 'animate-ready-enter')}
            >
              {isResume ? <Play className="size-4" /> : <Camera className="size-4" />}
              {isResume ? 'Resume interview' : 'Start interview'}
            </Button>
          </span>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Before you begin</DialogTitle>
            <DialogDescription>
              Thirty minutes, one question at a time, and an honest report at the end.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-3">
            {RULES.map((rule) => (
              <li key={rule} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                {rule}
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Not yet
            </Button>
            <Button
              disabled={countdown > 0}
              onClick={() => {
                setDialogOpen(false)
                navigate(`/interviews/${interview.id}/live`)
              }}
            >
              {countdown > 0 ? (
                <span className="font-mono tabular-nums">Confirm in {countdown}s</span>
              ) : (
                <>
                  <Mic className="size-4" />
                  Enter the room
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
