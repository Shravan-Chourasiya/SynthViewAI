import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/app-shell';
import { AdminGate, AdminHeader } from './shared';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminStore } from '@/lib/stores/admin.store';
import { RotateCcw, Search, Calendar, Clock, Eye } from 'lucide-react';

/**
 * Admin interview monitoring.
 *
 * The list is anonymized end to end: the API returns a candidate reference
 * instead of a name, email or user id, so there is no identity here to render.
 * The search box can still take a name or email — that is how an admin locates a
 * session — but what comes back is only the reference, never the identity that
 * was searched for.
 *
 * "View" opens the scores-and-metrics report (`/admin/interviews/:id/report`),
 * not the candidate-facing interview page. The latter would show answers.
 */
export function AdminInterviewsPage() {
  const {
    interviews,
    interviewPagination,
    interviewsLoading,
    interviewsError,
    loadInterviews
  } = useAdminStore();

  const [searchTerm, setSearchTerm] = useState('');
  // Radix Select forbids empty-string item values, so "ALL" is the sentinel.
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [jobRoleFilter, setJobRoleFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadInterviews({
      page: currentPage,
      limit: 10,
      // The search box filters server-side (title + owning user), and must be
      // part of the dependency list or typing would never re-query.
      search: searchTerm.trim() || undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      jobRole: jobRoleFilter.trim() || undefined,
      company: companyFilter.trim() || undefined,
      // `<input type="date">` already yields `YYYY-MM-DD`, which is the format the
      // API parses as a day bound.
      from: fromDate || undefined,
      to: toDate || undefined
    });
  }, [currentPage, searchTerm, statusFilter, jobRoleFilter, companyFilter, fromDate, toDate]);

  const resetFilters = () => {
    setSearchTerm('');
    // 'ALL' is the sentinel the Select needs; '' would blank the trigger.
    setStatusFilter('ALL');
    setJobRoleFilter('');
    setCompanyFilter('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'default';
      case 'INPROGRESS': return 'neutral';
      case 'SCHEDULED': return 'outline';
      case 'DRAFT': return 'neutral';
      case 'CANCELLED': return 'weak';
      case 'ABANDONED': return 'weak';
      case 'EXPIRED': return 'weak';
      case 'TIMED_OUT': return 'weak';
      default: return 'outline';
    }
  };

  const getDifficultyVariant = (difficulty: string | null) => {
    switch (difficulty) {
      case 'EASY': return 'good';
      case 'MEDIUM': return 'vague';
      case 'HARD': return 'weak';
      default: return 'outline';
    }
  };

  return (
    <AppShell title="Admin - Interviews">
      <AdminGate>
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <AdminHeader
            title="Interview Monitoring"
            description="Find a session and open its scores and metrics. Candidates appear as anonymized references — this area never shows their identity, answers or transcripts."
          />

          {interviewsError && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
              Error loading interviews: {interviewsError}
            </div>
          )}

          {/* Filters and Search */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Interview Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {/* The search field takes all the leftover width; the status
                    control stays content-sized from md upwards. */}
                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                  <div className="relative w-full md:min-w-64 md:flex-1">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by title, or a known name/email to locate a session..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-8"
                    />
                  </div>
                  <div className="md:w-44">
                    <Select value={statusFilter} onValueChange={(value) => {
                      setStatusFilter(value);
                      setCurrentPage(1);
                    }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="READY">Ready</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="INPROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      <SelectItem value="ABANDONED">Abandoned</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                      <SelectItem value="TIMED_OUT">Timed Out</SelectItem>
                    </SelectContent>
                  </Select>
                  </div>
                  <Input
                    placeholder="Filter by job role..."
                    value={jobRoleFilter}
                    onChange={(e) => {
                      setJobRoleFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="md:w-52"
                  />
                  <Input
                    placeholder="Filter by company..."
                    value={companyFilter}
                    onChange={(e) => {
                      setCompanyFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="md:w-48"
                  />
                </div>

                {/* Date range on creation date. Kept on its own row so the
                    native date pickers have room on small screens. */}
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    Created from
                    <Input
                      type="date"
                      aria-label="Created from"
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={(e) => {
                        setFromDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-auto"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    to
                    <Input
                      type="date"
                      aria-label="Created to"
                      value={toDate}
                      min={fromDate || undefined}
                      onChange={(e) => {
                        setToDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-auto"
                    />
                  </label>
                  <Button
                    variant="outline"
                    className="w-full sm:ml-auto sm:w-auto"
                    onClick={resetFilters}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interviews Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interviewsLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : interviews.length > 0 ? (
                    interviews.map((interview) => (
                      <TableRow key={interview.id}>
                        <TableCell className="font-mono text-xs">
                          {interview.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium max-w-xs truncate">
                          {interview.title}
                        </TableCell>
                        <TableCell className="font-mono text-xs" title="Anonymized candidate reference">
                          {interview.candidateRef}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[10rem] truncate">
                          {interview.jobRole ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[10rem] truncate">
                          {interview.company ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant={getStatusBadgeVariant(interview.status)}>
                              {interview.status}
                            </Badge>
                            {interview.difficulty && (
                              <Badge variant={getDifficultyVariant(interview.difficulty)}>
                                {interview.difficulty}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            {new Date(interview.createdAt).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(interview.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {/* Internal navigation on purpose: this is the
                              admin metrics report, not the candidate's own
                              interview page. */}
                          <Link
                            className={buttonVariants({ variant: 'default', size: 'sm' })}
                            to={`/admin/interviews/${interview.id}/report`}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View report
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No interviews found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {!interviewsLoading && (
                <div className="flex flex-col items-center justify-between gap-4 border-t bg-card px-6 py-4 sm:flex-row">
                  <div className="text-sm text-muted-foreground">
                    Showing <span className="font-medium">{Math.min((currentPage - 1) * 10 + 1, interviewPagination.total)}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * 10, interviewPagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{interviewPagination.total}</span> interviews
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage <= 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, interviewPagination.totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, interviewPagination.totalPages))}
                      disabled={currentPage >= interviewPagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminGate>
    </AppShell>
  );
}

export default AdminInterviewsPage;
