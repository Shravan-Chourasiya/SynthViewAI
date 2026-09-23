import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, Brain, Check, ClipboardList, SearchX } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { ScoreRing } from '@/components/charts'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { DifficultyBadge, TypeBadge } from '@/components/interview-ui'
import { httpGet } from '@/lib/http'
import { ENDPOINTS } from '@/lib/constants/endpoints'
import { fmtDate, fmtMinutes } from '@/lib/format'
import type { Difficulty, InterviewType } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Public, read-only report viewer (doc 07 stretch goal).
 *
 * Rendered for anyone opening a share link (`/interviews/shared/:token`) — no
 * auth. The backend endpoint is unauthenticated by design and returns an
 * already-redacted payload (no candidate identity, no account fields), so this
 * page only ever renders what the API chose to expose.
 */

interface SharedReportPayload {
  interview: {
    id: string
    title: string
    type: InterviewType
    difficulty: Difficulty
    duration: number
    domain: string | null
    jobRole: string | null
    completedAt: string
  }
  report: {
    overallScore: string | number
    technicalScore: string | number
    communicationScore: string | number
    problemSolvingScore: string | number
    confidenceScore: string | number
    feedback: string
    strengths: string[]
    weaknesses: string[]
  }
  questions: {
    sequenceNumber: number
    questionTitle: string
    questionType: string
    answerData: string | null
    evaluationData: {
      score: number
      feedback: string
      strengths?: string[]
      weaknesses?: string[]
    } | null
    timeTakenSeconds: number | null
  }[]
}

function asNumber(value: string | number | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function scoreClass(score: number) {
  if (score >= 80)
    return 'bg-[var(--signal-strong)]/10 text-[var(--signal-strong)] ring-[var(--signal-strong)]/30'
  if (score >= 60) return 'bg-primary/10 text-primary ring-primary/30'
  if (score >= 40)
    return 'bg-[var(--signal-vague)]/10 text-[var(--signal-vague)] ring-[var(--signal-vague)]/30'
  return 'bg-[var(--signal-weak)]/10 text-[var(--signal-weak)] ring-[var(--signal-weak)]/30'
}

function signalForScore(score: number): 'strong' | 'good' | 'vague' | 'weak' {
  if (score >= 80) return 'strong'
  if (score >= 60) return 'good'
  if (score >= 40) return 'vague'
  return 'weak'
}

export default function SharedReportPage() {
  const { token } = useParams()
  const [data, setData] = useState<SharedReportPayload | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!token) return
    let alive = true
    httpGet<SharedReportPayload>(ENDPOINTS.interviews.sharedReport(token))
      .then((payload) => {
        if (alive) setData(payload)
      })
      .catch((err: unknown) => {
        if (!alive) return
        if (err instanceof Error && /not (available|found)|revoked/i.test(err.message)) {
          setNotFound(true)
        } else {
          setError(true)
        }
      })
    return () => {
      alive = false
    }
  }, [token])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark className="size-8" />
            <span className="text-[15px] font-semibold tracking-tight">
              SynthView <span className="text-primary">AI</span>
            </span>
          </Link>
          <Badge variant="outline">Shared report — read only</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {notFound ? (
          <div className="mx-auto max-w-md pt-16 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/25">
              <SearchX className="size-6 text-primary" />
            </span>
            <h1 className="mt-5 text-lg font-semibold tracking-tight">This link is no longer valid</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The share link has expired or was revoked by its owner. Ask the person who shared it
              for a fresh link.
            </p>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md pt-16 text-center">
            <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The report could not be loaded. Try refreshing the page.
            </p>
          </div>
        ) : !data ? (
          <div className="animate-pulse mx-auto flex max-w-3xl flex-col gap-4 pt-4" aria-busy="true">
            <div className="h-24 rounded-2xl bg-muted" />
            <div className="h-40 rounded-2xl bg-muted" />
            <div className="h-64 rounded-2xl bg-muted" />
          </div>
        ) : (
          <div className="animate-slide-up flex flex-col gap-5">
            <section className="rounded-2xl border border-primary/25 bg-primary/5 p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-6">
                <ScoreRing value={asNumber(data.report.overallScore)} size={124} stroke={10} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeBadge type={data.interview.type} />
                    <DifficultyBadge difficulty={data.interview.difficulty} />
                  </div>
                  <h1 className="mt-2.5 text-xl font-semibold tracking-tight sm:text-2xl">
                    {data.interview.jobRole ?? data.interview.title}
                  </h1>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {data.interview.domain ?? 'General'} · {fmtDate(data.interview.completedAt)} ·{' '}
                    {fmtMinutes(data.interview.duration)}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold">Summary</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.report.feedback}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--signal-strong)]">Strengths</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {data.report.strengths.slice(0, 6).map((s) => (
                      <li key={s} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--signal-strong)]" strokeWidth={3} />
                        <span className="text-muted-foreground">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--signal-vague)]">Areas to improve</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {data.report.weaknesses.slice(0, 6).map((w) => (
                      <li key={w} className="flex items-start gap-2 text-sm">
                        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-[var(--signal-vague)]" />
                        <span className="text-muted-foreground">{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Question-level analysis</h2>
              <span className="font-mono text-[11px] text-muted-foreground">
                {data.questions.filter((q) => q.evaluationData).length} evaluated answers
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {data.questions
                .filter((q) => q.evaluationData)
                .map((q) => {
                  const evaluation = q.evaluationData!
                  return (
                    <details key={q.sequenceNumber} className="rounded-2xl border border-border bg-card">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="neutral">Q{q.sequenceNumber}</Badge>
                          <Badge variant="outline">{q.questionType}</Badge>
                          <Badge variant={signalForScore(evaluation.score)} dot>
                            {signalForScore(evaluation.score)}
                          </Badge>
                        </div>
                        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-relaxed sm:px-2">
                          {q.questionTitle}
                        </h3>
                        <span
                          className={cn(
                            'rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums ring-1',
                            scoreClass(evaluation.score),
                          )}
                        >
                          {evaluation.score}
                          <span className="text-muted-foreground">/100</span>
                        </span>
                      </summary>
                      <div className="border-t border-border p-5 pt-4">
                        <div className="rounded-lg border border-border bg-background/50 px-3.5 py-2.5">
                          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                            Answer
                          </p>
                          <p className="mt-1 text-sm leading-relaxed">{q.answerData ?? 'No answer recorded.'}</p>
                        </div>
                        <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-primary/5 px-3.5 py-2.5 ring-1 ring-primary/20">
                          <Brain className="mt-0.5 size-3.5 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="font-mono text-[9px] uppercase tracking-wider text-primary">
                              AI evaluation
                            </p>
                            <p className="mt-1 text-sm leading-relaxed">{evaluation.feedback}</p>
                          </div>
                        </div>
                      </div>
                    </details>
                  )
                })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
              <p className="flex items-center gap-2 text-xs leading-relaxed text-muted-foreground">
                <ClipboardList className="size-3.5 shrink-0" />
                This report was shared with you via SynthView AI.
              </p>
              <Link to="/" className={cn(buttonVariants({ variant: 'outline' }))}>
                Learn more
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
