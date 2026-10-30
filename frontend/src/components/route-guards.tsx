import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { BrandMark } from '@/components/brand-mark'
import { useAuthStore } from '@/lib/stores/auth-store'
import { ADMIN_AREA_MIN_ROLE, ROLE_RANK, type UserRole } from '@/lib/roles'

/** Shared suspense/fallback shown while a route (or the session) resolves. */
export function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div className="relative">
        <BrandMark className="size-10 animate-float-y" />
        <span className="absolute -inset-2 -z-10 animate-pulse rounded-full bg-primary/10 blur-xl" />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Loading</p>
    </div>
  )
}

/**
 * Route guards live outside the router module so they can be unit-tested
 * without pulling the whole app graph in.
 */

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const location = useLocation()

  useEffect(() => {
    if (status === 'idle') void bootstrap()
  }, [bootstrap, status])

  if (status === 'idle' || status === 'loading') return <RouteFallback />

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (status === 'idle' || status === 'loading') return <RouteFallback />
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // The admin area follows the shared hierarchy in @/lib/roles, which mirrors the
  // backend's `requireRole("moderator")` — moderator and above, not just admin.
  const role = user?.userrole as UserRole | undefined
  if (!role || ROLE_RANK[role] < ROLE_RANK[ADMIN_AREA_MIN_ROLE]) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  if (status === 'idle' || status === 'loading') return <RouteFallback />
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
