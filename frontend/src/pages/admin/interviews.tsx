import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Search, SquareStack } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SkeletonRows } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { ScoreChip } from '@/components/stat-card'
import { interviewService } from '@/lib/services'
import { DIFFICULTY_LABEL, TYPE_LABEL, formatDate } from '@/lib/format'
import type { InterviewStatus, InterviewType } from '@/lib/types'

const PAGE_SIZE = 10

export default function AdminInterviewsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<InterviewStatus | 'all'>('all')
  const [type, setType] = useState<InterviewType | 'all'>('all')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['admin', 'interviews', { search, status, type, page }],
    queryFn: () => interviewService.list({ search, status, type, page, pageSize: PAGE_SIZE, sort: 'recent' }),
  })

  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="All interviews."
        lede="Every session on the platform. Open any completed session as a scores-only report."
      />

      <Panel flush>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search role or session code"
              className="pl-9"
              aria-label="Search interviews"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as InterviewStatus | 'all')
              setPage(1)
            }}
          >
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
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value as InterviewType | 'all')
              setPage(1)
            }}
          >
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
        </div>

        <PanelHeader
          title="Sessions"
          aside={
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{total} total</span>
          }
        />

        {query.isLoading ? (
          <SkeletonRows rows={PAGE_SIZE} />
        ) : query.data && query.data.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Report</TableHead>
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
                      <p className="text-sm font-medium">{interview.roleTitle}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {interview.code} · {interview.candidateId}
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
                    <TableCell className="text-right">
                      <Link
                        to={`/admin/interviews/${interview.id}/report`}
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      >
                        <FileText className="size-3.5" />
                        View
                      </Link>
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
              title="No sessions match"
              description="Adjust the filters, or clear the search box to see everything."
            />
          </div>
        )}
      </Panel>
    </div>
  )
}
