import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ClipboardList, FileDown, Loader2, Play, RotateCcw, SearchX } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DifficultyBadge, TypeBadge } from '@/components/interview-ui'
import { api } from '@/lib/api'
import { downloadFullReportPdf, downloadTabPdf, type ExportTab, type ReportMetrics } from '@/lib/pdf-export'
import { notifyError, notifySuccess } from '@/lib/notify'
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
    return <ExportMenu interview={interview} active={active} />
  }
  return <Badge variant="weak">Interview closed</Badge>
}

/** Maps a report tab onto the export modes the PDF generator understands. */
function exportTabFor(active: DetailTab): ExportTab {
  if (active === 'metrics') return 'metrics'
  if (active === 'history') return 'timeline'
  if (active === 'report') return 'report'
  return 'overview'
}

/**
 * The two export entry points that actually exist in this app: the current tab,
 * and the full report (Overview + Metrics + Report + History).
 *
 * Both generate the PDF from server data rather than a DOM screenshot, so both
 * are real network requests and therefore need an in-progress state — previously
 * there was no feedback between clicking export and the file appearing.
 */
function ExportMenu({ interview, active }: { interview: Interview; active: DetailTab }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [busy, setBusy] = useState<'tab' | 'full' | null>(null)
  const tab = exportTabFor(active)

  const closeMenu = () => detailsRef.current?.removeAttribute('open')

  async function exportTab() {
    setBusy('tab')
    try {
      const payload = { interview, tab }
      if (tab === 'report') {
        downloadTabPdf({ ...payload, report: await api.getReport(interview.id) })
      } else if (tab === 'metrics') {
        downloadTabPdf({ ...payload, metrics: (await api.getMetrics(interview.id)) as ReportMetrics })
      } else if (tab === 'timeline') {
        downloadTabPdf({ ...payload, history: await api.getHistory(interview.id) })
      } else {
        downloadTabPdf(payload)
      }
      notifySuccess(`Exported the ${active} view.`)
      closeMenu()
    } catch {
      notifyError('Could not export this view. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function exportFull() {
    setBusy('full')
    try {
      const [report, metrics, history] = await Promise.all([
        api.getReport(interview.id),
        api.getMetrics(interview.id).catch(() => null),
        api.getHistory(interview.id).catch(() => []),
      ])
      downloadFullReportPdf({
        interview,
        report,
        metrics: metrics as ReportMetrics | null,
        history,
      })
      notifySuccess('Exported the full report.')
      closeMenu()
    } catch {
      notifyError('Could not export the full report. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <details ref={detailsRef} className="relative" data-pdf-exclude>
      <summary
        className={cn(
          buttonVariants({ variant: 'outline', size: 'icon' }),
          'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
        )}
        aria-label="Export options"
        title="Export"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
        <ChevronDown className="size-3" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl">
        <button
          type="button"
          disabled={busy !== null}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-60"
          onClick={() => void exportTab()}
        >
          {busy === 'tab' ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Export {active}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-60"
          onClick={() => void exportFull()}
        >
          {busy === 'full' ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Export full report
        </button>
      </div>
    </details>
  )
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

/**
 * Loading placeholder for the interview detail routes. Its shape mirrors the
 * real pages rather than a generic block: header, a hero band (the report's
 * score ring sits here), a two-column card grid, then accordion rows — which is
 * the report page's actual structure.
 */
export function DetailSkeleton() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5" aria-busy="true">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-9 w-full max-w-md" />
      </div>
      <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-border bg-card p-6">
        <Skeleton className="size-28 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
