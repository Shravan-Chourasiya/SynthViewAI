import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, BarChart3, Gauge, Target } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Meter } from '@/components/ui/meter'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { StatCard } from '@/components/stat-card'
import { CategoryBarChart, SkillRadarChart } from '@/components/charts'
import { interviewService } from '@/lib/services'
import { DIFFICULTY_LABEL } from '@/lib/format'

export default function MetricsPage() {
  const { id = '' } = useParams()

  const interviewQuery = useQuery({
    queryKey: ['interview', id],
    queryFn: () => interviewService.get(id),
  })

  const reportQuery = useQuery({
    queryKey: ['interview', id, 'report'],
    queryFn: () => interviewService.report(id),
  })

  if (reportQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  const report = reportQuery.data
  const interview = interviewQuery.data
  const scores = (report?.questions ?? []).map((q) => q.score ?? 0)
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const spread = scores.length ? Math.max(...scores) - Math.min(...scores) : 0
  const consistency = Math.max(0, 100 - spread)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={interview?.code}
        title="Metrics"
        lede="How this session was scored, and where the variance came from."
        actions={
          <Link to={`/interviews/${id}/report`} className={buttonVariants({ variant: 'outline' })}>
            Open report
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Target} label="Overall" value={report?.overallScore ?? 0} index={0} numeric suffix="/100" />
        <StatCard icon={BarChart3} label="Answered average" value={average} index={1} numeric suffix="/100" />
        <StatCard icon={Gauge} label="Consistency" value={consistency} index={2} numeric suffix="%" hint="100 minus spread" />
        <StatCard
          icon={Activity}
          label="Peak difficulty"
          value={DIFFICULTY_LABEL[
            (report?.progression ?? []).reduce<'easy' | 'medium' | 'hard' | 'expert'>(
              (highest, point) => {
                const order = ['easy', 'medium', 'hard', 'expert']
                return order.indexOf(point.difficulty) > order.indexOf(highest) ? point.difficulty : highest
              },
              'easy',
            )
          ]}
          index={3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel flush>
          <PanelHeader title="Skill profile" description="Normalised across six dimensions" />
          <div className="p-5">
            <SkillRadarChart data={report?.skills ?? []} />
          </div>
        </Panel>

        <Panel flush>
          <PanelHeader title="Score by topic" />
          <div className="p-5">
            <CategoryBarChart
              data={(report?.topics ?? []).map((topic) => ({ category: topic.topic, score: topic.score }))}
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel flush>
          <PanelHeader title="Per-question scores" aside={<span className="font-mono text-[11px] text-muted-foreground">banded</span>} />
          <div className="space-y-4 p-5">
            {(report?.questions ?? []).map((question) => (
              <div key={question.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm">
                    <span className="mr-2 font-mono text-[10px] text-muted-foreground">Q{question.index}</span>
                    {question.topic}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {question.score}/100
                  </span>
                </div>
                <Meter
                  value={question.score ?? 0}
                  tone={
                    (question.score ?? 0) >= 82
                      ? 'strong'
                      : (question.score ?? 0) >= 70
                        ? 'good'
                        : (question.score ?? 0) >= 58
                          ? 'vague'
                          : 'weak'
                  }
                  className="h-1.5"
                />
              </div>
            ))}
          </div>
        </Panel>

        <Panel flush>
          <PanelHeader title="Difficulty progression" description="Where the session escalated" />
          <ul className="divide-y divide-border">
            {(report?.progression ?? []).map((point) => (
              <li key={point.index} className="flex items-center gap-4 px-5 py-3.5">
                <span className="font-mono text-[11px] text-muted-foreground">{point.label}</span>
                <span className="flex-1 text-sm">{DIFFICULTY_LABEL[point.difficulty]}</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{point.score}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
