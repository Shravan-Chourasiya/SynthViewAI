import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Minus,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { Meter } from '@/components/ui/meter'
import { Skeleton, SkeletonStatGrid } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { CategoryBarChart, ScoreTrendChart } from '@/components/charts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { analyticsService } from '@/lib/services'
import { cn } from '@/lib/utils'

export default function AnalyticsPage() {
  const [range, setRange] = useState('10')
  const [format, setFormat] = useState('all')

  const query = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => analyticsService.summary(),
  })

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <SkeletonStatGrid />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Analytics are unavailable"
        description="We could not load your aggregate statistics. Try again in a moment."
      />
    )
  }

  const data = query.data
  const points = data.scoreOverTime.slice(-Number(range))

  return (
    <div className="space-y-6">
      <PageHeader
        title="How you are actually trending."
        lede="Aggregated across every completed session, with the cohort benchmark for comparison."
        actions={
          <>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="w-36" aria-label="Filter by format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All formats</SelectItem>
                <SelectItem value="behavioral">Behavioral</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-36" aria-label="Time range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Last 5 sessions</SelectItem>
                <SelectItem value="10">Last 10 sessions</SelectItem>
                <SelectItem value="20">Last 20 sessions</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.kpis.map((kpi, index) => (
          <div
            key={kpi.label}
            className="animate-rise-in rounded-2xl border border-border bg-card p-5"
            style={{ '--stagger-i': index } as React.CSSProperties}
          >
            <div className="flex items-start justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-mono text-[10px]',
                  kpi.trend === 'up' && 'text-signal-strong',
                  kpi.trend === 'down' && 'text-signal-weak',
                  kpi.trend === 'flat' && 'text-muted-foreground',
                )}
              >
                {kpi.trend === 'up' ? (
                  <ArrowUpRight className="size-3" />
                ) : kpi.trend === 'down' ? (
                  <ArrowDownRight className="size-3" />
                ) : (
                  <Minus className="size-3" />
                )}
                {kpi.delta}
              </span>
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{kpi.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
          </div>
        ))}
      </div>

      <Panel flush>
        <PanelHeader
          title="Score over time"
          description="Solid line is you, dashed is the cohort"
          aside={
            <span className="font-mono text-[11px] text-muted-foreground">
              {points.length} sessions
            </span>
          }
        />
        <div className="p-5">
          <ScoreTrendChart data={points} height={280} />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel flush>
          <PanelHeader title="Performance by category" />
          <div className="p-5">
            <CategoryBarChart data={data.byCategory} height={260} />
          </div>
        </Panel>

        <Panel flush>
          <PanelHeader title="Performance by difficulty" />
          <div className="space-y-4 p-5">
            {data.byDifficulty.map((row) => (
              <div key={row.difficulty} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{row.difficulty}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {row.score}/100 · {row.attempts} attempts
                  </span>
                </div>
                <Meter
                  value={row.score}
                  tone={
                    row.score >= 82 ? 'strong' : row.score >= 70 ? 'good' : row.score >= 58 ? 'vague' : 'weak'
                  }
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel flush>
          <PanelHeader title="Skill breakdown" description="Change versus the previous period" />
          <ul className="divide-y divide-border">
            {data.skills.map((skill, index) => (
              <li
                key={skill.skill}
                className="animate-rise-in flex items-center gap-4 px-5 py-4"
                style={{ '--stagger-i': index } as React.CSSProperties}
              >
                <span className="min-w-0 flex-1 text-sm">{skill.skill}</span>
                <div className="hidden w-40 sm:block">
                  <Meter value={skill.score} className="h-1.5" />
                </div>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{skill.score}</span>
                <span
                  className={cn(
                    'w-12 text-right font-mono text-[11px] tabular-nums',
                    skill.delta > 0 ? 'text-signal-strong' : skill.delta < 0 ? 'text-signal-weak' : 'text-muted-foreground',
                  )}
                >
                  {skill.delta > 0 ? '+' : ''}
                  {skill.delta}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-4">
          <Panel className="space-y-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
              <TrendingUp className="size-4 text-signal-strong" />
              Strengths
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.strengths.map((item) => (
                <Badge key={item} variant="strong">
                  {item}
                </Badge>
              ))}
            </div>
          </Panel>

          <Panel className="space-y-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Target className="size-4 text-signal-vague" />
              Gaps to close
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.gaps.map((item) => (
                <Badge key={item} variant="vague">
                  {item}
                </Badge>
              ))}
            </div>
          </Panel>

          <Panel className="space-y-3 border-primary/30 bg-primary/5">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Sparkles className="size-4 text-primary" />
              Suggested next session
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your depth score has held flat for three sessions. Run a Hard technical round focused on queues
              and backpressure.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
