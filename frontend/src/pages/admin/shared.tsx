import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { ErrorState } from '@/components/error-state'
import { useAuthStore } from '@/lib/stores/auth.store'
import { canAccessAdmin, getRoleRank, ROLE_RANK } from '@/lib/roles'
import { cn } from '@/lib/utils'

/** "Admin" for admin/owner actors, "Moderator" for moderator actors. */
function useAreaLabel(): 'Admin' | 'Moderator' {
  const role = useAuthStore((s) => s.user?.userrole)
  return getRoleRank(role) >= ROLE_RANK.admin ? 'Admin' : 'Moderator'
}

export function useAdminCopy(page: 'users' | 'interviews' | 'overview') {
  const areaLabel = useAreaLabel()
  const copy = {
    users: { title: 'User Management', description: 'Manage user accounts, roles, and access' },
    interviews: { title: 'Interview Oversight', description: 'Monitor and review interview sessions' },
    overview: { title: `${areaLabel} Overview`, description: 'Platform statistics and activity summary' },
  }
  return copy[page]
}

export function AdminGate({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  if (!canAccessAdmin(user.userrole)) {
    return (
      <ErrorState
        code="403"
        title="Admin access required"
        body="Your account doesn't have administrator permissions."
      >
      </ErrorState>
    )
  }
  return <>{children}</>
}

export function AdminUnavailable() {
  return (
    <div className="animate-slide-up mx-auto max-w-2xl pt-8">
      <ErrorState
        code="N/A"
        title="Admin data is not available yet"
        body="The current backend contract does not expose administrative user or interview endpoints. This screen will remain unavailable until those routes are implemented."
      />
    </div>
  )
}

const ADMIN_LINKS = [
  { to: '/admin', label: 'Overview', exact: true },
  { to: '/admin/users', label: 'Users', exact: false },
  { to: '/admin/interviews', label: 'Interviews', exact: false },
]

export function AdminHeader({ title, description }: { title: string; description: string }) {
  const { pathname } = useLocation()
  const areaLabel = useAreaLabel()
  return (
    <header className="flex flex-col gap-4">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary ring-1 ring-primary/25">
          <Shield className="size-3" />
          {areaLabel} area
        </span>
        <h1 className="mt-2.5 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <nav
        aria-label="Admin sections"
        className="scrollbar-none flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border"
      >
        {ADMIN_LINKS.map((l) => {
          const active = l.exact ? pathname === l.to : pathname.startsWith(l.to)
          return (
            <Link
              key={l.to}
              to={l.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm transition-colors',
                active
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {l.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}