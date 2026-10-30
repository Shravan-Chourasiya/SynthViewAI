import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Play, RotateCcw, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Panel } from '@/components/ui/panel'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { interviewService } from '@/lib/services'
import { DIFFICULTY_LABEL, TYPE_LABEL, formatRelative } from '@/lib/format'

export default function ResumablePage() {
  const query = useQuery({
    queryKey: ['interviews', 'resumable'],
    queryFn: () => interviewService.resumable(),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions you can still finish."
        lede="Interrupted sessions keep their answers, difficulty and place in the loop. Pick one up whenever you are ready."
      />

      {query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Panel key={i} className="space-y-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-9 w-28" />
            </Panel>
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-sm text-destructive">Could not load resumable sessions.</p>
      ) : query.data && query.data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {query.data.map((interview, index) => (
            <Panel
              key={interview.id}
              className="animate-rise-in space-y-4"
              style={{ '--stagger-i': index } as React.CSSProperties}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold tracking-tight">{interview.roleTitle}</h2>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {interview.code} · paused {formatRelative(interview.updatedAt)}
                  </p>
                </div>
                <StatusBadge status={interview.status} />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="neutral">{TYPE_LABEL[interview.type]}</Badge>
                <Badge variant="outline">{DIFFICULTY_LABEL[interview.difficulty]}</Badge>
                <Badge variant="default">
                  Round {interview.currentRound || 1}/{interview.rounds}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Question {interview.answeredCount + 1} of {interview.questionCount}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {Math.round(interview.progress * 100)}%
                  </span>
                </div>
                <Meter value={interview.progress * 100} label="Session progress" />
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Trash2 className="size-4" />
                  Discard
                </Button>
                <Link
                  to={`/interviews/${interview.id}/lobby`}
                  className={buttonVariants({ variant: 'default', size: 'default' })}
                >
                  <Play className="size-4" />
                  Resume
                </Link>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={RotateCcw}
          title="Nothing waiting for you"
          description="Sessions appear here as soon as one is paused or interrupted mid-round."
          action={
            <Link to="/interviews/new" className={buttonVariants({ variant: 'outline' })}>
              Start an interview
            </Link>
          }
        />
      )}
    </div>
  )
}
