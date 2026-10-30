import { Play, CheckCircle2, type LucideIcon } from 'lucide-react'
import { Section } from '@/components/section'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { cn } from '@/lib/utils'

interface Entry {
  type: string
  date: string
  score: number | null
  status: 'Completed' | 'In Progress'
}

const entries: Entry[] = [
  { type: 'Technical Interview', date: 'Mar 4', score: 82, status: 'Completed' },
  {
    type: 'Behavioral Interview',
    date: 'Mar 1',
    score: 88,
    status: 'Completed',
  },
  {
    type: 'Mixed Interview',
    date: 'Today',
    score: null,
    status: 'In Progress',
  },
  {
    type: 'System Design Interview',
    date: 'Feb 24',
    score: 75,
    status: 'Completed',
  },
]

const statusMeta: Record<
  Entry['status'],
  { icon: LucideIcon; text: string; bg: string }
> = {
  Completed: {
    icon: CheckCircle2,
    text: 'text-[var(--signal-strong)]',
    bg: 'bg-[var(--signal-strong)]/10 ring-[var(--signal-strong)]/25',
  },
  'In Progress': {
    icon: Play,
    text: 'text-primary',
    bg: 'bg-primary/10 ring-primary/25',
  },
}

export function InterviewHistory() {
  return (
    <Section bordered>
      <SectionHeading
        eyebrow="Your dashboard"
        title="Pick up right where you left off"
        description="Track every session in one place. Interrupted interviews aren't lost — resume them exactly where they stopped."
      />
      <Reveal delay={120} className="mx-auto mt-12 max-w-3xl">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-3">
            <p className="text-sm font-medium">Recent interviews</p>
            <span className="font-mono text-[11px] text-muted-foreground">
              4 sessions
            </span>
          </div>
          <ul className="divide-y divide-border">
            {entries.map((e, i) => {
              const meta = statusMeta[e.status]
              const Icon = meta.icon
              const inProgress = e.status === 'In Progress'
              return (
                <li
                  key={e.type}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
                      meta.bg,
                    )}
                  >
                    <Icon className={cn('size-4', meta.text)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.type}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {e.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {e.score !== null ? (
                      <span className="font-mono text-sm tabular-nums text-foreground">
                        {e.score}
                        <span className="text-muted-foreground">/100</span>
                      </span>
                    ) : (
                      <span className="font-mono text-sm text-muted-foreground">
                        —
                      </span>
                    )}
                    {inProgress ? (
                      <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-transform hover:scale-[1.03]">
                        <Play className="size-3" fill="currentColor" />
                        Resume
                      </button>
                    ) : (
                      <span
                        className={cn(
                          'rounded-md px-2.5 py-1 text-[11px] font-medium ring-1',
                          meta.bg,
                          meta.text,
                        )}
                      >
                        {e.status}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </Reveal>
    </Section>
  )
}