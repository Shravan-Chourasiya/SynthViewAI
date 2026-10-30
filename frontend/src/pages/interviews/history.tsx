import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownUp, Plus, Search, SquareStack } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SkeletonRows } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { ScoreChip } from '@/components/stat-card'
import { interviewService } from '@/lib/services'
import { DIFFICULTY_LABEL, TYPE_LABEL, formatDate } from '@/lib/format'
import type { InterviewStatus, InterviewType } from '@/lib/types'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 8

export default function InterviewHistoryPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<InterviewStatus | 'all'>('all')
  const [type, setType] = useState<InterviewType | 'all'>('all')
  const [sort, setSort] = useState<'recent' | 'score' | 'role'>('recent')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['interviews', 'list', { search, status, type, sort, page }],
    queryFn: () => interviewService.list({ search, status, type, sort, page, pageSize: PAGE_SIZE }),
  })

  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const onSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  const onStatus = (value: string) => {
    setStatus(value as InterviewStatus | 'all')
    setPage(1)
  }
  const onType = (value: string) => {
    setType(value as InterviewType | 'all')
    setPage(1)
  }
  const onSort = (value: string) => {
    setSort(value as 'recent' | 'score' | 'role')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Every session you have run."
        lede="Filter by status or format, sort by score, and open any session to read its report."
        actions={
          <Link to="/interviews/new" className={buttonVariants({})}>
            <Plus className="size-4" />
            New interview
          </Link>
        }
      />

      <Panel flush>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search roles, codes or topics"
              className="pl-9"
              aria-label="Search interviews"
            />
          </div>

          <Select value={status} onValueChange={onStatus}>
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in-progress">In progress</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="abandoned">Abandoned</SelectItem>
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={onType}>
            <SelectTrigger className="w-36" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="behavioral">Behavioral</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={onSort}>
            <SelectTrigger className="w-40" aria-label="Sort interviews">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most recent</SelectItem>
              <SelectItem value="score">Highest score</SelectItem>
              <SelectItem value="role">Role A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <PanelHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ArrowDownUp className="size-3.5 text-muted-foreground" />
              Results
            </span>
          }
          aside={
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {total} session{total === 1 ? '' : 's'}
            </span>
          }
        />

        {query.isLoading ? (
          <SkeletonRows rows={PAGE_SIZE} />
        ) : query.isError ? (
          <p className="p-5 text-sm text-destructive">Could not load interviews. Try again shortly.</p>
        ) : query.data && query.data.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((interview, index) => (
                  <TableRow
                    key={interview.id}
                    className="animate-rise-in"
                    style={{ '--stagger-i': index } as React.CSSProperties}
                  >
                    <TableCell>
                      <Link
                        to={`/interviews/${interview.id}`}
                        className="rounded font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {interview.roleTitle}
                      </Link>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {interview.code}
                        {interview.company ? ` · ${interview.company}` : ''}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="neutral">{TYPE_LABEL[interview.type]}</Badge>
                        <Badge variant="outline">{DIFFICULTY_LABEL[interview.difficulty]}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={interview.status} />
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {formatDate(interview.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ScoreChip score={interview.score} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={SquareStack}
              title="Nothing matches those filters"
              description="Try clearing the search box, or run a new session and it will show up here."
              action={
                <Link to="/interviews/new" className={cn(buttonVariants({ variant: 'outline' }))}>
                  Start an interview
                </Link>
              }
            />
          </div>
        )}
      </Panel>
    </div>
  )
}
