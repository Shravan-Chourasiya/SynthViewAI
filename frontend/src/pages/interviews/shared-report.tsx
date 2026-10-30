import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { BrandLockup } from '@/components/brand-mark'
import { ThemeToggle } from '@/components/theme-toggle'
import { ReportSkeleton, ReportView } from '@/components/report-view'
import { ErrorState } from '@/components/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { interviewService } from '@/lib/services'

export default function SharedReportPage() {
  const { token = '' } = useParams()

  const reportQuery = useQuery({
    queryKey: ['shared-report', token],
    queryFn: () => interviewService.reportByToken(token),
  })

  const interviewQuery = useQuery({
    queryKey: ['shared-interview', token],
    queryFn: () => interviewService.getByToken(token),
  })

  return (
    <div className="min-h-dvh bg-background">
      <header className="site-nav sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandLockup />
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="hidden sm:inline-flex">
              shared report · read only
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {reportQuery.isError ? (
          <ErrorState
            title="This shared report is no longer available"
            body="The owner may have revoked the link, or the token is incorrect."
            actions={
              <Link to="/" className={buttonVariants({ variant: 'outline' })}>
                Back to SynthView
              </Link>
            }
          />
        ) : reportQuery.isLoading || !reportQuery.data ? (
          <ReportSkeleton />
        ) : (
          <div className="animate-slide-up space-y-6">
            <ReportView
              report={reportQuery.data}
              interview={interviewQuery.data}
              variant="shared"
              footer={
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-6">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">
                      Want an interview that adapts to you?
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Run your own session and get a report like this in half an hour.
                    </p>
                  </div>
                  <Link to="/register" className={buttonVariants({ size: 'lg' })}>
                    Get Started
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              }
            />
          </div>
        )}
      </main>
    </div>
  )
}
