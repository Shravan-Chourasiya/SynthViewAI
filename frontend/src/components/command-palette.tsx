import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  BarChart3,
  Command as CommandIcon,
  CornerDownLeft,
  Feather,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Sparkles,
  SquareStack,
  Sun,
  User,
  type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useUiStore } from '@/lib/stores/ui-store'
import { useTheme } from '@/components/theme-context'
import { useMotion } from '@/components/motion-context'
import { interviewService } from '@/lib/services'
import { isCommandK, useHotkey } from '@/hooks/use-scroll-progress'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  group: string
  icon: LucideIcon
  hint?: string
  keywords?: string
  run: () => void
}

/** Cheap fuzzy scorer: substring match wins, otherwise subsequence match. */
function score(query: string, text: string) {
  if (!query) return 1
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const direct = t.indexOf(q)
  if (direct !== -1) return 1000 - direct
  let cursor = 0
  for (const char of q) {
    const found = t.indexOf(char, cursor)
    if (found === -1) return 0
    cursor = found + 1
  }
  return 200 - t.length
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  )
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen)
  const setOpen = useUiStore((s) => s.setCommandOpen)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const navigate = useNavigate()

  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const { resolvedTheme, toggle } = useTheme()
  const { resolvedMotion, setMotion } = useMotion()

  const interviews = useQuery({
    queryKey: ['interviews', 'palette'],
    queryFn: () => interviewService.list({ sort: 'recent', pageSize: 5 }),
    enabled: open,
    staleTime: 60_000,
  })

  const go = useCallback(
    (path: string) => {
      setOpen(false)
      navigate(path)
    },
    [navigate, setOpen],
  )

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'nav-dashboard', label: 'Go to dashboard', group: 'Navigate', icon: LayoutDashboard, run: () => go('/dashboard') },
      { id: 'nav-new', label: 'Start a new interview', group: 'Navigate', icon: Plus, hint: 'wizard', run: () => go('/interviews/new') },
      { id: 'nav-interviews', label: 'All interviews', group: 'Navigate', icon: SquareStack, run: () => go('/interviews') },
      { id: 'nav-resumable', label: 'Resumable sessions', group: 'Navigate', icon: RotateCcw, run: () => go('/interviews/resumable') },
      { id: 'nav-analytics', label: 'Analytics', group: 'Navigate', icon: BarChart3, run: () => go('/analytics') },
      { id: 'nav-profile', label: 'Profile', group: 'Navigate', icon: User, run: () => go('/profile') },
      { id: 'nav-settings', label: 'Settings', group: 'Navigate', icon: Settings, run: () => go('/settings') },
      { id: 'nav-sessions', label: 'Active sessions', group: 'Navigate', icon: Settings, keywords: 'devices security revoke', run: () => go('/settings/sessions') },
    ]

    if (user?.role === 'admin' || user?.userrole === 'admin' || user?.userrole === 'owner') {
      list.push(
        { id: 'nav-admin', label: 'Admin panel', group: 'Admin', icon: Shield, run: () => go('/admin') },
        { id: 'nav-admin-users', label: 'Admin · Users', group: 'Admin', icon: Shield, run: () => go('/admin/users') },
        { id: 'nav-admin-interviews', label: 'Admin · Interviews', group: 'Admin', icon: Shield, run: () => go('/admin/interviews') },
      )
    }

    list.push(
      {
        id: 'act-theme',
        label: resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        group: 'Actions',
        icon: resolvedTheme === 'dark' ? Sun : Moon,
        keywords: 'appearance dark light mode',
        run: () => {
          setOpen(false)
          toggle()
        },
      },
      {
        id: 'act-motion',
        label: resolvedMotion === 'reduced' ? 'Turn animations on' : 'Turn animations off',
        group: 'Actions',
        icon: resolvedMotion === 'reduced' ? Sparkles : Feather,
        keywords: 'motion animation animations reduce reduced accessibility 3d transitions',
        run: () => {
          setOpen(false)
          setMotion(resolvedMotion === 'reduced' ? 'full' : 'reduced')
        },
      },
      {
        id: 'act-check',
        label: 'Run an environment check',
        group: 'Actions',
        icon: RotateCcw,
        keywords: 'camera microphone lobby check',
        run: () => {
          const first = interviews.data?.items[0]
          go(first ? `/interviews/${first.id}/lobby` : '/interviews/new')
        },
      },
    )

    if (user) {
      list.push({
        id: 'act-signout',
        label: 'Sign out',
        group: 'Actions',
        icon: LogOut,
        run: () => {
          setOpen(false)
          void signOut().then(() => navigate('/'))
        },
      })
    }

    for (const interview of interviews.data?.items ?? []) {
      list.push({
        id: `itv-${interview.id}`,
        label: interview.roleTitle,
        group: 'Recent interviews',
        icon: SquareStack,
        hint: interview.code,
        keywords: `${interview.code} ${interview.status} ${interview.field}`,
        run: () => go(`/interviews/${interview.id}`),
      })
    }

    return list
  }, [go, user, resolvedTheme, toggle, resolvedMotion, setMotion, navigate, signOut, interviews.data, setOpen])

  const results = useMemo(() => {
    const scored = commands
      .map((command) => ({
        command,
        value: Math.max(
          score(query, command.label),
          score(query, command.keywords ?? '') * 0.9,
          score(query, command.group) * 0.6,
        ),
      }))
      .filter((entry) => entry.value > 0)

    if (query) scored.sort((a, b) => b.value - a.value)
    return scored.map((entry) => entry.command)
  }, [commands, query])

  useEffect(() => {
    setCursor(0)
  }, [query])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useHotkey((event) => isCommandK(event), () => setOpen(!open))

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((value) => (results.length ? (value + 1) % results.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((value) => (results.length ? (value - 1 + results.length) % results.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      results[cursor]?.run()
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, { command: Command; index: number }[]>()
    results.forEach((command, index) => {
      const bucket = map.get(command.group) ?? []
      bucket.push({ command, index })
      map.set(command.group, bucket)
    })
    return [...map.entries()]
  }, [results])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="fixed top-[12vh] left-1/2 z-[61] flex w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search for a page or action and press Enter to run it.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pages, actions and interviews…"
              aria-label="Command palette search"
              className="h-6 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
            <Kbd>esc</Kbd>
          </div>

          <div className="max-h-[22rem] overflow-y-auto p-2" data-lenis-prevent>
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nothing matches “{query}”.
              </p>
            ) : (
              grouped.map(([group, entries]) => (
                <div key={group} className="mb-1">
                  <p className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {group}
                  </p>
                  <ul>
                    {entries.map(({ command, index }) => (
                      <li key={command.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setCursor(index)}
                          onClick={() => command.run()}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors',
                            cursor === index ? 'bg-accent text-accent-foreground' : 'text-foreground/85',
                          )}
                        >
                          <command.icon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{command.label}</span>
                          {command.hint ? (
                            <span className="font-mono text-[10px] text-muted-foreground">{command.hint}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/30 px-4 py-2">
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <CommandIcon className="size-3" />
              command palette
            </span>
            <span className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                navigate
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <CornerDownLeft className="size-3" />
                run
              </span>
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Topbar affordance that opens the palette. */
export function CommandTrigger() {
  const setOpen = useUiStore((s) => s.setCommandOpen)
  const [mac, setMac] = useState(false)

  useEffect(() => {
    setMac(/mac|iphone|ipad/i.test(navigator.userAgent))
  }, [])

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="hidden items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:inline-flex dark:bg-input/30"
      aria-label="Open command palette"
    >
      <Search className="size-3.5" />
      Search
      <kbd className="rounded border border-border bg-secondary/60 px-1 py-0.5 text-[10px]">
        {mac ? '⌘' : 'Ctrl'} K
      </kbd>
    </button>
  )
}
