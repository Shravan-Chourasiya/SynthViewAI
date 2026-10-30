import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, FileText, LayoutDashboard, Sparkles } from 'lucide-react'
import { Panel } from '@/components/ui/panel'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge, SignalBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScoreChip } from '@/components/stat-card'
import { ScoreOrb } from '@/components/score-orb'
import { interviewService } from '@/lib/services'
import { formatDate, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function CompletedPage() {
  const { id = '' } = useParams()

  const reportQuery = useQuery({
    queryKey: ['interview', id, 'report'],
    queryFn: () => interviewService.report(id),
  })

  if (reportQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    )
  }

  if (reportQuery.isError || !reportQuery.data) {
    return (
      <Panel className="mx-auto max-w-3xl text-center">
        <h2 className="text-base font-semibold tracking-tight">No report for this session yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Evaluations usually finish within a minute of the last answer.
        </p>
        <Link to="/dashboard" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
          Back to dashboard
        </Link>
      </Panel>
    )
  }

  const report = reportQuery.data
  const answered = report.questions.length
  const best = report.questions.reduce((max, q) => Math.max(max, q.score ?? 0), 0)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-12 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-60" />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-1/2 size-72 -translate-x-1/2 animate-glow-pulse rounded-full bg-primary/25 blur-3xl"
        />

        <div className="relative">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-signal-strong/10 ring-1 ring-signal-strong/25">
            <CheckCircle2 className="size-5 text-signal-strong" />
          </span>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Session complete
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{report.headline}</h1>

          <div className="mt-6 flex justify-center">
            <ScoreOrb score={report.overallScore} band={report.band} size={236} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <SignalBadge band={report.band} />
            <Badge variant="neutral">{answered} questions answered</Badge>
            <Badge variant="outline">generated {formatDate(report.generatedAt)}</Badge>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to={`/interviews/${id}/report`} className={cn(buttonVariants({ size: 'lg' }), 'h-11 px-5')}>
              <FileText className="size-4" />
              Read the full report
            </Link>
            <Link
              to="/dashboard"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 px-5')}
            >
              <LayoutDashboard className="size-4" />
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Questions', value: `${answered}`, hint: 'evaluated' },
          { label: 'Best answer', value: `${best}`, hint: 'highest single score' },
          { label: 'Est. practice', value: formatDuration(answered * 4), hint: 'time in the room' },
        ].map((stat, i) => (
          <Panel
            key={stat.label}
            className="animate-rise-in"
            style={{ '--stagger-i': i } as React.CSSProperties}
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            <p className="mt-2 font-mono text-2xl tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
          </Panel>
        ))}
      </div>

      <Panel flush>
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Sparkles className="size-3.5 text-primary" />
            Question breakdown
          </h2>
          <Link
            to={`/interviews/${id}/history`}
            className="rounded font-mono text-[10px] uppercase tracking-wider text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Full timeline
            <ArrowRight className="ml-1 inline size-3" />
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {report.questions.map((question, index) => (
            <li
              key={question.id}
              className="animate-rise-in flex items-center gap-4 px-5 py-4"
              style={{ '--stagger-i': index } as React.CSSProperties}
            >
              <span className="font-mono text-[11px] text-muted-foreground">Q{question.index}</span>
              <p className="min-w-0 flex-1 truncate text-sm">{question.headline ?? question.topic}</p>
              <Badge variant="neutral">{question.topic}</Badge>
              <ScoreChip score={question.score} />
            </li>
          ))}
        </ul>
      </Panel>

      <div className="flex justify-center pb-4">
        <Button asChild variant="ghost">
          <Link to="/interviews/new">
            Run another session
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
