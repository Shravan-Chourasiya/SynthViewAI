import { useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Search,
  CornerDownRight,
  ArrowRight,
  CircleSlash,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'strong' | 'weak' | 'vague' | 'good'

interface Path {
  id: string
  answer: string
  signal: string
  decision: string
  next: string
  tone: Tone
  icon: LucideIcon
}

const paths: Path[] = [
  {
    id: 'strong',
    answer: 'Strong answer',
    signal: 'Strong understanding',
    decision: 'Increase difficulty',
    next: 'A harder, deeper question on the same topic',
    tone: 'strong',
    icon: TrendingUp,
  },
  {
    id: 'weak',
    answer: 'Weak answer',
    signal: 'Gaps detected',
    decision: 'Provide an easier question',
    next: 'A more approachable question to rebuild footing',
    tone: 'weak',
    icon: TrendingDown,
  },
  {
    id: 'vague',
    answer: 'Vague answer',
    signal: 'Lacks specifics',
    decision: 'Probe deeper',
    next: '“Can you be more concrete about the trade-offs?”',
    tone: 'vague',
    icon: Search,
  },
  {
    id: 'incomplete',
    answer: 'Incomplete answer',
    signal: 'Partial coverage',
    decision: 'Follow up',
    next: 'A targeted follow-up on the missing piece',
    tone: 'vague',
    icon: CornerDownRight,
  },
  {
    id: 'sufficient',
    answer: 'Sufficient answer',
    signal: 'Requirement met',
    decision: 'Move to next topic',
    next: 'A fresh question from the next competency area',
    tone: 'good',
    icon: ArrowRight,
  },
  {
    id: 'poor-streak',
    answer: 'Sustained poor performance',
    signal: 'Low performance trend',
    decision: 'End interview early',
    next: 'Wrap up gracefully and generate a report',
    tone: 'weak',
    icon: CircleSlash,
  },
]

const toneClasses: Record<
  Tone,
  { text: string; bg: string; ring: string; dot: string; border: string }
> = {
  strong: {
    text: 'text-[var(--signal-strong)]',
    bg: 'bg-[var(--signal-strong)]/10',
    ring: 'ring-[var(--signal-strong)]/40',
    dot: 'bg-[var(--signal-strong)]',
    border: 'border-[var(--signal-strong)]/40',
  },
  good: {
    text: 'text-[var(--signal-good)]',
    bg: 'bg-[var(--signal-good)]/10',
    ring: 'ring-[var(--signal-good)]/40',
    dot: 'bg-[var(--signal-good)]',
    border: 'border-[var(--signal-good)]/40',
  },
  vague: {
    text: 'text-[var(--signal-vague)]',
    bg: 'bg-[var(--signal-vague)]/10',
    ring: 'ring-[var(--signal-vague)]/40',
    dot: 'bg-[var(--signal-vague)]',
    border: 'border-[var(--signal-vague)]/40',
  },
  weak: {
    text: 'text-[var(--signal-weak)]',
    bg: 'bg-[var(--signal-weak)]/10',
    ring: 'ring-[var(--signal-weak)]/40',
    dot: 'bg-[var(--signal-weak)]',
    border: 'border-[var(--signal-weak)]/40',
  },
}

const steps = [
  'Candidate Answer',
  'AI Evaluation',
  'Performance Signal',
  'Adaptive Decision',
  'Next Interaction',
]

export function AdaptiveFlow() {
  const [active, setActive] = useState(0)
  const path = paths[active]
  const tone = toneClasses[path.tone]

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-8">
      {/* answer selector */}
      <div className="flex flex-col gap-2">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Pick an answer quality
        </p>
        {paths.map((p, i) => {
          const t = toneClasses[p.tone]
          const isActive = i === active
          const Icon = p.icon
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActive(i)}
              className={cn(
                'group flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200',
                isActive
                  ? cn('bg-card', t.border)
                  : 'border-border bg-card/40 hover:bg-card',
              )}
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors',
                  isActive ? cn(t.bg, t.ring) : 'bg-secondary ring-border',
                )}
              >
                <Icon
                  className={cn(
                    'size-4',
                    isActive
                      ? cn(t.text, 'animate-slide-in-left')
                      : 'text-muted-foreground',
                  )}
                />
              </span>
              <span
                className={cn(
                  'text-sm font-medium transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {p.answer}
              </span>
            </button>
          )
        })}
      </div>

      {/* flow pipeline */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => {
            const value =
              i === 0
                ? path.answer
                : i === 1
                  ? 'Analyzing response quality…'
                  : i === 2
                    ? path.signal
                    : i === 3
                      ? path.decision
                      : path.next
            const isSignal = i === 2
            const isDecision = i === 3
            const highlight = isSignal || isDecision
            return (
              <li key={step} className="relative flex gap-4">
                {/* connector */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ring-1',
                      highlight
                        ? cn(tone.bg, tone.ring, tone.text)
                        : 'bg-secondary text-muted-foreground ring-border',
                    )}
                  >
                    {i + 1}
                  </span>
                  {i < steps.length - 1 ? (
                    <span className="my-1 w-px flex-1 bg-border" />
                  ) : null}
                </div>
                <div className="flex-1 pb-1">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {step}
                  </p>
                  <div
                    key={`${path.id}-${i}`}
                    className={cn(
                      'animate-reveal mt-1 rounded-lg border px-3.5 py-2.5 text-sm',
                      highlight
                        ? cn(tone.bg, tone.border, 'font-medium', tone.text)
                        : 'border-border bg-background/50 text-foreground',
                    )}
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    {value}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}