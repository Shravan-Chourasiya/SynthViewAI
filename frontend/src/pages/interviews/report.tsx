import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, History } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { ReportSkeleton, ReportView } from '@/components/report-view'
import { ErrorState } from '@/components/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { interviewService } from '@/lib/services'

export default function ReportPage() {
  const { id = '' } = useParams()

  const interviewQuery = useQuery({
    queryKey: ['interview', id],
    queryFn: () => interviewService.get(id),
  })

  const reportQuery = useQuery({
    queryKey: ['interview', id, 'report'],
    queryFn: () => interviewService.report(id),
  })

  if (reportQuery.isError) {
    return (
      <ErrorState
        code="404"
        title="No report available"
        body="This session has not finished evaluating yet, or it was abandoned before any answer was scored."
        actions={
          <Link to={`/interviews/${id}`} className={buttonVariants({ variant: 'outline' })}>
            Back to interview
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={interviewQuery.data?.code}
        title="Report"
        lede="The full write-up: scores, per-question feedback and what to practise next."
        actions={
          <>
            <Link
              to={`/interviews/${id}/history`}
              className={buttonVariants({ variant: 'outline' })}
            >
              <History className="size-4" />
              Timeline
            </Link>
            <Link to="/interviews" className={buttonVariants({ variant: 'ghost' })}>
              <ArrowLeft className="size-4" />
              All interviews
            </Link>
          </>
        }
      />

      {reportQuery.isLoading || !reportQuery.data ? (
        <ReportSkeleton />
      ) : (
        <ReportView report={reportQuery.data} interview={interviewQuery.data} variant="app" />
      )}
    </div>
  )
}
