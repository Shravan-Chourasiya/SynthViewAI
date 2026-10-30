import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Award, FileText, LayoutGrid, Loader2, Plus } from 'lucide-react'
import { ScoreRing } from '@/components/charts'
import { Alert } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { DifficultyBadge, TypeBadge } from '@/components/interview-ui'
import { api } from '@/lib/api'
import { fmtMinutes } from '@/lib/format'
import type { Interview } from '@/lib/types'
import { cn } from '@/lib/utils'

export function CompletedPage() {
  const { id } = useParams()
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.getInterview(id).then((it) => {
      setInterview(it)
      setLoaded(true)
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Unable to load completed interview.')
      setLoaded(true)
    })
  }, [id])

  if (!loaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return <div className="mx-auto max-w-2xl p-8"><Alert variant="destructive">{error}</Alert></div>
  }

  if (!interview || interview.status !== 'COMPLETED') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
        <div className="animate-auth-card-in w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Nothing to show yet</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This interview hasn't been completed, so there's no result to display.
          </p>
          <div className="mt-6 flex justify-center">
            <Link to="/interviews" className={cn(buttonVariants({ variant: 'outline' }))}>
              Back to interviews
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const score = interview.score ?? 0
  const message =
    score >= 80
      ? 'Excellent performance — clear strengths to build on.'
      : score >= 60
        ? 'Solid work — a few areas to sharpen.'
        : 'Good start — the report shows exactly where to improve.'

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16 text-foreground">
      <div aria-hidden="true" className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />

      <div className="animate-auth-card-in relative w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-xl shadow-black/20">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
          <Award className="size-6 text-primary" />
        </span>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Interview complete.</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>

        <div className="mt-6 flex justify-center">
          <ScoreRing value={score} size={140} stroke={11} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Cell label="Type">
            <TypeBadge type={interview.type} />
          </Cell>
          <Cell label="Difficulty">
            <DifficultyBadge difficulty={interview.difficulty} />
          </Cell>
          <Cell label="Duration">{fmtMinutes(interview.durationMin)}</Cell>
          <Cell label="Rounds">{interview.rounds}</Cell>
        </div>

        <div className="mt-7 flex flex-col gap-2">
          <Link
            to={`/interviews/${interview.id}/report`}
            className={cn(buttonVariants({ size: 'lg' }), 'h-11 w-full justify-center')}
          >
            <FileText className="size-4" />
            View Full Report
          </Link>
          <div className="flex gap-2">
            <Link
              to="/dashboard"
              className={cn(buttonVariants({ variant: 'outline' }), 'h-10 flex-1 justify-center')}
            >
              <LayoutGrid className="size-4" />
              Dashboard
            </Link>
            <Link
              to="/interviews/new"
              className={cn(buttonVariants({ variant: 'ghost' }), 'h-10 flex-1 justify-center')}
            >
              <Plus className="size-4" />
              Start Another
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 px-2.5 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 flex justify-center text-sm">{children}</div>
    </div>
  )
}