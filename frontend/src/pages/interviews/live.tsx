import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Activity, Gauge, Notebook, PhoneOff, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AiStatusBar, CameraTile, ConnectionChip } from '@/components/interview-room/room-parts'
import { AiOrb } from '@/components/ai-orb'
import { QuestionPanel } from '@/components/interview-room/question-panel'
import { CodeAnswerPanel } from '@/components/interview-room/code-answer-panel'
import { useInterviewSocket } from '@/hooks/use-interview-socket'
import { useInterviewStore } from '@/lib/stores/interview-store'
import { interviewService } from '@/lib/services'
import { DIFFICULTY_LABEL, formatClock } from '@/lib/format'
import { STATUS_LABEL } from '@/lib/constants/live'

export default function LiveRoomPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [muted, setMuted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  /**
   * The gateway only admits a join once the interview has a server-side session
   * context, which `POST /interviews/:id/start` creates — so the room waits for
   * that transition instead of dialling into a context that is not there yet.
   */
  const [roomEnabled, setRoomEnabled] = useState(false)

  const notes = useInterviewStore((s) => s.notes)
  const setNote = useInterviewStore((s) => s.setNote)
  const setAnswer = useInterviewStore((s) => s.setAnswer)

  const interviewQuery = useQuery({
    queryKey: ['interview', id],
    queryFn: () => interviewService.get(id),
    // The room is driven by socket delivery, not by the history endpoint —
    // history is only readable once an interview is in a terminal state.
    retry: false,
  })

  const {
    status,
    connection,
    streamed,
    activeQuestion,
    totalQuestions,
    complete,
    submitAnswer,
    submitCode,
    endInterview,
  } = useInterviewSocket(id || null, roomEnabled && !!id)

  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [paused])

  const interview = interviewQuery.data
  const current = activeQuestion
  const total = totalQuestions ?? interview?.questionCount ?? 0
  const index = current?.index ?? 0
  /** Unknown totals must not render as "Q1/0"; the panels fall back to the index. */
  const questionTotal = total > 0 ? total : index + 1
  /** The backend decides the answer surface per question (`answerFormat`). */
  const isCodeQuestion =
    current != null && (current.kind === 'code' || current.answerFormat === 'CODE')

  useEffect(() => {
    if (complete) navigate(`/interviews/${id}/completed`)
  }, [complete, id, navigate])

  // Start the session (READY/SCHEDULED → INPROGRESS) before the socket dials in.
  useEffect(() => {
    const session = interviewQuery.data
    if (!session || roomEnabled) return
    if (session.status === 'in-progress') {
      setRoomEnabled(true)
      return
    }
    if (session.status !== 'scheduled' && session.status !== 'draft') {
      // Completed or abandoned sessions have no room to enter.
      return
    }
    let cancelled = false
    interviewService
      .start(session.id)
      .then(() => {
        if (!cancelled) setRoomEnabled(true)
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not start this interview')
      })
    return () => {
      cancelled = true
    }
  }, [interviewQuery.data, roomEnabled])

  const endMutation = useMutation({
    mutationFn: () => interviewService.end(id),
    onSuccess: () => {
      endInterview()
      navigate(`/interviews/${id}/completed`)
    },
    onError: () => toast.error('Could not end the interview'),
  })

  function handleSubmit(answer: string) {
    if (!current) return
    setAnswer(current.id, answer)
    // The gateway persists it and answers with `answer:accepted`; the next
    // question arrives as `question:delivered`.
    submitAnswer(current.id, answer)
    toast.success('Answer submitted')
  }

  /** Code answers go out on `code:submit` so language and code are stored separately. */
  function handleCodeSubmit(code: string, language: string) {
    if (!current) return
    submitCode(current.id, language, code)
    setAnswer(current.id, code)
    toast.success('Answer submitted')
  }

  if (interviewQuery.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Skeleton className="h-[32rem] rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-7.5rem)] flex-col gap-4">
      {/* room header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
            <Activity className="size-4.5 text-primary" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">{interview?.roleTitle ?? 'Interview'}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {interview?.code} · {interview?.field} · {interview ? DIFFICULTY_LABEL[interview.difficulty] : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionChip state={connection} />
          <Badge variant="weak" dot>
            Live interview
          </Badge>
        </div>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <AiStatusBar
            status={status}
            elapsedSeconds={elapsed}
            muted={muted}
            paused={paused}
            onToggleMute={() => setMuted((value) => !value)}
            onTogglePause={() => setPaused((value) => !value)}
            onEnd={() => setEndOpen(true)}
          />

          {isCodeQuestion && current ? (
            <CodeAnswerPanel
              question={current}
              index={index}
              total={questionTotal}
              busy={status === 'evaluating'}
              paused={paused}
              onSubmit={handleCodeSubmit}
            />
          ) : current ? (
            <QuestionPanel
              question={current}
              index={index}
              total={questionTotal}
              streamed={streamed}
              streaming={status === 'generating' || status === 'listening'}
              answering={status === 'listening' && !paused}
              onSubmit={handleSubmit}
              onSkip={() => handleSubmit('(skipped)')}
            />
          ) : (
            <Panel className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
                <Activity className="size-4 text-primary" />
              </span>
              <p className="text-sm text-muted-foreground">
                The interviewer is preparing your first question…
              </p>
            </Panel>
          )}
        </div>

        {/* aside */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Panel className="flex flex-col items-center gap-2 py-6">
            <AiOrb status={status} size={136} />
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Interviewer
            </p>
            <p className="text-sm font-medium tracking-tight">{STATUS_LABEL[status]}</p>
          </Panel>

          <CameraTile active={!muted} />

          <Panel flush>
            <PanelHeader title="Progress" />
            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Question
                  </span>
                  <span className="font-mono text-[11px] tabular-nums">
                    Q{Math.min(index + 1, questionTotal)}/{questionTotal}
                  </span>
                </div>
                <Meter
                  value={((index + 1) / questionTotal) * 100}
                  label="Question progress"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2">
                <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Gauge className="size-3.5" />
                  Difficulty
                </span>
                <span className="font-mono text-[11px]">
                  {current ? DIFFICULTY_LABEL[current.difficulty] : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Elapsed
                </span>
                <span className="font-mono text-[11px] tabular-nums">{formatClock(elapsed)}</span>
              </div>
            </div>
          </Panel>

          <Panel flush>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Notebook className="size-3.5 text-muted-foreground" />
                  Session notes
                </span>
              }
            />
            <div className="p-5 pt-4">
              <Textarea
                value={notes}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                placeholder="Jot down anything you want to revisit…"
                aria-label="Session notes"
              />
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                private · not scored
              </p>
            </div>
          </Panel>

          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            onClick={() => setEndOpen(true)}
          >
            <PhoneOff className="size-4" />
            End interview
          </Button>

          <p className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-card/50 p-3 text-xs leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            Leaving now keeps the session resumable. Nothing you have answered is lost.
          </p>
        </aside>
      </div>

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End the interview?</DialogTitle>
            <DialogDescription>
              You are on question {index + 1} of {questionTotal}. Ending early still produces a
              report, but the score is partial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEndOpen(false)}>
              Keep going
            </Button>
            <Button
              variant="destructive"
              disabled={endMutation.isPending}
              onClick={() => endMutation.mutate()}
            >
              <PhoneOff className="size-4" />
              End and see results
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
