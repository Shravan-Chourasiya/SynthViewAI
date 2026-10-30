import { useState } from 'react'
import {
  Mic,
  Video,
  PhoneOff,
  Sparkles,
  Loader2,
  WifiOff,
  CheckCircle2,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import { Section } from '@/components/section'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { cn } from '@/lib/utils'

type StateId =
  | 'waiting'
  | 'processing'
  | 'preparing'
  | 'reconnecting'
  | 'completed'

interface StatusState {
  id: StateId
  label: string
  banner: string
  icon: LucideIcon
  tone: 'primary' | 'strong' | 'vague'
  spin?: boolean
}

const states: StatusState[] = [
  {
    id: 'waiting',
    label: 'Waiting for response',
    banner: 'Waiting for candidate response',
    icon: Mic,
    tone: 'primary',
  },
  {
    id: 'processing',
    label: 'Processing answer',
    banner: 'Processing your answer',
    icon: Loader2,
    tone: 'primary',
    spin: true,
  },
  {
    id: 'preparing',
    label: 'Preparing next',
    banner: 'Preparing your next question',
    icon: Sparkles,
    tone: 'primary',
  },
  {
    id: 'reconnecting',
    label: 'Reconnecting',
    banner: 'Connection dropped — reconnecting, your progress is safe',
    icon: WifiOff,
    tone: 'vague',
  },
  {
    id: 'completed',
    label: 'Completed',
    banner: 'Interview completed — generating your report',
    icon: CheckCircle2,
    tone: 'strong',
  },
]

const toneText: Record<StatusState['tone'], string> = {
  primary: 'text-primary',
  strong: 'text-[var(--signal-strong)]',
  vague: 'text-[var(--signal-vague)]',
}

const toneBg: Record<StatusState['tone'], string> = {
  primary: 'bg-primary/10 ring-primary/25',
  strong: 'bg-[var(--signal-strong)]/10 ring-[var(--signal-strong)]/25',
  vague: 'bg-[var(--signal-vague)]/10 ring-[var(--signal-vague)]/25',
}

export function LiveExperience() {
  const [active, setActive] = useState<StateId>('waiting')
  const state = states.find((s) => s.id === active) ?? states[0]
  const Icon = state.icon

  return (
    <Section bordered>
      <SectionHeading
        eyebrow="Live experience"
        title="A real interview, not a quiz"
        description="SynthView feels like a professional video interview — and you always know exactly what's happening at every moment."
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/30">
            {/* status banner */}
            <div
              className={cn(
                'flex items-center gap-2.5 border-b border-border px-5 py-3 ring-inset',
                toneBg[state.tone],
              )}
            >
              <Icon
                className={cn(
                  'size-4',
                  toneText[state.tone],
                  state.spin && 'animate-spin',
                )}
              />
              <span
                key={state.id}
                className={cn(
                  'animate-reveal text-sm font-medium',
                  toneText[state.tone],
                )}
              >
                {state.banner}
              </span>
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <Clock className="size-3.5" />
                12:47
              </span>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-[1fr_180px]">
              {/* question / main */}
              <div className="flex flex-col">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Question 4 of 8 · Technical
                </p>
                <p className="mt-2 text-pretty text-[15px] font-medium leading-relaxed">
                  How would you keep read latency low for a globally
                  distributed user base?
                </p>
                {/* candidate response area */}
                <div className="mt-4 flex flex-1 items-center gap-3 rounded-xl border border-border bg-background/50 px-4 py-4">
                  {active === 'waiting' ? (
                    <div className="flex items-end gap-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className="w-1 origin-bottom rounded-full bg-primary"
                          style={{
                            height: 18,
                            animation: 'typing-bar 1s ease-in-out infinite',
                            animationDelay: `${i * 0.12}s`,
                          }}
                        />
                      ))}
                      <span className="ml-2 text-xs text-muted-foreground">
                        Listening…
                      </span>
                    </div>
                  ) : active === 'completed' ? (
                    <span className="text-xs text-muted-foreground">
                      All questions answered. Nice work.
                    </span>
                  ) : (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      “I'd push reads to regional replicas and use a CDN edge
                      cache with short TTLs, while keeping writes
                      centralized…”
                      <span
                        className="ml-0.5 inline-block h-3 w-px translate-y-0.5 bg-primary"
                        style={{ animation: 'caret 1s step-end infinite' }}
                      />
                    </p>
                  )}
                </div>
              </div>

              {/* candidate tile */}
              <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-secondary/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 rounded-md bg-background/70 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-[var(--signal-weak)]" />
                    REC
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-center py-4">
                  <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary ring-1 ring-primary/30">
                    JD
                  </span>
                </div>
                <p className="text-center font-mono text-[10px] text-muted-foreground">
                  You
                </p>
              </div>
            </div>

            {/* controls */}
            <div className="flex items-center justify-center gap-3 border-t border-border bg-secondary/30 px-5 py-3">
              <button
                aria-label="Toggle microphone"
                className="flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Mic className="size-4" />
              </button>
              <button
                aria-label="Toggle camera"
                className="flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Video className="size-4" />
              </button>
              <button
                aria-label="End interview"
                className="flex size-9 items-center justify-center rounded-full bg-[var(--signal-weak)]/15 text-[var(--signal-weak)] ring-1 ring-[var(--signal-weak)]/30 transition-colors hover:bg-[var(--signal-weak)]/25 focus-visible:ring-2 focus-visible:ring-[var(--signal-weak)]"
              >
                <PhoneOff className="size-4" />
              </button>
            </div>
          </div>
        </Reveal>

        {/* state switcher */}
        <Reveal delay={120}>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Try a state →
            </p>
            <div className="flex flex-col gap-1.5">
              {states.map((s) => {
                const SIcon = s.icon
                const isActive = s.id === active
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActive(s.id)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isActive
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent/50',
                    )}
                  >
                    <SIcon
                      className={cn(
                        'size-4',
                        isActive ? toneText[s.tone] : 'text-muted-foreground',
                      )}
                    />
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}