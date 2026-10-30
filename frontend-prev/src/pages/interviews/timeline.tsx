import { useParams } from 'react-router-dom'
import {
  Award,
  Brain,
  Code2,
  CornerDownRight,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import type { TimelineEvent, TimelineEventType } from '@/lib/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import {
  DetailSkeleton,
  InterviewHeader,
  InterviewNotFound,
  useInterview,
} from './shared'

const EVENT_META: Record<
  TimelineEventType,
  { icon: typeof Plus; cls: string }
> = {
  created: { icon: Plus, cls: 'bg-primary/10 text-primary ring-primary/25' },
  started: { icon: Play, cls: 'bg-primary/10 text-primary ring-primary/25' },
  question_delivered: { icon: Sparkles, cls: 'bg-primary/10 text-primary ring-primary/25' },
  answer_submitted: {
    icon: Send,
    cls: 'bg-[var(--signal-good)]/10 text-[var(--signal-good)] ring-[var(--signal-good)]/30',
  },
  evaluation_completed: {
    icon: Brain,
    cls: 'bg-[var(--signal-strong)]/10 text-[var(--signal-strong)] ring-[var(--signal-strong)]/30',
  },
  difficulty_changed: {
    icon: TrendingUp,
    cls: 'bg-[var(--signal-vague)]/10 text-[var(--signal-vague)] ring-[var(--signal-vague)]/30',
  },
  topic_changed: {
    icon: Layers,
    cls: 'bg-[var(--signal-vague)]/10 text-[var(--signal-vague)] ring-[var(--signal-vague)]/30',
  },
  followup_generated: {
    icon: CornerDownRight,
    cls: 'bg-[var(--signal-vague)]/10 text-[var(--signal-vague)] ring-[var(--signal-vague)]/30',
  },
  code_submitted: { icon: Code2, cls: 'bg-primary/10 text-primary ring-primary/25' },
  resumed: { icon: RotateCcw, cls: 'bg-primary/10 text-primary ring-primary/25' },
  cancelled: {
    icon: X,
    cls: 'bg-[var(--signal-weak)]/10 text-[var(--signal-weak)] ring-[var(--signal-weak)]/30',
  },
  completed: {
    icon: Award,
    cls: 'bg-[var(--signal-strong)]/10 text-[var(--signal-strong)] ring-[var(--signal-strong)]/30',
  },
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export function InterviewTimelinePage() {
  const { id } = useParams()
  const { interview, loading } = useInterview(id)
  const [events, setEvents] = useState<TimelineEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    api.getHistory(id).then((ev) => {
      if (alive) setEvents(ev)
    }).catch(() => {
      if (alive) {
        setEvents([])
        setError('Unable to load interview history.')
      }
    })
    return () => {
      alive = false
    }
  }, [id])

  if (loading || !events) {
    return (
      <AppShell title="Event Timeline">
        <DetailSkeleton />
      </AppShell>
    )
  }
  if (error) {
    return <AppShell title="Event Timeline"><p className="p-6 text-sm text-destructive">{error}</p></AppShell>
  }
  if (!interview) {
    return (
      <AppShell title="Event Timeline">
        <InterviewNotFound />
      </AppShell>
    )
  }

  return (
    <AppShell title="Event Timeline">
      <div className="animate-slide-up mx-auto flex max-w-5xl flex-col gap-5">
        <InterviewHeader interview={interview} active="history" />

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">What happened in this interview</h2>
            <span className="font-mono text-[11px] text-muted-foreground">
              {events.length} events
            </span>
          </div>

          <ol className="relative mt-6 flex flex-col gap-4">
            <span
              aria-hidden="true"
              className="absolute bottom-4 left-4.25 top-4 w-px bg-border"
            />
            {events.map((e) => {
              const meta = EVENT_META[e.type]
              const Icon = meta.icon
              return (
                <li key={e.id} className="relative flex gap-4">
                  <span
                    className={cn(
                      'relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full bg-card ring-1',
                      meta.cls,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl border border-border bg-background/50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{e.label}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {fmtDateTime(e.at)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {e.detail}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </AppShell>
  )
}