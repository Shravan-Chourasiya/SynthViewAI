import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Flame,
  Play,
  Plus,
  Target,
  Trophy,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { buttonVariants } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Meter } from '@/components/ui/meter'
import { Skeleton, SkeletonRows, SkeletonStatGrid } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { ScoreChip, StatCard } from '@/components/stat-card'
import { Sparkline } from '@/components/charts'
import { interviewService, analyticsService } from '@/lib/services'
import { useAuthStore } from '@/lib/stores/auth-store'
import { DIFFICULTY_LABEL, TYPE_LABEL, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  const interviews = useQuery({
    queryKey: ['interviews', 'recent'],
    queryFn: () => interviewService.list({ sort: 'recent', pageSize: 5 }),
  })

  const resumable = useQuery({
    queryKey: ['interviews', 'resumable'],
    queryFn: () => interviewService.resumable(),
  })

  const analytics = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => analyticsService.summary(),
  })

  const completed = interviews.data?.items.filter((i) => i.status === 'completed') ?? []
  const scores = completed.map((i) => i.score ?? 0)
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const best = scores.length ? Math.max(...scores) : 0
  const inProgress = resumable.data ?? []
  const firstName = (user?.name ?? user?.username ?? 'there').split(' ')[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${firstName}.`}
        lede="Pick up a session, or start a fresh one. Everything below is your own history."
        actions={
          <Link to="/interviews/new" className={cn(buttonVariants({ size: 'lg' }), 'h-11 px-5')}>
            <Plus className="size-4" />
            New interview
          </Link>
        }
      />

      {inProgress.length > 0 ? (
        <div className="animate-rise-in space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-primary">Resume your session</p>
              <h2 className="text-lg font-semibold tracking-tight">{inProgress[0]!.roleTitle}</h2>
              <p className="font-mono text-[11px] text-muted-foreground">
                {inProgress[0]!.code} · Q
                {Math.min(inProgress[0]!.answeredCount + 1, inProgress[0]!.questionCount)} of{' '}
                {inProgress[0]!.questionCount} · Round {inProgress[0]!.currentRound || 1}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32">
                <Meter value={inProgress[0]!.progress * 100} label="Session progress" />
              </div>
              <Link
                to={`/interviews/${inProgress[0]!.id}/lobby`}
                className={cn(buttonVariants({ size: 'lg' }), 'h-11 px-5')}
              >
                <Play className="size-4" />
                Resume
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {analytics.isLoading ? (
        <SkeletonStatGrid />
      ) : analytics.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          Could not load your statistics.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={BarChart3} label="Total sessions" value={interviews.data?.total ?? 0} index={0} numeric />
          <StatCard icon={Target} label="Completed" value={completed.length} index={1} numeric hint="In recent history" />
          <StatCard icon={Flame} label="Average score" value={average} index={2} numeric suffix="/100" />
          <StatCard icon={Trophy} label="Best score" value={best} index={3} numeric suffix="/100" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Panel flush>
          <PanelHeader
            title="Score trend"
            description="Last sessions, oldest to newest"
            aside={
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                avg {average || '—'}
              </span>
            }
          />
          <div className="p-5">
            {analytics.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : analytics.data ? (
              <Sparkline
                data={(analytics.data.scoreOverTime ?? []).map((point) => point.score)}
                height={110}
              />
            ) : null}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
              {(analytics.data?.scoreOverTime ?? []).slice(-3).map((point) => (
                <div key={point.label}>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {point.label}
                  </p>
                  <p className="mt-1 font-mono text-sm tabular-nums">{point.score}/100</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel flush>
          <PanelHeader title="Category performance" description="Rolling average by dimension" />
          <div className="space-y-4 p-5">
            {analytics.isLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              : (analytics.data?.byCategory ?? []).slice(0, 5).map((row) => (
                  <div key={row.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{row.category}</span>
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {row.score}/100
                      </span>
                    </div>
                    <Meter value={row.score} tone={row.score >= 82 ? 'strong' : row.score >= 70 ? 'good' : row.score >= 58 ? 'vague' : 'weak'} />
                  </div>
                ))}
          </div>
        </Panel>
      </div>

      <Panel flush>
        <PanelHeader
          title="Recent interviews"
          aside={
            <Link
              to="/interviews"
              className="rounded font-mono text-[10px] uppercase tracking-wider text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              View all
            </Link>
          }
        />

        {interviews.isLoading ? (
          <SkeletonRows rows={5} />
        ) : interviews.isError ? (
          <p className="p-5 text-sm text-destructive">Could not load your interviews.</p>
        ) : interviews.data && interviews.data.items.length > 0 ? (
          <ul className="divide-y divide-border">
            {interviews.data.items.map((interview, index) => (
              <li
                key={interview.id}
                className="animate-rise-in"
                style={{ '--stagger-i': index } as React.CSSProperties}
              >
                <Link
                  to={`/interviews/${interview.id}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 outline-none transition-colors hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{interview.roleTitle}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {interview.code} · {formatDate(interview.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{TYPE_LABEL[interview.type]}</Badge>
                    <Badge variant="outline">{DIFFICULTY_LABEL[interview.difficulty]}</Badge>
                    <StatusBadge status={interview.status} />
                    <ScoreChip score={interview.score} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={CalendarClock}
              title="No interviews yet"
              description="Your first session takes about half an hour and produces a full report."
              action={
                <Link to="/interviews/new" className={buttonVariants({})}>
                  Start an interview
                  <ArrowRight className="size-4" />
                </Link>
              }
            />
          </div>
        )}
      </Panel>
    </div>
  )
}
