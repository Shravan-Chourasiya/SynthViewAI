import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, Hourglass, ListChecks, Play, Plus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { DifficultyBadge, TypeBadge } from '@/components/interview-ui'
import { useInterviewListStore } from '@/lib/stores/interview-list.store'
import { timeAgo } from '@/lib/format'
import type { Interview } from '@/lib/types'
import { cn } from '@/lib/utils'
import { notifySuccess } from '@/lib/notify'

export function ResumablePage() {
  const interviews = useInterviewListStore((s) => s.interviews)
  const listStatus = useInterviewListStore((s) => s.status)
  const fetchInterviews = useInterviewListStore((s) => s.fetchInterviews)
  const cancelInterview = useInterviewListStore((s) => s.cancelInterview)
  const [target, setTarget] = useState<Interview | null>(null)

  useEffect(() => {
    // The store surfaces failures through `status`/`error`.
    void fetchInterviews().catch(() => undefined)
  }, [fetchInterviews])

  const list = interviews.filter((i) => i.status === 'IN_PROGRESS' || i.status === 'CREATED' || i.status === 'READY')

  return (
    <AppShell title="Resumable Interviews">
      <div className="animate-slide-up mx-auto flex max-w-7xl flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Resume where you left off
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Interrupted interviews keep their exact state — round, question and
            progress are restored when you rejoin.
          </p>
        </header>

        {listStatus === 'idle' || listStatus === 'loading' ? (
          <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : listStatus === 'error' ? (
          <p className="text-sm text-destructive">Unable to load resumable interviews.</p>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-(--signal-strong)/10 ring-1 ring-(--signal-strong)/30">
              <CheckCircle2 className="size-6 text-signal-strong" />
            </span>
            <h2 className="mt-5 text-lg font-semibold tracking-tight">
              You're all caught up.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              No interrupted interviews need your attention. Start a fresh
              session whenever you're ready.
            </p>
            <div className="mt-6 flex justify-center">
              <Link to="/interviews/new" className={cn(buttonVariants(), 'h-10 px-4')}>
                <Plus className="size-4" />
                Start a new interview
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {list.map((i) => (
              <ResumableCard key={i.id} interview={i} onCancel={() => setTarget(i)} />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={target !== null}
        title="Cancel this interview?"
        description={
          target
            ? `“${target.roleTitle}” will be marked as cancelled. This can't be undone, and its progress will no longer be resumable.`
            : ''
        }
        confirmLabel="Cancel interview"
        destructive
        onClose={() => setTarget(null)}
        onConfirm={() => {
          if (target) {
            cancelInterview(target.id).then(() => {
              notifySuccess('Interview cancelled successfully!');
            });
          }
        }}
      />
    </AppShell>
  )
}

function ResumableCard({
  interview: i,
  onCancel,
}: {
  interview: Interview
  onCancel: () => void
}) {
  const pct = Math.round(i.progress * 100)
  const remaining = Math.max(1, Math.round(i.durationMin * (1 - i.progress)))

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TypeBadge type={i.type} />
          <DifficultyBadge difficulty={i.difficulty} />
        </div>
        <StatusBadge status={i.status} />
      </div>

      <div>
        <h2 className="text-base font-semibold tracking-tight">{i.roleTitle}</h2>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {i.company} · {i.domain}
        </p>
      </div>

      <div className="flex flex-col gap-2 font-mono text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          Last active {timeAgo(i.lastActivityAt)}
        </span>
        <span className="flex items-center gap-1.5">
          <ListChecks className="size-3.5" />
          {i.status === 'IN_PROGRESS'
            ? `Round ${i.currentRound}/${i.rounds} · Question ${i.currentQuestion}`
            : 'Configured · not started yet'}
        </span>
        <span className="flex items-center gap-1.5">
          <Hourglass className="size-3.5" />~{remaining} min remaining
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>Progress</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-1">
        <Link
          to={`/interviews/${i.id}/lobby`}
          className={cn(buttonVariants({ size: 'sm' }), 'flex-1 justify-center')}
        >
          <Play className="size-3.5" />
          {i.status === 'IN_PROGRESS' ? 'Resume Interview' : 'Start Interview'}
        </Link>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </article>
  )
}