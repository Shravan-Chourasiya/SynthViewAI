import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { ErrorState } from '@/components/error-state'
import { ScoreRing } from '@/components/charts'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Meter, Panel, PanelHeader } from '@/components/ui/panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminGate, AdminHeader } from './shared'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useAdminStore } from '@/lib/stores/admin.store'
import { canViewPerformanceInsights } from '@/lib/roles'
import { fmtDate, fmtMinutes } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AdminInterviewMetrics } from '@/lib/services/admin.service'

/**
 * Admin interview report — scores and structure, and nothing else.
 *
 * What this page is allowed to know is enforced in three places, and this is the
 * third of them:
 *
 *   1. `GET /admin/interviews/:id/metrics` projects named columns, so answers and
 *      transcripts never leave the database (`interview-metrics.service.ts`).
 *   2. That service shapes the payload field by field and refuses to return it if
 *      the access cannot be written to the audit trail.
 *   3. Here: this module imports **only primitives** — badges, meters, tables,
 *      a score ring. It does not mount `pages/interviews/report`, the evaluation
 *      charts, or any interview-room component, so there is no code path on this
 *      page that could render a candidate's words even if a payload one day
 *      carried them. The import list is the guard, so keep it short.
 *
 * There is deliberately no export or download affordance. A scores-only CSV is a
 * feature to be scoped on its own, not a button in this view.
 */

// ── Presentation helpers ─────────────────────────────────────────────────────

type Outcomes = AdminInterviewMetrics['session']['outcome']

const OUTCOME_META: Record<Outcomes, { label: string; variant: 'strong' | 'good' | 'vague' | 'weak' | 'neutral'; hint: string }> = {
  completed: { label: 'Completed', variant: 'good', hint: 'Reached the end of the session.' },
  ended_early: { label: 'Ended early', variant: 'weak', hint: 'Cancelled or abandoned before the end.' },
  time_expired: { label: 'Time expired', variant: 'weak', hint: 'Ran out of time or went overdue.' },
  in_progress: { label: 'In progress', variant: 'vague', hint: 'Still running — scores may still be written.' },
  not_started: { label: 'Not started', variant: 'neutral', hint: 'No candidate activity recorded.' },
}

const DIFFICULTY_VARIANT: Record<string, 'good' | 'vague' | 'weak'> = {
  EASY: 'good',
  MEDIUM: 'vague',
  HARD: 'weak',
}

const QUESTION_STATE_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  ANSWERED: 'Answered',
  SKIPPED: 'Skipped',
  TIMED_OUT: 'Timed out',
  EVALUATED: 'Evaluated',
}

/** Scores are shown as recorded — this view does not invent a scale. */
function fmtScore(value: number | null): string {
  return value === null ? '—' : String(value)
}

function fmtSeconds(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`
}

function fmtInstant(value: string | null): string {
  if (!value) return '—'
  return `${fmtDate(value)} · ${new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

// ── Small building blocks ────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm">{value}</dd>
    </div>
  )
}

function ScoreMeter({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-mono text-sm tabular-nums">{fmtScore(value)}</span>
      </div>
      <Meter value={value} />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminInterviewReportPage() {
  const { id = '' } = useParams<{ id: string }>()
  const role = useAuthStore((s) => s.user?.userrole)
  const { interviewMetrics, metricsLoading, metricsError, loadInterviewMetrics } = useAdminStore()

  const allowed = canViewPerformanceInsights(role)

  // The role check lives inside the effect as well as below it: a moderator must
  // not fire a request the API is only going to refuse, and the audit trail
  // should record real intent, not a denial.
  useEffect(() => {
    if (id && allowed) loadInterviewMetrics(id)
  }, [id, allowed])

  // The route gate already renders nothing for a moderator, and the API would
  // refuse them too; this is the third layer, so the page cannot be dropped into
  // a wider layout by mistake.
  if (!allowed) {
    return (
      <AppShell title="Admin - Interview Report">
        <div className="mx-auto max-w-3xl p-4 md:p-6">
          <ErrorState
            code="403"
            title="Scores are restricted to administrators"
            body="Your account can reach the admin area, but not candidate performance data. Ask an administrator if you need this view."
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Admin - Interview Report">
      <AdminGate>
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          <AdminHeader
            title="Interview Report"
            description="Scores, timing and structure for one session. Answers, transcripts, recordings and candidate identity are never loaded by this view."
          />

          <div className="mb-6">
            <Link
              to="/admin/interviews"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to interviews
            </Link>
          </div>

          {metricsLoading && <ReportSkeleton />}

          {!metricsLoading && metricsError && (
            <ErrorState
              code="Unavailable"
              title="This report could not be loaded"
              body={metricsError}
            />
          )}

          {!metricsLoading && !metricsError && !interviewMetrics && (
            <ErrorState
              code="404"
              title="Session not found"
              body="No interview exists with that reference — it may have been deleted."
            />
          )}

          {!metricsLoading && !metricsError && interviewMetrics && (
            <Report metrics={interviewMetrics} />
          )}
        </div>
      </AdminGate>
    </AppShell>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  )
}

function Report({ metrics }: { metrics: AdminInterviewMetrics }) {
  const { session, aggregate, categoryBreakdown, difficultyProgression, questions } = metrics
  const outcome = OUTCOME_META[session.outcome]

  return (
    <div className="space-y-6">
      {/* ── Session ────────────────────────────────────────────────────────── */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={outcome.variant} dot>
                {outcome.label}
              </Badge>
              <Badge variant="neutral">{session.type}</Badge>
              <Badge variant={DIFFICULTY_VARIANT[session.difficulty] ?? 'neutral'}>
                {session.difficulty}
              </Badge>
              {session.adaptive && <Badge variant="outline">Adaptive</Badge>}
              {session.verdict && <Badge variant="default">Verdict: {session.verdict}</Badge>}
            </div>
            <h2 className="mt-3 truncate text-xl font-semibold tracking-tight">{session.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{outcome.hint}</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Candidate reference
            </div>
            <div className="mt-1 font-mono text-sm">{session.candidateRef}</div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Session
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">{session.ref}</div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-3 lg:grid-cols-4">
          <MetaRow label="Job role" value={session.jobRole ?? '—'} />
          <MetaRow label="Domain" value={session.domain ?? '—'} />
          <MetaRow label="Target company" value={session.targetedCompany ?? '—'} />
          <MetaRow label="Company style" value={session.companyStyle} />
          <MetaRow label="Experience" value={session.experienceLevel ?? '—'} />
          <MetaRow label="Duration" value={fmtMinutes(session.durationMinutes)} />
          <MetaRow label="Question target" value={session.questionTarget ?? '—'} />
          <MetaRow label="Ending criteria" value={session.endingCriteria ?? '—'} />
          <MetaRow label="Started" value={fmtInstant(session.startedAt)} />
          <MetaRow label="Created" value={fmtInstant(session.createdAt)} />
          <MetaRow label="Last activity" value={fmtInstant(session.updatedAt)} />
          <MetaRow label="Questions asked" value={questions.length} />
        </dl>

        {session.topics.length > 0 && (
          <div className="mt-5 border-t border-border pt-5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Topics covered
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {session.topics.map((topic) => (
                <Badge key={topic} variant="neutral">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* ── Aggregate scores ───────────────────────────────────────────────── */}
      <Panel>
        <PanelHeader
          title="Aggregate scores"
          aside={
            aggregate ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Recorded result
              </span>
            ) : null
          }
        />
        {aggregate ? (
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-8">
              <ScoreRing value={aggregate.overallScore ?? 0} size={132} stroke={11} />
              <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                <ScoreMeter label="Technical" value={aggregate.technicalScore} />
                <ScoreMeter label="Communication" value={aggregate.communicationScore} />
                <ScoreMeter label="Problem solving" value={aggregate.problemSolvingScore} />
                <ScoreMeter label="Confidence" value={aggregate.confidenceScore} />
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
              <MetaRow label="Answered" value={aggregate.questionsAnswered} />
              <MetaRow label="Skipped" value={aggregate.questionsSkipped} />
              <MetaRow label="Evaluated" value={aggregate.questionsEvaluated} />
              <MetaRow label="Total time" value={fmtSeconds(aggregate.totalDurationSeconds)} />
            </dl>
          </div>
        ) : (
          <p className="p-5 text-sm text-muted-foreground sm:p-6">
            This session has no recorded result yet — nothing was scored for it. Per-question metrics
            below are still shown.
          </p>
        )}
      </Panel>

      {/* ── Category breakdown + progression ──────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel flush>
          <PanelHeader title="Score by category" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Scored</TableHead>
                <TableHead>Average</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryBreakdown.map((row) => (
                <TableRow key={row.category}>
                  <TableCell>
                    <Badge variant="neutral">{row.category}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.questions}</TableCell>
                  <TableCell className="tabular-nums">{row.scored}</TableCell>
                  <TableCell className="font-mono tabular-nums">{fmtScore(row.averageScore)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel>
          <PanelHeader title="Difficulty progression" />
          <div className="flex flex-wrap gap-1.5">
            {difficultyProgression.length === 0 ? (
              <p className="text-sm text-muted-foreground">No questions were delivered.</p>
            ) : (
              difficultyProgression.map((step) => (
                <div key={step.sequenceNumber} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Q{step.sequenceNumber}
                  </span>
                  <Badge variant={step.difficulty ? (DIFFICULTY_VARIANT[step.difficulty] ?? 'neutral') : 'outline'}>
                    {step.difficulty ?? '—'}
                  </Badge>
                </div>
              ))
            )}
          </div>
          {difficultyProgression.some((step) => step.difficulty === null) && (
            <p className="mt-4 text-xs text-muted-foreground">
              A dash marks a question asked before per-question difficulty was recorded; the level in
              force for it is no longer recoverable.
            </p>
          )}
        </Panel>
      </div>

      {/* ── Per-question metrics ──────────────────────────────────────────── */}
      <Panel flush>
        <PanelHeader
          title={`Per-question metrics (${questions.length})`}
          aside={
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Prompts shown · answers not loaded
            </span>
          }
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Correctness</TableHead>
                <TableHead>Relevance</TableHead>
                <TableHead>Clarity</TableHead>
                <TableHead>Depth</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                    No questions were delivered in this session.
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((question) => (
                  <TableRow key={question.sequenceNumber}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {question.sequenceNumber}
                    </TableCell>
                    <TableCell className="max-w-md text-sm">{question.title}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{question.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          question.difficulty
                            ? (DIFFICULTY_VARIANT[question.difficulty] ?? 'neutral')
                            : 'outline'
                        }
                      >
                        {question.difficulty ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {QUESTION_STATE_LABEL[question.state] ?? question.state}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">{fmtScore(question.score)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{fmtScore(question.scores.correctness)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{fmtScore(question.scores.relevance)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{fmtScore(question.scores.clarity)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{fmtScore(question.scores.technicalDepth)}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {fmtSeconds(question.timeTakenSeconds)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {/* ── Privacy + accountability ──────────────────────────────────────── */}
      <Panel>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/25">
            <Lock className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">What this view does not load</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Submitted answers and transcripts, evaluation feedback, strengths and weaknesses,
              session notes and chat history, any recording, and the candidate&apos;s name, email and
              account id. The API backing this page selects its columns explicitly, so those fields
              never leave the database. The candidate appears only as the reference above — stable
              across their sessions, but not reversible.
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" />
              Every load of this report is recorded in the admin audit trail with your account, this
              session and the time.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  )
}

export default AdminInterviewReportPage
