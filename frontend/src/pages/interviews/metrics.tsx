import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Activity, ListChecks, Timer } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Alert } from '@/components/ui/alert'
import { Bars } from '@/components/charts'
import { api } from '@/lib/api'
import {
  DetailSkeleton,
  interviewDisplayTitle,
  InterviewHeader,
  InterviewNotFound,
  useInterview,
} from './shared'

interface Metrics {
  interviewId: string
  overall: number
  questionScores: { label: string; value: number }[]
  topics: { label: string; value: number }[]
  timePerQuestion: number[]
  activeSeconds: number
}

export function InterviewMetricsPage() {
  const { id } = useParams()
  const { interview, loading, error: interviewError } = useInterview(id)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    api
      .getMetrics(id)
      .then((m) => {
        if (alive) setMetrics(m as Metrics)
      })
      .catch(() => {
        if (alive) {
          setFailed(true)
          setError('Unable to load interview metrics.')
        }
      })
    return () => {
      alive = false
    }
  }, [id])

  if (loading || (!metrics && !failed)) {
    return (
      <AppShell title="Interview Metrics">
        <DetailSkeleton />
      </AppShell>
    )
  }
  if (interviewError || error) {
    return <AppShell title="Interview Metrics"><Alert variant="destructive">{interviewError ?? error}</Alert></AppShell>
  }
  if (!interview || !metrics) {
    return (
      <AppShell title="Interview Metrics">
        <InterviewNotFound />
      </AppShell>
    )
  }

  const timeData = metrics.timePerQuestion.map((v, i) => ({
    label: `Q${i + 1}`,
    value: v,
  }))

  return (
    <AppShell title="Interview Metrics">
      <div className="interview-print-root animate-slide-up mx-auto flex max-w-5xl flex-col gap-5">
        <InterviewHeader interview={interview} active="metrics" />
        <div className="print-document-title">
          <h1>{interviewDisplayTitle(interview)} — Metrics</h1>
          <p>{interview.company ?? 'No target company'} · {interview.domain}</p>
        </div>

        {/* stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={Activity} label="Overall score" value={String(metrics.overall)} />
          <StatCard icon={Timer} label="Session time" value={formatDuration(metrics.activeSeconds)} />
          <StatCard icon={ListChecks} label="Questions" value={String(metrics.questionScores.length)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Question-level scores" note="per-question evaluation">
            {metrics.questionScores.length ? <Bars data={metrics.questionScores} height={150} color="var(--chart-1)" /> : <EmptyChart label="No evaluated answers yet" />}
          </ChartCard>
          <ChartCard title="Interview mix" note="average score by question type">
            {metrics.topics.length ? <Bars data={metrics.topics} height={150} color="var(--chart-2)" /> : <EmptyChart label="No topic scores yet" />}
          </ChartCard>
          <ChartCard title="Time per question" note="seconds spent">
            {timeData.length ? <Bars data={timeData} height={150} color="var(--chart-3)" /> : <EmptyChart label="Timing data is not available" />}
          </ChartCard>

          <section className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-6">
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              Code execution is not available yet, so no coding metrics are displayed.
            </p>
          </section>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Session time is measured from start until the interview was ended.
        </p>
      </div>
    </AppShell>
  )
}

function EmptyChart({ label }: { label: string }) { return <div className="flex h-[150px] items-center justify-center rounded-xl bg-secondary/40 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div> }
function formatDuration(seconds: number) { const minutes = Math.floor(seconds / 60); const remainder = seconds % 60; return minutes ? `${minutes}m ${remainder}s` : `${remainder}s` }

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity
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

function ChartCard({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {note}
        </span>
      </div>
      {children}
    </section>
  )
}
