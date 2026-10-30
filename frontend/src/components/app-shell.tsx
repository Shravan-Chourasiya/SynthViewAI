import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  RotateCcw,
  Settings,
  Shield,
  SquareStack,
  User as UserIcon,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandLockup } from './brand-mark'
import { ThemeToggle } from './theme-toggle'
import { NotificationBell } from './notification-bell'
import { CommandTrigger } from './command-palette'
import { Button } from '@/components/ui/button'
import { InitialsAvatar } from '@/components/ui/misc'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useUiStore } from '@/lib/stores/ui-store'
import { interviewService } from '@/lib/services'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: number
}

const MAIN: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/interviews/new', label: 'New Interview', icon: PlusCircle },
  { to: '/interviews', label: 'Interviews', icon: SquareStack, end: true },
  { to: '/interviews/resumable', label: 'Resumable', icon: RotateCcw },
]

const INSIGHTS: NavItem[] = [{ to: '/analytics', label: 'Analytics', icon: BarChart3 }]

const ACCOUNT: NavItem[] = [
  { to: '/profile', label: 'Profile', icon: UserIcon },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const ADMIN: NavItem[] = [{ to: '/admin', label: 'Admin Panel', icon: Shield, end: true }]

function pageTitleFor(pathname: string) {
  if (pathname.startsWith('/interviews/') && pathname !== '/interviews/new') {
    const tail = pathname.split('/')[3]
    const map: Record<string, string> = {
      lobby: 'Lobby',
      live: 'Live room',
      completed: 'Session complete',
      history: 'Question timeline',
      metrics: 'Metrics',
      report: 'Report',
      resumable: 'Resumable sessions',
    }
    if (tail && map[tail]) return map[tail]
    return 'Interview detail'
  }
  if (pathname === '/interviews/new') return 'New interview'
  if (pathname === '/interviews') return 'Interviews'
  if (pathname === '/dashboard') return 'Dashboard'
  if (pathname === '/analytics') return 'Analytics'
  if (pathname === '/profile') return 'Profile'
  if (pathname === '/settings') return 'Settings'
  if (pathname === '/settings/sessions') return 'Active sessions'
  if (pathname === '/admin') return 'Admin panel'
  if (pathname === '/admin/users') return 'Users'
  if (pathname === '/admin/interviews') return 'All interviews'
  return 'SynthView AI'
}

/**
 * Nav group with a single highlight that slides between items instead of each
 * item toggling its own background. Measured from the active link's box.
 */
function NavGroup({ label, items, onNavigate }: { label: string; items: NavItem[]; onNavigate?: () => void }) {
  const listRef = useRef<HTMLUListElement | null>(null)
  const [highlight, setHighlight] = useState<{ top: number; height: number } | null>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const measure = () => {
      const active = list.querySelector<HTMLElement>('[aria-current="page"]')
      if (!active) {
        setHighlight(null)
        return
      }
      // Measure against the list box, not offsetTop — the links live inside a
      // relatively-positioned <li>, so offsetTop is always 0 relative to it.
      const listBox = list.getBoundingClientRect()
      const activeBox = active.getBoundingClientRect()
      setHighlight({ top: activeBox.top - listBox.top, height: activeBox.height })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [pathname, items])

  return (
    <div className="px-3">
      <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <ul ref={listRef} className="relative space-y-0.5">
        {highlight ? (
          <li
            aria-hidden
            className="pointer-events-none absolute inset-x-0 rounded-lg bg-sidebar-accent ring-1 ring-sidebar-ring/30 transition-all duration-300 ease-out"
            style={{ top: highlight.top, height: highlight.height }}
          />
        ) : null}
        {items.map((item) => (
          <li key={item.to} className="relative">
            <NavLink
              to={item.to}
              end={item.end}
              viewTransition
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  isActive
                    ? 'font-medium text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary tabular-nums ring-1 ring-primary/25">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()

  const { data: resumable } = useQuery({
    queryKey: ['interviews', 'resumable'],
    queryFn: () => interviewService.resumable(),
    staleTime: 30_000,
  })

  const main = MAIN.map((item) =>
    item.to === '/interviews/resumable' ? { ...item, badge: resumable?.length ?? 0 } : item,
  )

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <BrandLockup compact />
        </Link>
      </div>

      <nav
        className="scrollbar-none flex-1 space-y-4 overflow-y-auto py-4"
        aria-label="App"
        data-lenis-prevent
      >
        <NavGroup label="Main" items={main} onNavigate={onNavigate} />
        <NavGroup label="Insights" items={INSIGHTS} onNavigate={onNavigate} />
        <NavGroup label="Account" items={ACCOUNT} onNavigate={onNavigate} />
        {(user?.userrole === 'admin' || user?.userrole === 'owner') ? <NavGroup label="Admin" items={ADMIN} onNavigate={onNavigate} /> : null}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {user ? (
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <InitialsAvatar name={user.name ?? user.username} className="size-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name ?? user.username}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">@{user.username}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Sign out"
              onClick={() => {
                signOut()
                navigate('/')
              }}
              className="text-muted-foreground"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        ) : (
          <Link
            to="/login"
            className="block rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/50"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  )
}

export function AppShell() {
  const location = useLocation()
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname, setSidebarOpen])

  return (
    <div className="min-h-dvh bg-background">
      <aside className="app-sidebar fixed inset-y-0 left-0 hidden w-64 border-r border-sidebar-border lg:block">
        <SidebarContent />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative h-full w-64 animate-slide-in-left border-r border-sidebar-border shadow-2xl">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close navigation"
              className="absolute top-3.5 right-3 z-10 text-muted-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="size-4" />
            </Button>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="app-topbar sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon-sm"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <h1 className="truncate text-sm font-semibold tracking-tight">{pageTitleFor(location.pathname)}</h1>
          </div>
          <div className="flex items-center gap-2">
            <CommandTrigger />
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl animate-slide-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
