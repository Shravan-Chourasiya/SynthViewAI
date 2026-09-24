import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Brain,
  Check,
  History,
  Link2,
  Loader2,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Alert } from '@/components/ui/alert'
import { ScoreRing } from '@/components/charts'
import { Sparkline } from '@/components/charts'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { DifficultyBadge, TypeBadge } from '@/components/interview-ui'
import { api } from '@/lib/api'
import { fmtDate, fmtMinutes } from '@/lib/format'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { revokeInterviewShare, shareInterviewReport } from '@/lib/services/interview.service'
import type { InterviewReport, SignalTone, TimelineEvent } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  DetailSkeleton,
  interviewDisplayTitle,
  InterviewHeader,
  InterviewNotFound,
  useInterview,
} from './shared'

const SIGNAL_BADGE: Record<SignalTone, 'strong' | 'good' | 'vague' | 'weak'> = {
  strong: 'strong',
  good: 'good',
  vague: 'vague',
  weak: 'weak',
}

const fmtEventTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export function InterviewReportPage() {
  const { id } = useParams()
  const { interview, loading, error: interviewError } = useInterview(id)
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<TimelineEvent[] | null>(null)
  // One ref per question accordion, so a score chip can open + scroll to it.
  const questionRefs = useRef<Array<HTMLDetailsElement | null>>([])
  // Share-link dialog state (doc 07 Task C). `token` is kept so Revoke can
  // target the exact link that was created in this session.
  const [shareOpen, setShareOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    let alive = true
    api
      .getReport(id)
      .then((r) => {
        if (alive) setReport(r)
      })
      .catch(() => {
        if (alive) setError('Unable to load interview report.')
      })
    return () => {
      alive = false
    }
  }, [id])

  // History is fetched only when the section is first expanded — the on-screen
  // report doesn't need it until the user asks for it.
  useEffect(() => {
    if (!historyOpen || history !== null || !id) return
    let alive = true
    api
      .getHistory(id)
      .then((events) => {
        if (alive) setHistory(events)
      })
      .catch(() => {
        if (alive) setHistory([])
      })
    return () => {
      alive = false
    }
  }, [historyOpen, history, id])

  function focusQuestion(index: number) {
    const element = questionRefs.current[index]
    if (!element) return
    element.open = true
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function createShareLink() {
    if (!id) return
    setShareBusy(true)
    try {
      const link = await shareInterviewReport(id)
      setShareUrl(link.shareUrl)
      setShareToken(link.token)
      setCopied(false)
      setShareOpen(true)
    } catch (err: unknown) {
      notifyApiError(err)
    } finally {
      setShareBusy(false)
    }
  }

  async function revokeShare() {
    if (!id || !shareToken) return
    setShareBusy(true)
    try {
      await revokeInterviewShare(id, shareToken)
      setShareOpen(false)
      setShareUrl(null)
      setShareToken(null)
      notifySuccess('Share link revoked. The link no longer works.')
    } catch (err: unknown) {
      notifyApiError(err)
    } finally {
      setShareBusy(false)
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      notifyApiError(new Error('Could not copy the link — copy it manually instead.'))
    }
  }

  if (loading || (!report && interview?.status === 'COMPLETED')) {
    return (
      <AppShell title="Interview Report">
        <DetailSkeleton />
      </AppShell>
    )
  }
  if (interviewError || error) {
    return (
      <AppShell title="Interview Report">
        <Alert variant="destructive">{interviewError ?? error}</Alert>
      </AppShell>
    )
  }
  if (!interview || !report) {
    return (
      <AppShell title="Interview Report">
        <InterviewNotFound />
      </AppShell>
    )
  }

  // Reports generated by older deployments may lack optional presentation
  // arrays. The aggregate score remains useful, so render empty sections
  // rather than letting a missing array crash the whole route.
  const categoryScores = report.categoryScores ?? []
  const difficultyProgression = report.difficultyProgression ?? []
  const strengths = (report.strengths ?? []).slice(0, 12)
  const weaknesses = (report.weaknesses ?? []).slice(0, 7)
  const recommendations = (report.recommendations ?? []).slice(0, 7)
  const questions = report.questions ?? []
  const summaryPoints = report.summary
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 4)

  return (
    <AppShell title="Interview Report">
      <div className="interview-print-root report-print-root animate-slide-up mx-auto flex max-w-5xl flex-col gap-5">
        <InterviewHeader
          interview={interview}
          active="report"
          actions={
            <Button variant="outline" onClick={() => void createShareLink()} disabled={shareBusy}>
              {shareBusy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Share
            </Button>
          }
        />

        <Dialog open={shareOpen} onClose={() => setShareOpen(false)} className="max-w-lg">
          <h2 className="text-lg font-semibold tracking-tight">Share this report</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Anyone with this link can view a read-only copy of the report for 7 days. Revoke it at
            any time to stop the link working.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2">
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
              {shareUrl ?? ''}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => void revokeShare()} disabled={shareBusy}>
              Revoke access
            </Button>
            <Button variant="outline" onClick={() => void copyShareLink()} disabled={shareBusy || copied}>
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
          </div>
        </Dialog>
        <div className="print-document-title">
          <h1>{interviewDisplayTitle(interview)} — Interview Report</h1>
          <p>
            {interview.company ?? 'No target company'} · {interview.domain} ·{' '}
            {fmtDate(interview.createdAt)}
          </p>
        </div>

        {/* hero */}
        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-6">
            <ScoreRing value={report.overallScore} size={124} stroke={10} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={interview.type} />
                <DifficultyBadge difficulty={interview.difficulty} />
                <Badge variant="strong" dot>
                  Completed
                </Badge>
              </div>
              <h2 className="mt-2.5 text-xl font-semibold tracking-tight sm:text-2xl">
                Interview Report
              </h2>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {interview.company} · {fmtDate(interview.createdAt)} ·{' '}
                {fmtMinutes(interview.durationMin)} · {interview.rounds} rounds
              </p>
              <ul className="mt-3 grid max-w-2xl gap-1.5 text-sm leading-relaxed text-muted-foreground">
                {summaryPoints.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* categories + adaptive journey */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Category performance</h2>
            <div className="mt-4 flex flex-col gap-4">
              {categoryScores.length ? (
                categoryScores.map((c) => (
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
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No category scores were recorded for this interview.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Adaptive journey</h2>
            </div>
            {interview.difficulty === 'Adaptive' && difficultyProgression.length ? (
              <>
                <Sparkline
                  values={difficultyProgression.map(difficultyValue)}
                  height={92}
                  className="mt-4"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {difficultyProgression.map((step, i) => (
                    <Fragment key={`${step}-${i}`}>
                      {i > 0 ? (
                        <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                      ) : null}
                      <span
                        className={cn(
                          'rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ring-1',
                          journeyChipCls(step),
                        )}
                      >
                        {step}
                      </span>
                    </Fragment>
                  ))}
                </div>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Difficulty by answered question
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                This interview used a fixed difficulty, so there is no adaptive journey to
                display.
              </p>
            )}
          </section>
        </div>

        {/* strengths / weaknesses */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-[var(--signal-strong)]">Strengths</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {strengths.length ? (
                strengths.map((s) => (
                  <li key={s} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className="mt-0.5 size-3.5 shrink-0 text-[var(--signal-strong)]"
                      strokeWidth={3}
                    />
                    {s}
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">
                  No strengths were recorded for this interview.
                </li>
              )}
            </ul>
          </section>
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-[var(--signal-vague)]">Areas to improve</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {weaknesses.length ? (
                weaknesses.map((w) => (
                  <li key={w} className="flex items-start gap-2.5 text-sm">
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-[var(--signal-vague)]" />
                    {w}
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">
                  No improvement areas were recorded for this interview.
                </li>
              )}
            </ul>
          </section>
        </div>

        {/* recommendations — rendered only when the report actually carries them.
            Nothing in the API produces this today, and a permanent "nothing was
            recorded" card reads as a broken section rather than an empty one. */}
        {recommendations.length ? (
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Recommended resources</h2>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                tied to observed gaps
              </span>
            </div>
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {recommendations.map((r) => (
                <li
                  key={r.gap}
                  className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="shrink-0 self-start rounded-md bg-[var(--signal-vague)]/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--signal-vague)] ring-1 ring-[var(--signal-vague)]/25 sm:self-auto">
                    {r.gap}
                  </span>
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {r.resource}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* activity history — same data the full export includes */}
        <details
          className="rounded-2xl border border-border bg-card"
          onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
        >
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              <span className="text-sm font-semibold">Activity history</span>
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {history === null ? 'expand to load' : `${history.length} events`}
            </span>
          </summary>
          <div className="border-t border-border p-5 pt-4">
            {history === null ? (
              <p className="text-sm text-muted-foreground">Loading history…</p>
            ) : history.length ? (
              <ol className="flex flex-col gap-3">
                {history.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {event.detail}
                      </p>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {fmtEventTime(event.at)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                No timeline events were recorded for this interview.
              </p>
            )}
          </div>
        </details>

        {/* question-level analysis */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Question-level analysis</h2>
          <span className="font-mono text-[11px] text-muted-foreground">
            {questions.length} questions
          </span>
        </div>

        {/* score-overview strip: see the per-question trend at a glance and jump
            straight to any question, using the same score bands as below. */}
        {questions.length ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {questions.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => focusQuestion(i)}
                  aria-label={`Jump to question ${i + 1}, scored ${q.evaluation.score} out of 100`}
                  title={`Q${i + 1} · ${q.evaluation.score}/100`}
                  className={cn(
                    'print-score-chip flex size-8 items-center justify-center rounded-full font-mono text-xs font-semibold tabular-nums ring-1 transition-transform hover:scale-110',
                    scoreClass(q.evaluation.score),
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <p className="print-hint mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Per-question score trend — click a chip to open that question
            </p>
          </section>
        ) : null}

        <div className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <details
              key={i}
              ref={(element) => {
                questionRefs.current[i] = element
              }}
              className="group rounded-2xl border border-border bg-card"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">Q{i + 1}</Badge>
                  <Badge variant="outline">{q.level}</Badge>
                  <Badge variant={SIGNAL_BADGE[q.evaluation.signal]} dot>
                    {q.evaluation.signal}
                  </Badge>
                </div>
                <h3 className="min-w-0 flex-1 text-sm font-semibold leading-relaxed sm:px-2">
                  {q.question}
                </h3>
                <span
                  className={cn(
                    'rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums ring-1',
                    scoreClass(q.evaluation.score),
                  )}
                >
                  {q.evaluation.score}
                  <span className="text-muted-foreground">/100</span>
                </span>
              </summary>

              <div className="border-t border-border p-5 pt-4">
                <h3 className="text-sm font-semibold leading-relaxed">{q.question}</h3>

                <div className="mt-3 rounded-lg border border-border bg-background/50 px-3.5 py-2.5">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Your answer
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{q.answer}</p>
                </div>

                <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-primary/5 px-3.5 py-2.5 ring-1 ring-primary/20">
                  <Brain className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-primary">
                      AI evaluation
                    </p>
                    <p className="mt-1 text-sm leading-relaxed">{q.evaluation.feedback}</p>
                  </div>
                </div>

                {q.evaluation.strengths.length > 0 || q.evaluation.weaknesses.length > 0 ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {q.evaluation.strengths.length > 0 ? (
                      <div className="rounded-lg border border-border bg-background/50 px-3.5 py-2.5">
                        <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--signal-strong)]">
                          Strengths
                        </p>
                        <ul className="mt-1.5 flex flex-col gap-1.5">
                          {q.evaluation.strengths.slice(0, 4).map((s) => (
                            <li
                              key={s}
                              className="flex items-start gap-1.5 text-xs leading-relaxed"
                            >
                              <Check
                                className="mt-0.5 size-3 shrink-0 text-[var(--signal-strong)]"
                                strokeWidth={3}
                              />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {q.evaluation.weaknesses.length > 0 ? (
                      <div className="rounded-lg border border-border bg-background/50 px-3.5 py-2.5">
                        <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--signal-vague)]">
                          Needs work
                        </p>
                        <ul className="mt-1.5 flex flex-col gap-1.5">
                          {q.evaluation.weaknesses.slice(0, 4).map((w) => (
                            <li
                              key={w}
                              className="flex items-start gap-1.5 text-xs leading-relaxed"
                            >
                              <ArrowUpRight className="mt-0.5 size-3 shrink-0 text-[var(--signal-vague)]" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {q.evaluation.improvedAnswer ? (
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-[var(--signal-strong)]/5 px-3.5 py-2.5 ring-1 ring-[var(--signal-strong)]/25">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[var(--signal-strong)]" />
                    <div className="min-w-0">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--signal-strong)]">
                        Improved answer
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">{q.evaluation.improvedAnswer}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>

        {/* footer actions */}
        <div className="report-footer flex flex-wrap justify-center gap-2 pt-2">
          <Link to="/interviews/new" className={cn(buttonVariants())}>
            Practice again
          </Link>
          <Link to="/dashboard" className={cn(buttonVariants({ variant: 'outline' }))}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  )
}

function scoreClass(score: number) {
  if (score >= 80)
    return 'bg-[var(--signal-strong)]/10 text-[var(--signal-strong)] ring-[var(--signal-strong)]/30'
  if (score >= 60) return 'bg-primary/10 text-primary ring-primary/30'
  if (score >= 40)
    return 'bg-[var(--signal-vague)]/10 text-[var(--signal-vague)] ring-[var(--signal-vague)]/30'
  return 'bg-[var(--signal-weak)]/10 text-[var(--signal-weak)] ring-[var(--signal-weak)]/30'
}

function difficultyValue(value: string) {
  if (value === 'HARD') return 3
  if (value === 'MEDIUM') return 2
  return 1
}

function journeyChipCls(step: string) {
  const s = step.toLowerCase()
  if (s.includes('follow-up'))
    return 'bg-[var(--signal-vague)]/10 text-[var(--signal-vague)] ring-[var(--signal-vague)]/30'
  if (s.includes('hard') || s.includes('raised'))
    return 'bg-[var(--signal-weak)]/10 text-[var(--signal-weak)] ring-[var(--signal-weak)]/30'
  if (s.includes('easy'))
    return 'bg-[var(--signal-strong)]/10 text-[var(--signal-strong)] ring-[var(--signal-strong)]/30'
  return 'bg-primary/10 text-primary ring-primary/25'
}
