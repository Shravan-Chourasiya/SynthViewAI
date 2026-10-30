import { useEffect, useMemo, useState } from 'react'
import { Radio, Sparkles, TrendingDown, TrendingUp, Volume2 } from 'lucide-react'
import { SignalBadge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SignalBand } from '@/lib/types'
import { formatClock } from '@/lib/format'

type Phase = 'answering' | 'processing' | 'evaluated' | 'adapting'

const PHASE_DURATION: Record<Phase, number> = {
  answering: 3200,
  processing: 1800,
  evaluated: 2600,
  adapting: 2000,
}

const PHASE_ORDER: Phase[] = ['answering', 'processing', 'evaluated', 'adapting']

const TURNS: {
  question: string
  answer: string
  signal: string
  band: SignalBand
  score: number
  decision: string
  trend: 'up' | 'down'
}[] = [
  {
    question: 'How would you design a caching layer for a read-heavy feed?',
    answer:
      'Short TTL in front of the read path, keyed on the access pattern, plus a single-flight lock so a cold key does not stampede the primary.',
    signal: 'Strong technical understanding',
    band: 'strong',
    score: 86,
    decision: 'Difficulty increased',
    trend: 'up',
  },
  {
    question: 'You inherit a queue that is backing up under load. First hour?',
    answer:
      'Measure consumer lag, then check for a poison message before scaling out — scaling a slow consumer just moves the backlog.',
    signal: 'Solid, but light on trade-offs',
    band: 'good',
    score: 74,
    decision: 'Probing deeper',
    trend: 'up',
  },
  {
    question: 'How would you shard a table that has outgrown one primary?',
    answer:
      'Shard by tenant so the hot key problem stays contained, then move the read-heavy analytics path to a replica.',
    signal: 'Vague — needs specifics',
    band: 'vague',
    score: 61,
    decision: 'Easier follow-up',
    trend: 'down',
  },
]

const PHASE_LABEL: Record<Phase, string> = {
  answering: 'Candidate speaking',
  processing: 'Evaluating answer',
  evaluated: 'Signal recorded',
  adapting: 'Adapting next question',
}

export function InterviewDemo({ className }: { className?: string }) {
  const [turn, setTurn] = useState(0)
  const [phase, setPhase] = useState<Phase>('answering')
  const [elapsed, setElapsed] = useState(294)

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (phase === 'adapting') {
      const id = window.setTimeout(() => {
        setTurn((t) => (t + 1) % TURNS.length)
        setPhase('answering')
      }, PHASE_DURATION.adapting)
      return () => window.clearTimeout(id)
    }
    const next = PHASE_ORDER[PHASE_ORDER.indexOf(phase) + 1]
    if (!next) return
    const id = window.setTimeout(() => setPhase(next), PHASE_DURATION[phase])
    return () => window.clearTimeout(id)
  }, [phase])

  const current = TURNS[turn]!
  const showAnswer = phase !== 'answering' || true
  const answered = phase === 'processing' || phase === 'evaluated' || phase === 'adapting'

  const dots = useMemo(() => [0, 1, 2], [])

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/40',
        className,
      )}
    >
      {/* window chrome */}
      <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-destructive/50" />
          <span className="size-2.5 rounded-full bg-signal-vague/50" />
          <span className="size-2.5 rounded-full bg-signal-strong/50" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">Technical Interview</p>
          <p className="font-mono text-[10px] text-muted-foreground">Session #SV-2941</p>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-signal-weak">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal-weak opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-signal-weak" />
          </span>
          Live
        </span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{formatClock(elapsed)}</span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* AI question */}
        <div className="flex gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/25">
            <Sparkles className="size-3.5 text-primary" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Interviewer · Q{turn + 1}/8
            </p>
            <div className="rounded-xl rounded-tl-sm border border-border bg-secondary/40 px-3.5 py-2.5 text-sm leading-relaxed">
              {current.question}
            </div>
          </div>
        </div>

        {/* candidate answer */}
        <div className="flex justify-end gap-3">
          <div className="min-w-0 max-w-[85%] space-y-1">
            <p className="text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              You
            </p>
            {showAnswer && answered ? (
              <div className="rounded-xl rounded-tr-sm border border-primary/25 bg-primary/10 px-3.5 py-2.5 text-sm leading-relaxed">
                {current.answer}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl rounded-tr-sm border border-primary/25 bg-primary/10 px-3.5 py-3">
                <Volume2 className="size-3.5 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-primary">speaking…</span>
                <span className="flex items-end gap-0.5" aria-hidden>
                  {dots.map((d) => (
                    <span
                      key={d}
                      className="h-3 w-0.5 animate-typing-bar rounded-full bg-primary"
                      style={{ animationDelay: `${d * 140}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* evaluation row */}
        <div className="rounded-xl border border-border bg-background/60 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {PHASE_LABEL[phase]}
            </span>
            {phase === 'processing' ? (
              <span className="flex items-end gap-0.5" aria-hidden>
                {dots.map((d) => (
                  <span
                    key={d}
                    className="h-2.5 w-0.5 animate-typing-bar rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${d * 160}ms` }}
                  />
                ))}
              </span>
            ) : null}
          </div>

          <div
            className={cn(
              'mt-3 space-y-3 transition-opacity duration-300',
              phase === 'evaluated' || phase === 'adapting' ? 'opacity-100' : 'opacity-40',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <SignalBadge band={current.band}>{current.signal}</SignalBadge>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {current.score}/100
              </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-700 ease-out',
                  current.band === 'strong' && 'bg-signal-strong',
                  current.band === 'good' && 'bg-signal-good',
                  current.band === 'vague' && 'bg-signal-vague',
                  current.band === 'weak' && 'bg-signal-weak',
                )}
                style={{ width: `${current.score}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <Radio className="size-3" />
                Adaptive engine
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider',
                  current.trend === 'up' ? 'text-primary' : 'text-signal-vague',
                )}
              >
                {current.trend === 'up' ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {current.decision}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
