import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Gauge, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge, SignalBadge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/empty-state'
import { ScoreChip } from '@/components/stat-card'
import { CategoryBarChart, DifficultyLineChart } from '@/components/charts'
import { interviewService } from '@/lib/services'
import { DIFFICULTY_LABEL, TYPE_LABEL, formatDate } from '@/lib/format'

export default function AdminInterviewReportPage() {
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
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (reportQuery.isError || !reportQuery.data) {
    return (
      <ErrorState
        code="404"
        title="No report for this session"
        body="The session has not finished evaluating, or it was abandoned before any answer was scored."
        actions={
          <Link to="/admin/interviews" className={buttonVariants({ variant: 'outline' })}>
            Back to all interviews
          </Link>
        }
      />
    )
  }

  const report = reportQuery.data
  const interview = interviewQuery.data

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin · scores only"
        title={interview?.roleTitle ?? 'Interview report'}
        lede="Scores and derived metrics only. Candidate answers and free-text feedback are withheld from admin view."
        actions={
          <Link to="/admin/interviews" className={buttonVariants({ variant: 'ghost' })}>
            <ArrowLeft className="size-4" />
            All interviews
          </Link>
        }
      />

      <Panel className="flex flex-wrap items-center gap-3 border-signal-vague/30 bg-signal-vague/5">
        <ShieldAlert className="size-4 shrink-0 text-signal-vague" />
        <p className="text-sm leading-relaxed">
          This view exists for quality assurance and evaluation calibration. It deliberately excludes answer text
          and per-question narrative feedback.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Panel className="space-y-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Overall</p>
          <p className="font-mono text-5xl font-semibold tabular-nums">{report.overallScore}</p>
          <SignalBadge band={report.band} />
          {interview ? (
            <p className="font-mono text-[10px] text-muted-foreground">
              {interview.code} · {TYPE_LABEL[interview.type]} · {DIFFICULTY_LABEL[interview.difficulty]}
            </p>
          ) : null}
        </Panel>

        <Panel flush>
          <PanelHeader
            title="Per-question scores"
            aside={
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <Gauge className="size-3.5" />
                {report.questions.length} questions
              </span>
            }
          />
          <ul className="divide-y divide-border">
            {report.questions.map((question) => (
              <li key={question.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="font-mono text-[11px] text-muted-foreground">Q{question.index}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{question.topic}</span>
                <Badge variant="outline">{DIFFICULTY_LABEL[question.difficulty]}</Badge>
                <div className="hidden w-32 sm:block">
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
                <ScoreChip score={question.score} />
              </li>
            ))}
          </ul>
          <div className="border-t border-border bg-secondary/30 px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              generated {formatDate(report.generatedAt)}
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel flush>
          <PanelHeader title="Difficulty progression" />
          <div className="p-5">
            <DifficultyLineChart
              data={report.progression.map((point) => ({ label: point.label, score: point.score }))}
              height={240}
            />
          </div>
        </Panel>

        <Panel flush>
          <PanelHeader title="Score by topic" />
          <div className="p-5">
            <CategoryBarChart
              data={report.topics.map((topic) => ({ category: topic.topic, score: topic.score }))}
              height={240}
            />
          </div>
        </Panel>
      </div>

      <Panel flush>
        <PanelHeader title="Skill scores" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {report.skills.map((skill) => (
            <div key={skill.skill} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">{skill.skill}</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{skill.score}</span>
              </div>
              <Meter value={skill.score} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
