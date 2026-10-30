import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, History } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge, SignalBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { ScoreChip, bandOf } from '@/components/stat-card'
import { DifficultyLineChart } from '@/components/charts'
import { interviewService } from '@/lib/services'
import { DIFFICULTY_LABEL, formatClock } from '@/lib/format'

export default function TimelinePage() {
  const { id = '' } = useParams()

  const interviewQuery = useQuery({
    queryKey: ['interview', id],
    queryFn: () => interviewService.get(id),
  })

  const questionsQuery = useQuery({
    queryKey: ['interview', id, 'questions'],
    queryFn: () => interviewService.questions(id),
  })

  const questions = (questionsQuery.data ?? []).filter((q) => q.score !== null)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={interviewQuery.data?.code}
        title="Question timeline"
        lede="Every answered question in order, with the signal it produced and how difficulty moved afterwards."
        actions={
          <Link to={`/interviews/${id}/report`} className={buttonVariants({ variant: 'outline' })}>
            Open report
          </Link>
        }
      />

      {questionsQuery.isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : questions.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nothing has been answered yet"
          description="Once you submit an answer, it appears here with its evaluation and adaptive decision."
          action={
            <Link to={`/interviews/${id}/lobby`} className={buttonVariants({})}>
              Enter the room
            </Link>
          }
        />
      ) : (
        <>
          <Panel flush>
            <PanelHeader
              title="Score by question"
              description="Difficulty moves with your answers"
              aside={
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {questions.length} answered
                </span>
              }
            />
            <div className="p-5">
              <DifficultyLineChart
                data={questions.map((q) => ({ label: `Q${q.index}`, score: q.score ?? 0 }))}
              />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
              {questions.map((question) => {
                const band = bandOf(question.score)
                return (
                  <span key={question.id} className="inline-flex items-center gap-2">
                    <ScoreChip score={question.score} size="sm" showMax={false} />
                    <SignalBadge band={band} className="hidden sm:inline-flex">
                      Q{question.index}
                    </SignalBadge>
                  </span>
                )
              })}
            </div>
          </Panel>

          <ol className="space-y-4">
            {questions.map((question, index) => (
              <li
                key={question.id}
                className="animate-rise-in"
                style={{ '--stagger-i': index } as React.CSSProperties}
              >
                <Panel className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">Q{question.index}</span>
                    <Badge variant="neutral">{question.topic}</Badge>
                    <Badge variant="outline">{DIFFICULTY_LABEL[question.difficulty]}</Badge>
                    <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Clock className="size-3" />
                      {formatClock(question.durationSeconds)}
                    </span>
                    <ScoreChip score={question.score} />
                  </div>

                  <p className="text-base leading-snug font-medium tracking-tight">{question.prompt}</p>

                  {question.answer ? (
                    <div className="rounded-xl border border-border bg-secondary/30 p-4">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Your answer
                      </p>
                      <p className="mt-2 text-sm leading-relaxed">{question.answer}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    {question.headline ? (
                      <SignalBadge band={bandOf(question.score)}>{question.headline}</SignalBadge>
                    ) : null}
                    {question.decision ? (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                        → {question.decision}
                      </span>
                    ) : null}
                  </div>

                  {question.feedback ? (
                    <p className="border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
                      {question.feedback}
                    </p>
                  ) : null}
                </Panel>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
