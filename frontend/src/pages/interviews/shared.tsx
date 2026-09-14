import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ClipboardList, FileDown, Play, RotateCcw, SearchX } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DifficultyBadge, TypeBadge } from '@/components/interview-ui'
import { api } from '@/lib/api'
import { downloadPdf } from '@/lib/pdf-export'
import { fmtDate, fmtMinutes } from '@/lib/format'
import type { Interview } from '@/lib/types'
import { cn } from '@/lib/utils'

export type DetailTab = 'overview' | 'history' | 'metrics' | 'report'

export function useInterview(id: string | undefined) {
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let alive = true
    api.getInterview(id).then((it) => {
      if (!alive) return
      setInterview(it)
      setLoading(false)
    }).catch((err: unknown) => {
      if (!alive) return
      setError(err instanceof Error ? err.message : 'Unable to load interview.')
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [id])

  return { interview, loading, error }
}

export function InterviewHeader({
  interview,
  active,
  className,
}: {
  interview: Interview
  active: DetailTab
  className?: string
}) {
  const tabs: { key: DetailTab; to: string; label: string }[] = [
    { key: 'overview', to: `/interviews/${interview.id}`, label: 'Overview' },
    { key: 'history', to: `/interviews/${interview.id}/history`, label: 'History' },
    { key: 'metrics', to: `/interviews/${interview.id}/metrics`, label: 'Metrics' },
  ]
  if (interview.status === 'COMPLETED') {
    tabs.push({ key: 'report', to: `/interviews/${interview.id}/report`, label: 'Report' })
  }

  return (
    <div className={cn('interview-context-header flex flex-col gap-4', className)} data-pdf-exclude>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
            <ClipboardList className="size-5 text-primary" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {interviewDisplayTitle(interview)}
              </h1>
              <StatusBadge status={interview.status} />
            </div>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {interview.company} · {interview.domain} · {fmtDate(interview.createdAt)} · Session #{interview.id}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <TypeBadge type={interview.type} />
              <DifficultyBadge difficulty={interview.difficulty} />
              <Badge variant="outline">{fmtMinutes(interview.durationMin)}</Badge>
              <Badge variant="outline">{interview.rounds} rounds</Badge>
            </div>
          </div>
        </div>
        <StateAction interview={interview} active={active} />
      </div>

      <nav aria-label="Interview sections" className="scrollbar-none flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            to={t.to}
            aria-current={active === t.key ? 'page' : undefined}
            className={cn(
              'relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm transition-colors',
              active === t.key
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function interviewDisplayTitle(interview: Interview) {
  return interview.company ? `${interview.roleTitle} at ${interview.company}` : `${interview.roleTitle} interview`;
}

/** Actions respect the interview lifecycle (FR-26). */
function StateAction({ interview, active }: { interview: Interview; active: DetailTab }) {
  const s = interview.status
  if (s === 'CREATED' || s === 'READY') {
    return (
      <Link to={`/interviews/${interview.id}/lobby`} className={cn(buttonVariants())}>
        <Play className="size-4" />
        Start
      </Link>
    )
  }
  if (s === 'IN_PROGRESS') {
    return (
      <Link to={`/interviews/${interview.id}/lobby`} className={cn(buttonVariants())}>
        <RotateCcw className="size-4" />
        Resume
      </Link>
    )
  }
  if (s === 'COMPLETED') {
    return (
      <details className="relative" data-pdf-exclude>
        <summary className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')} aria-label="Export options" title="Export">
          <FileDown className="size-4" />
          <ChevronDown className="size-3" />
        </summary>
        <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl">
          <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => {
            const root = document.querySelector<HTMLElement>('.interview-print-root')
            if (root) void downloadPdf(root, `${interviewDisplayTitle(interview)} ${active}`)
          }}>
            Export {active}
          </button>
          <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => window.open(`/interviews/${interview.id}/report?export=full`, '_blank', 'noopener,noreferrer')}>
            Export full report
          </button>
        </div>
      </details>
    )
  }
  return <Badge variant="weak">Interview closed</Badge>
}

export function InterviewNotFound() {
  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/25">
        <SearchX className="size-6 text-primary" />
      </span>
      <h1 className="mt-5 text-lg font-semibold tracking-tight">Interview not found</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This interview doesn't exist or was removed. Check the history list for
        your sessions.
      </p>
      <div className="mt-6 flex justify-center">
        <Link to="/interviews" className={cn(buttonVariants({ variant: 'outline' }))}>
          Back to interviews
        </Link>
      </div>
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5" aria-busy="true">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-9 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}
