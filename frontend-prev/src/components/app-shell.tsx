import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RotateCcw,
  Settings,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { BrandMark } from '@/components/brand-mark'
import { NotificationBell } from '@/components/notification-bell'
import { useAuthStore } from '@/lib/stores/auth.store'
import { resumableInterviews } from '@/lib/services/interview.service'
import { canAccessAdmin } from '@/lib/roles'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  /** null = still loading, undefined = fetch failed — both suppress the badge. */
  count?: number | null
}

const isActive = (pathname: string, to: string) => {
  if (to === '/interviews') {
    return pathname === '/interviews' || /^\/interviews\/(?!new$|resumable$)[^/]+$/.test(pathname)
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  // Task A: the real resumable count. While loading (null) or on error
  // (undefined) no badge renders — a flashing 0 or a broken fetch must never
  // look like "nothing to resume".
  const [resumable, setResumable] = useState<number | null | undefined>(null)

  useEffect(() => {
    let alive = true
    resumableInterviews()
      .then((items) => {
        if (alive) setResumable(items.length)
      })
      .catch(() => {
        if (alive) setResumable(undefined) // fail silent → no badge
      })
    return () => {
      alive = false
    }
  }, [])

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Main',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/interviews/new', label: 'New Interview', icon: Plus },
        { to: '/interviews', label: 'Interviews', icon: ClipboardList },
        { to: '/interviews/resumable', label: 'Resumable', icon: RotateCcw, count: resumable ?? null },
      ],
    },
    {
      title: 'Insights',
      items: [{ to: '/analytics', label: 'Analytics', icon: BarChart3 }],
    },
    {
      title: 'Account',
      items: [
        { to: '/profile', label: 'Profile', icon: UserIcon },
        { to: '/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]
  
  // Add the admin menu for every role that can reach the admin area
  // (moderator < admin < owner — see @/lib/roles).
  if (canAccessAdmin(user?.userrole)) {
    groups.push({
      title: 'Admin',
      items: [{ to: '/admin', label: 'Admin Panel', icon: Shield }],
    })
  }

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {g.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = isActive(pathname, item.to)
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground ring-1 ring-sidebar-ring/30'
                      : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                  {item.count != null && item.count > 0 ? (
                    <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 font-mono text-[10px] leading-none text-primary-foreground">
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const initials = ([user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const signOut = () => {
    void logout().then(() => navigate('/login'))
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* mobile scrim */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3.5">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark className="size-9" />
            <span className="text-[15px] font-semibold tracking-tight">
              SynthView <span className="text-primary">AI</span>
            </span>
          </Link>
          <button
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <SideNav onNavigate={() => setOpen(false)} />

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/40 px-2.5 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-semibold text-primary ring-1 ring-primary/30">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Candidate'}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                @{user?.username ?? ''}
              </p>
            </div>
            <button
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="app-shell-topbar sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </button>
            <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        <main className="app-shell-main flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
