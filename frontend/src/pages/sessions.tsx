import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Monitor, Smartphone } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import * as authSvc from '@/lib/services/auth.service'
import type { SessionResponse } from '@/lib/types/api'
import { notifyError, notifySuccess } from '@/lib/notify'

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionResponse[] | null>(null)
  const [target, setTarget] = useState<SessionResponse | null>(null)
  const [revokeAllOpen, setRevokeAllOpen] = useState(false)

  const load = useCallback(() => {
    authSvc.sessions()
      .then(setSessions)
      .catch((err: unknown) => {
        setSessions([]);
        notifyError(err instanceof Error ? err.message : 'Unable to load active sessions.');
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const others = sessions?.filter((s) => s.isActive && !s.isRevoked).length ?? 0

  return (
    <AppShell title="Active Sessions">
      <div className="animate-slide-up mx-auto flex max-w-2xl flex-col gap-5">
        <header>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            Settings
          </Link>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Active sessions
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Devices currently signed in to your account.
          </p>
        </header>

        {sessions === null ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {sessions.map((s) => {
                const Icon = s.userAgent.toLowerCase().includes('iphone') || s.deviceType === 'mobile'
                  ? Smartphone
                  : Monitor
                const isCurrentActive = s.isActive && !s.isRevoked
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground ring-1 ring-border">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{s.deviceType} · {s.userAgent.slice(0, 40)}</p>
                        {isCurrentActive ? (
                          <Badge variant="strong" dot>
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="weak">Revoked</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {s.ipAddress} · Expires {new Date(s.expiryDate).toLocaleDateString()}
                      </p>
                    </div>
                    {isCurrentActive ? (
                      <Button variant="outline" size="sm" onClick={() => setTarget(s)}>
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {others > 1 ? (
              <div>
                <Button variant="destructive" onClick={() => setRevokeAllOpen(true)}>
                  Revoke all other sessions
                </Button>
              </div>
            ) : (
              <p className="font-mono text-[11px] text-muted-foreground">
                No other active sessions.
              </p>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={target !== null}
        title="Revoke this session?"
        description={target ? `${target.deviceType} from ${target.ipAddress} will be signed out immediately.` : ''}
        confirmLabel="Revoke session"
        destructive
        onClose={() => setTarget(null)}
        onConfirm={() => {
          if (target) {
            authSvc.revokeSession(target.id).then(load).catch((err: unknown) => {
              notifyError(err instanceof Error ? err.message : 'Unable to revoke session.')
            })
          }
        }}
      />

      <ConfirmDialog
        open={revokeAllOpen}
        title="Revoke all other sessions?"
        description={`${others - 1} other session${others - 1 === 1 ? '' : 's'} will be signed out.`}
        confirmLabel="Revoke all"
        destructive
        onClose={() => setRevokeAllOpen(false)}
        onConfirm={() => {
          authSvc.revokeAllSessions().then(load).catch((err: unknown) => {
            notifyError(err instanceof Error ? err.message : 'Unable to revoke sessions.')
          })
        }}
      />
    </AppShell>
  )
}
