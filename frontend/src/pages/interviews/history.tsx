import { memo, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { StatusBadge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DifficultyBadge, RowAction, TypeBadge } from '@/components/interview-ui'
import { useInterviewListStore } from '@/lib/stores/interview-list.store'
import { fmtDate } from '@/lib/format'
import { INTERVIEW_STATUSES, type Interview } from '@/lib/types'
import { cn } from '@/lib/utils'

const PER_PAGE = 6

export function InterviewsPage() {
  const all = useInterviewListStore((s) => s.interviews)
  const listStatus = useInterviewListStore((s) => s.status)
  const fetchInterviews = useInterviewListStore((s) => s.fetchInterviews)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    // The store records the failure in `status`/`error`, so swallow the
    // re-thrown rejection here to avoid an unhandled promise rejection.
    void fetchInterviews().catch(() => undefined)
  }, [fetchInterviews])

  useEffect(() => {
    setPage(1)
  }, [query, type, status, difficulty])

  const filtered = useMemo(() => {
    if (!all) return []
    const q = query.trim().toLowerCase()
    return all.filter(
      (i) =>
        (!q || `${i.roleTitle} ${i.company} ${i.domain}`.toLowerCase().includes(q)) &&
        (!type || i.type === type) &&
        (!status || i.status === status) &&
        (!difficulty || i.difficulty === difficulty),
    )
  }, [all, query, type, status, difficulty])

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const slice = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const hasFilters = Boolean(query || type || status || difficulty)

  const clearFilters = () => {
    setQuery('')
    setType('')
    setStatus('')
    setDifficulty('')
  }

  if (listStatus === 'idle' || listStatus === 'loading') {
    return (
      <AppShell title="Interview History">
        <div className="mx-auto flex max-w-7xl flex-col gap-4" aria-busy="true">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </AppShell>
    )
  }

  if (listStatus === 'error') {
    return <AppShell title="Interview History"><p className="p-6 text-sm text-destructive">Unable to load interview history.</p></AppShell>
  }

  return (
    <AppShell title="Interview History">
      <div className="animate-slide-up mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Interview history
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Every session you've configured, taken, or resumed.
            </p>
          </div>
          {all.length > 0 ? (
            <Link to="/interviews/new" className={cn(buttonVariants(), 'h-10 px-4')}>
              <Plus className="size-4" />
              New Interview
            </Link>
          ) : null}
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-3.5">
          {/* Full width on phones, then grows to absorb the leftover row space. */}
          <div className="relative basis-full sm:basis-auto sm:min-w-72 sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search role, company or domain…"
              aria-label="Search interviews"
              className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <FilterSelect label="Filter by type" value={type} onChange={setType}>
            <option value="">All types</option>
            {['Behavioral', 'Technical', 'Mixed'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Filter by status" value={status} onChange={setStatus}>
            <option value="">All statuses</option>
            {INTERVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Filter by difficulty" value={difficulty} onChange={setDifficulty}>
            <option value="">All difficulty</option>
            {['Easy', 'Medium', 'Hard', 'Adaptive'].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </FilterSelect>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </div>

        {/* table / empty states */}
        {all.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <h2 className="text-lg font-semibold tracking-tight">No interviews yet.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Start your first AI interview — it adapts to every answer you give.
            </p>
            <div className="mt-6 flex justify-center">
              <Link to="/interviews/new" className={cn(buttonVariants(), 'h-10 px-4')}>
                <Plus className="size-4" />
                Start your first interview
              </Link>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <h2 className="text-lg font-semibold tracking-tight">
              No interviews match your filters.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different search term or reset the filters.
            </p>
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-190 text-left">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Difficulty</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Score</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {slice.map((i) => (
                    <InterviewHistoryRow key={i.id} interview={i} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* pagination */}
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="font-mono text-[11px] text-muted-foreground">
                {filtered.length} result{filtered.length === 1 ? '' : 's'} · Page {page} of {pages}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                  className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                  className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

const InterviewHistoryRow = memo(function InterviewHistoryRow({ interview: i }: { interview: Interview }) {
  return (
    <tr className="text-sm transition-colors hover:bg-accent/40">
      <td className="px-5 py-3.5">
        <Link
          to={`/interviews/${i.id}`}
          className="font-medium transition-colors hover:text-primary"
        >
          {i.roleTitle}
        </Link>
        <p className="font-mono text-[11px] text-muted-foreground">
          {i.company}
        </p>
      </td>
      <td className="px-4 py-3.5"><TypeBadge type={i.type} /></td>
      <td className="px-4 py-3.5"><DifficultyBadge difficulty={i.difficulty} /></td>
      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
        {fmtDate(i.createdAt)}
      </td>
      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
        {i.durationMin}m
      </td>
      <td className="px-4 py-3.5"><StatusBadge status={i.status} /></td>
      <td className="px-4 py-3.5 text-right font-mono tabular-nums">
        {i.score !== null ? i.score : '—'}
      </td>
      <td className="px-5 py-3.5 text-right">
        <RowAction interview={i} />
      </td>
    </tr>
  )
})

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-md border border-input bg-transparent pl-3 pr-8 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}