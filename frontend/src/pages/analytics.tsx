import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  Target,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AppShell } from '@/components/app-shell'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnalyticsStore } from '@/lib/stores/analytics.store'
import { cn } from '@/lib/utils'

/* Chart styling is pulled from the theme tokens in index.css (--chart-1..5,
 * --border, --muted-foreground) so the charts follow the app's light/dark theme
 * instead of the hard-coded palette these used to ship with. */
const CHART = {
  overall: 'var(--chart-1)',
  technical: 'var(--chart-2)',
  communication: 'var(--chart-3)',
  category: 'var(--chart-1)',
} as const

const AXIS_TICK = { fontSize: 11, fill: 'var(--muted-foreground)' }
const TOOLTIP_STYLE = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--popover-foreground)',
  fontSize: 12,
}

/** Shared frame for every panel so spacing and radius stay consistent. */
function Panel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="rounded-2xl border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/** An empty chart reads as a broken chart, so say so explicitly. */
function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30 px-4 text-center">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: ReactNode
  hint: string
  icon: typeof BarChart3
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

export function AnalyticsPage() {
  const userAnalytics = useAnalyticsStore((s) => s.userAnalytics)
  const loading = useAnalyticsStore((s) => s.loading)
  const error = useAnalyticsStore((s) => s.error)
  const loadUserAnalytics = useAnalyticsStore((s) => s.loadUserAnalytics)

  useEffect(() => {
    void loadUserAnalytics()
  }, [loadUserAnalytics])

  const stats = userAnalytics?.overallStats
  const trendData = userAnalytics?.trendData ?? []
  const performanceByCategory = userAnalytics?.performanceByCategory ?? []
  const strengths = Object.entries(userAnalytics?.categoryBreakdown.strengths ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
  const weaknesses = Object.entries(userAnalytics?.categoryBreakdown.weaknesses ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const hasData = stats !== undefined && stats.totalInterviews > 0

  return (
    <AppShell title="Analytics">
      <div className="animate-slide-up mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary ring-1 ring-primary/25">
              <Activity className="size-3" />
              Insights
            </span>
            <h1 className="mt-2.5 text-2xl font-semibold tracking-tight sm:text-3xl">
              Performance analytics
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              How your sessions are trending, and which areas to work on next.
            </p>
          </div>
          <Link to="/interviews/new" className={cn(buttonVariants(), 'h-10 px-4')}>
            <Sparkles className="size-4" />
            Start new interview
          </Link>
        </header>

        {loading && !userAnalytics ? (
          <div className="flex flex-col gap-6" aria-busy="true">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-14 text-center">
            <h2 className="text-lg font-semibold tracking-tight text-destructive">
              Analytics unavailable
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-destructive/80">
              {error}
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => void loadUserAnalytics()}
                className="h-10 rounded-lg border border-destructive/40 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                Try again
              </button>
            </div>
          </div>
        ) : !hasData || !stats ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25">
              <Activity className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">No interview data yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Finish your first interview and your scores, trends and focus areas will show up here.
            </p>
            <div className="mt-6 flex justify-center">
              <Link to="/interviews/new" className={cn(buttonVariants(), 'h-10 px-4')}>
                Start new interview
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* headline numbers */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Interviews"
                value={stats.totalInterviews}
                hint="sessions on record"
                icon={BarChart3}
              />
              <StatCard
                label="Avg score"
                value={`${stats.avgOverallScore ?? 0}%`}
                hint="overall performance"
                icon={Target}
              />
              <StatCard
                label="Completion"
                value={`${stats.completionRate}%`}
                hint="questions answered"
                icon={CheckCircle2}
              />
              <StatCard
                label="Answers"
                value={stats.totalQuestionsAnswered}
                hint={`${stats.totalQuestionsSkipped} skipped`}
                icon={MessageSquare}
              />
            </div>

            {/* score components */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ScoreBar label="Technical" value={stats.avgTechnicalScore} />
              <ScoreBar label="Communication" value={stats.avgCommunicationScore} />
              <ScoreBar label="Problem solving" value={stats.avgProblemSolvingScore} />
            </div>

            {/* charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel
                title="Score trend"
                description="Overall, technical and communication scores over time"
              >
                <div className="h-80">
                  {trendData.length === 0 ? (
                    <ChartEmpty label="No trend data yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 5, right: 12, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--border)' }}
                        />
                        <YAxis domain={[0, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line
                          type="monotone"
                          dataKey="overallScore"
                          name="Overall"
                          stroke={CHART.overall}
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="technicalScore"
                          name="Technical"
                          stroke={CHART.technical}
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="communicationScore"
                          name="Communication"
                          stroke={CHART.communication}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Panel>

              <Panel
                title="Performance by category"
                description="Average score for every topic that came up"
              >
                <div className="h-80">
                  {performanceByCategory.length === 0 ? (
                    <ChartEmpty label="No category data yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={performanceByCategory}
                        margin={{ top: 5, right: 12, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="category"
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--border)' }}
                        />
                        <YAxis domain={[0, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar
                          dataKey="avgScore"
                          name="Average score"
                          fill={CHART.category}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Panel>
            </div>

            {/* strengths & weaknesses */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Panel title="Top strengths" description="Where you consistently perform well">
                <TagList items={strengths} variant="strong" empty="No strengths captured yet" />
              </Panel>
              <Panel title="Focus areas" description="Themes worth another pass">
                <TagList items={weaknesses} variant="weak" empty="No focus areas captured yet" />
              </Panel>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{value === null ? '—' : `${value}%`}</p>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function TagList({
  items,
  variant,
  empty,
}: {
  items: [string, number][]
  variant: 'strong' | 'weak'
  empty: string
}) {
  if (items.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{empty}</p>
    )
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map(([tag, count]) => (
        <li key={tag}>
          <Badge variant={variant}>
            {tag}
            <span className="text-muted-foreground">· {count}</span>
          </Badge>
        </li>
      ))}
    </ul>
  )
}

export default AnalyticsPage