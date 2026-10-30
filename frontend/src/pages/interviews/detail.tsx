import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BarChart3,
  FileText,
  History,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/empty-state'
import { ScoreChip } from '@/components/stat-card'
import { interviewService } from '@/lib/services'
import { DIFFICULTY_LABEL, EXPERIENCE_LABEL, TYPE_LABEL, formatDate, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function InterviewDetailPage() {
  const { id = '' } = useParams()

  const interviewQuery = useQuery({
    queryKey: ['interview', id],
    queryFn: () => interviewService.get(id),
  })

  const questionsQuery = useQuery({
    queryKey: ['interview', id, 'questions'],
    queryFn: () => interviewService.questions(id),
    enabled: Boolean(interviewQuery.data),
  })

  if (interviewQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/2" />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (interviewQuery.isError || !interviewQuery.data) {
    return (
      <ErrorState
        code="404"
        title="Interview not found"
        body="This session may have been deleted, or the link belongs to another account."
        actions={
          <Link to="/interviews" className={buttonVariants({ variant: 'outline' })}>
            Back to interviews
          </Link>
        }
      />
    )
  }

  const interview = interviewQuery.data
  const questions = questionsQuery.data ?? []
  const done = interview.status === 'completed'

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={interview.code}
        title={interview.roleTitle}
        lede={interview.summary ?? 'No summary yet — the report is written once the session is evaluated.'}
        actions={
          <>
            <StatusBadge status={interview.status} />
            {done ? (
              <Link to={`/interviews/${id}/report`} className={cn(buttonVariants({}), 'h-10')}>
                <FileText className="size-4" />
                Open report
              </Link>
            ) : (
              <Link to={`/interviews/${id}/lobby`} className={cn(buttonVariants({}), 'h-10')}>
                <Play className="size-4" />
                {interview.status === 'in-progress' ? 'Resume' : 'Enter lobby'}
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel flush>
          <PanelHeader title="Configuration" />
          <dl className="grid grid-cols-2 gap-px bg-border">
            {[
              { label: 'Field', value: interview.field },
              { label: 'Company', value: interview.company ?? 'Not specified' },
              { label: 'Format', value: TYPE_LABEL[interview.type] },
              { label: 'Difficulty', value: DIFFICULTY_LABEL[interview.difficulty] },
              { label: 'Experience', value: EXPERIENCE_LABEL[interview.experienceLevel] },
              { label: 'Duration', value: `${interview.durationMinutes}m` },
              { label: 'Rounds', value: `${interview.rounds}` },
              { label: 'Created', value: formatDate(interview.createdAt) },
            ].map((row) => (
              <div key={row.label} className="bg-card px-5 py-4">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="mt-1 text-sm">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2 border-t border-border p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Topics</p>
            <div className="flex flex-wrap gap-1.5">
              {interview.topics.map((topic) => (
                <Badge key={topic} variant="default">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2 border-t border-border p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Progress</p>
              <span className="font-mono text-[11px] tabular-nums">
                {interview.answeredCount}/{interview.questionCount}
              </span>
            </div>
            <Meter value={interview.progress * 100} label="Interview progress" />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Score</p>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="font-mono text-4xl font-semibold tabular-nums">
                {interview.score ?? '—'}
              </span>
              {interview.score !== null ? (
                <span className="font-mono text-sm text-muted-foreground">/100</span>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Updated {formatRelative(interview.updatedAt)}
            </p>
          </Panel>

          <Panel className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Jump to</p>
            {[
              { to: `/interviews/${id}/history`, label: 'Question timeline', icon: History },
              { to: `/interviews/${id}/metrics`, label: 'Metrics', icon: BarChart3 },
              { to: `/interviews/${id}/report`, label: 'Report', icon: FileText },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-3 rounded-xl border border-border px-4 py-2.5 text-sm transition-colors outline-none hover:border-primary/40 hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <link.icon className="size-4 text-primary" />
                <span className="flex-1">{link.label}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </Link>
            ))}
          </Panel>
        </div>
      </div>

      <Panel flush>
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" />
              Questions
            </span>
          }
          aside={
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {questions.length} total
            </span>
          }
        />
        {questionsQuery.isLoading ? (
          <SkeletonRows rows={4} />
        ) : (
          <ul className="divide-y divide-border">
            {questions.map((question, index) => (
              <li
                key={question.id}
                className="animate-rise-in flex flex-wrap items-center gap-3 px-5 py-4"
                style={{ '--stagger-i': index } as React.CSSProperties}
              >
                <span className="font-mono text-[11px] text-muted-foreground">Q{question.index}</span>
                <p className="min-w-0 flex-1 truncate text-sm">
                  {question.prompt}
                </p>
                <Badge variant="neutral">{question.topic}</Badge>
                <Badge variant="outline">{DIFFICULTY_LABEL[question.difficulty]}</Badge>
                <ScoreChip score={question.score} />
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border bg-secondary/30 px-5 py-3">
          <Link
            to="/interviews/new"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-3" />
            Run another session
          </Link>
        </div>
      </Panel>
    </div>
  )
}
