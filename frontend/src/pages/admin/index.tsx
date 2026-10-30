import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowRight, BarChart3, Radio, Users } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { Skeleton, SkeletonStatGrid } from '@/components/ui/skeleton'
import { StatCard } from '@/components/stat-card'
import { CohortChart, StatusDonut } from '@/components/charts'
import { adminService } from '@/lib/services'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function AdminOverviewPage() {
  const query = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminService.stats(),
  })

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <SkeletonStatGrid />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (query.isError || !query.data) {
    return <p className="text-sm text-destructive">Could not load platform statistics.</p>
  }

  const stats = query.data
  const totalSessions = stats.statusMix.reduce((sum, row) => sum + row.count, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Platform overview."
        lede="Adoption, session mix and evaluation distribution across every account."
        actions={
          <>
            <Link to="/admin/users" className={buttonVariants({ variant: 'outline' })}>
              <Users className="size-4" />
              Users
            </Link>
            <Link to="/admin/interviews" className={buttonVariants({ variant: 'outline' })}>
              <Activity className="size-4" />
              Interviews
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.kpis.map((kpi, index) => (
          <StatCard
            key={kpi.label}
            icon={[Users, Activity, Radio, BarChart3][index] ?? BarChart3}
            label={kpi.label}
            value={kpi.value}
            hint={`${kpi.delta} · ${kpi.hint}`}
            index={index}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel flush>
          <PanelHeader title="Signups vs sessions" description="Last six weeks" />
          <div className="p-5">
            <CohortChart data={stats.signups} height={260} />
          </div>
        </Panel>

        <Panel flush>
          <PanelHeader
            title="Session status mix"
            aside={
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {formatNumber(totalSessions)} sessions
              </span>
            }
          />
          <div className="p-5">
            <StatusDonut data={stats.statusMix} height={260} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel flush>
          <PanelHeader title="Score distribution" description="Across completed sessions" />
          <div className="space-y-4 p-5">
            {stats.scoreBands.map((band) => {
              const share = totalSessions ? band.count / totalSessions : 0
              return (
                <div key={band.band} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{band.band}</span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {formatNumber(band.count)} · {(share * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Meter
                    value={share * 100}
                    tone={
                      band.band === 'Strong'
                        ? 'strong'
                        : band.band === 'Good'
                          ? 'good'
                          : band.band === 'Vague'
                            ? 'vague'
                            : 'weak'
                    }
                  />
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel flush>
          <PanelHeader title="Most-practised roles" />
          <ul className="divide-y divide-border">
            {stats.topRoles.map((role, index) => (
              <li
                key={role.role}
                className="animate-rise-in flex items-center gap-4 px-5 py-4"
                style={{ '--stagger-i': index } as React.CSSProperties}
              >
                <span className="min-w-0 flex-1 text-sm">{role.role}</span>
                <Badge variant="neutral">{formatNumber(role.count)}</Badge>
                <span
                  className={cn(
                    'font-mono text-[11px] tabular-nums',
                    role.avgScore >= 75 ? 'text-signal-strong' : 'text-muted-foreground',
                  )}
                >
                  avg {role.avgScore}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border bg-secondary/30 px-5 py-3">
            <Link
              to="/admin/interviews"
              className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Browse all interviews
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  )
}
