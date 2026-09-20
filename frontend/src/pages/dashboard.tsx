import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  BarChart3,
  ClipboardList,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Sparkline } from '@/components/charts'
import { StatusBadge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DifficultyBadge, RowAction, TypeBadge } from '@/components/interview-ui'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useInterviewListStore } from '@/lib/stores/interview-list.store'
import { fmtDate } from '@/lib/format'
import type { Interview } from '@/lib/types'
import { cn } from '@/lib/utils'

interface DashData {
  average: number
  best: number
  total: number
  completed: number
  trend: number[]
  categories: { label: string; value: number }[]
  recent: Interview[]
  resumable: Interview | null
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const interviews = useInterviewListStore((s) => s.interviews)
  const interviewStatus = useInterviewListStore((s) => s.status)
  const fetchInterviews = useInterviewListStore((s) => s.fetchInterviews)

  // Derived in render (no stale-state race): the effect only triggers fetches,
  // and every store update re-renders with fresh numbers automatically.
  const data: DashData | null = useMemo(() => {
    if (interviewStatus === 'idle' || interviewStatus === 'loading') return null
    const completed = interviews.filter((interview) => interview.status === 'COMPLETED')
    const scores = completed.map((interview) => interview.score).filter((score): score is number => score !== null)
    const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0
    const categories = ['Behavioral', 'Technical', 'Coding', 'Mixed']
      .map((label) => {
        const values = completed
          .filter((interview) => interview.type === label)
          .map((interview) => interview.score)
          .filter((score): score is number => score !== null)
        return { label, value: values.length ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length) : 0 }
      })
      .filter((category) => category.value > 0)
    return {
      average,
      best: scores.length ? Math.max(...scores) : 0,
      total: interviews.length,
      completed: completed.length,
      trend: scores.slice(-8),
      categories,
      recent: interviews.slice(0, 4),
      resumable: interviews.find((i) => i.status === 'IN_PROGRESS') ?? null,
    }
  }, [interviews, interviewStatus])

  useEffect(() => {
    // The store surfaces failures through `status`/`error`.
    void fetchInterviews().catch(() => undefined)
  }, [fetchInterviews])

  const firstName = (user?.firstName ?? user?.username ?? 'there').split(' ')[0]
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <AppShell title="Dashboard">
      {interviewStatus === 'loading' || interviewStatus === 'idle' ? (
        <DashboardSkeleton />
      ) : interviewStatus === 'error' ? (
        <p className="text-sm text-destructive">Unable to load dashboard interviews.</p>
      ) : data ? (
        <DashboardContent data={data} firstName={firstName} greeting={greeting} />
      ) : (
        <DashboardSkeleton />
      )}
    </AppShell>
  )
}

function DashboardContent({
  data,
  firstName,
  greeting,
}: {
  data: DashData
  firstName: string
  greeting: string
}) {
  return (
    <div className="animate-slide-up mx-auto flex max-w-7xl flex-col gap-6">
      {/* greeting header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Candidate dashboard
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Every answer changes what the interviewer asks next. Pick up where
            you left off, or start a fresh adaptive session.
          </p>
        </div>
        {data.total > 0 ? (
          <Link
            to="/interviews/new"
            className={cn(buttonVariants({ size: 'lg' }), 'h-11 px-5')}
          >
            <Plus className="size-4" />
            Start New Interview
          </Link>
        ) : null}
      </div>

      {data.total === 0 ? (
        <EmptyDashboard />
      ) : (
        <>
          {data.resumable ? <ResumeBanner interview={data.resumable} /> : null}

          {/* stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={ClipboardList} label="Total interviews" value={String(data.total)} />
            <StatCard icon={Award} label="Completed" value={String(data.completed)} />
            <StatCard icon={BarChart3} label="Average score" value={data.average ? String(data.average) : '—'} />
            <StatCard icon={Sparkles} label="Best score" value={data.best ? String(data.best) : '—'} />
          </div>

          {/* trend + categories */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Score trend</h2>
                <span className="font-mono text-[11px] text-muted-foreground">
                  Last {data.trend.length} completed
                </span>
              </div>
              <div className="mt-4">
                <Sparkline values={data.trend} height={80} />
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold">Category performance</h2>
              <div className="mt-4 flex flex-col gap-4">
                {data.categories.map((c) => (
                  <div key={c.label}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span>{c.label}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {c.value}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${c.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* recent interviews */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-3">
              <h2 className="text-sm font-semibold">Recent interviews</h2>
              <Link
                to="/interviews"
                className="font-mono text-[11px] text-primary hover:underline"
              >
                View all →
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {data.recent.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.roleTitle}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {i.company} · {fmtDate(i.createdAt)}
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 md:flex">
                    <TypeBadge type={i.type} />
                    <DifficultyBadge difficulty={i.difficulty} />
                  </div>
                  <StatusBadge status={i.status} />
                  <span className="w-14 text-right font-mono text-sm tabular-nums">
                    {i.score !== null ? (
                      <>
                        {i.score}
                        <span className="text-muted-foreground">/100</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <RowAction interview={i} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/25">
          <Icon className="size-4 text-primary" />
        </span>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ResumeBanner({ interview }: { interview: Interview }) {
  const pct = Math.round(interview.progress * 100)
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
        <RotateCcw className="size-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          Interview in progress — {interview.roleTitle}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {pct}%
          </span>
        </div>
      </div>
      <Link
        to={`/interviews/${interview.id}/lobby`}
        className={cn(buttonVariants({ size: 'sm' }))}
      >
        <Play className="size-3.5" />
        Resume
      </Link>
    </div>
  )
}

function EmptyDashboard() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/25">
        <Sparkles className="size-6 text-primary" />
      </span>
      <h2 className="mt-5 text-lg font-semibold tracking-tight">
        You haven't completed an interview yet.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Configure your first adaptive interview — the AI interviewer evaluates
        every answer and shapes the session around how you perform.
      </p>
      <div className="mt-6 flex justify-center">
        <Link
          to="/interviews/new"
          className={cn(buttonVariants({ size: 'lg' }), 'h-11 px-5')}
        >
          <Plus className="size-4" />
          Start your first interview
        </Link>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6" aria-busy="true">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-44 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}