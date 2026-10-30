import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Laptop, Monitor, Smartphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { SkeletonRows } from '@/components/ui/skeleton'
import { authService } from '@/lib/services'
import { formatDateTime } from '@/lib/format'
import type { SessionResponse } from '@/lib/api-types'

function deviceIcon(device: string) {
  if (/iphone|android|pixel/i.test(device)) return Smartphone
  if (/thinkpad|windows|surface/i.test(device)) return Laptop
  return Monitor
}

export default function SessionsPage() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['sessions'],
    queryFn: () => authService.sessions(),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => authService.revokeSession(id),
    onSuccess: () => {
      toast.success('Session revoked')
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Where you are signed in."
        lede="Revoke anything you do not recognise. The device you are on now cannot be revoked from here."
        actions={
          <Link to="/settings" className={buttonVariants({ variant: 'ghost' })}>
            <ArrowLeft className="size-4" />
            Back to settings
          </Link>
        }
      />

      <Panel flush>
        <PanelHeader
          title="Active sessions"
          aside={
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {query.data?.length ?? 0} devices
            </span>
          }
        />

        {query.isLoading ? (
          <SkeletonRows rows={3} />
        ) : query.isError ? (
          <p className="p-5 text-sm text-destructive">Could not load your active sessions.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(query.data ?? []).map((session: SessionResponse, index: number) => {
              const Icon = deviceIcon(session.deviceType)
              return (
                <li
                  key={session.id}
                  className="animate-rise-in flex flex-wrap items-center gap-4 px-5 py-4"
                  style={{ '--stagger-i': index } as React.CSSProperties}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
                    <Icon className="size-4.5 text-primary" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {session.deviceType}
                      {!session.isExpired && !session.isRevoked ? <Badge variant="strong">active</Badge> : null}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {session.userAgent} · {session.ipAddress}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      expires {formatDateTime(session.expiryDate)}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                      since {formatDateTime(session.createdAt)}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    disabled={session.isExpired || session.isRevoked || revoke.isPending}
                    onClick={() => revoke.mutate(session.id)}
                  >
                    <Trash2 className="size-4" />
                    Revoke
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel className="flex items-start gap-3 border-signal-vague/30 bg-signal-vague/5">
        <p className="text-sm leading-relaxed">
          Revoking a session signs that device out immediately. If you see a device you do not recognise, change
          your password as well.
        </p>
      </Panel>
    </div>
  )
}
