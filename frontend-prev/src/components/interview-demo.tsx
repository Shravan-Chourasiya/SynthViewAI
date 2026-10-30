import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Cpu,
  Signal,
  ArrowUpRight,
  Check,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Phase = 'answering' | 'processing' | 'evaluated' | 'adapting'

interface Turn {
  question: string
  answer: string
  signal: string
  signalTone: 'strong' | 'good' | 'vague' | 'weak'
  score: number
  difficulty: 'Warm-up' | 'Core' | 'Advanced' | 'Expert'
  decision: string
}

const turns: Turn[] = [
  {
    question: 'Walk me through how you would design a URL shortening service.',
    answer:
      'I would use a base62-encoded key over an auto-increment ID, cache hot links in Redis, and shard the datastore by key range...',
    signal: 'Strong technical understanding',
    signalTone: 'strong',
    score: 86,
    difficulty: 'Advanced',
    decision: 'Difficulty increased',
  },
  {
    question:
      'How would you prevent a single region from becoming a bottleneck?',
    answer:
      'Route reads to the nearest edge with geo-DNS, replicate asynchronously, and keep writes in a home region with a fallback...',
    signal: 'Solid, but light on trade-offs',
    signalTone: 'good',
    score: 78,
    difficulty: 'Advanced',
    decision: 'Probing deeper',
  },
  {
    question: 'What happens when your async replica falls behind?',
    answer: 'Um, I think it just catches up eventually on its own...',
    signal: 'Vague — needs specifics',
    signalTone: 'vague',
    score: 61,
    difficulty: 'Core',
    decision: 'Easier follow-up',
  },
]

const toneMap: Record<
  Turn['signalTone'],
  { text: string; bg: string; ring: string; dot: string }
> = {
  strong: {
    text: 'text-[var(--signal-strong)]',
    bg: 'bg-[var(--signal-strong)]/10',
    ring: 'ring-[var(--signal-strong)]/30',
    dot: 'bg-[var(--signal-strong)]',
  },
  good: {
    text: 'text-[var(--signal-good)]',
    bg: 'bg-[var(--signal-good)]/10',
    ring: 'ring-[var(--signal-good)]/30',
    dot: 'bg-[var(--signal-good)]',
  },
  vague: {
    text: 'text-[var(--signal-vague)]',
    bg: 'bg-[var(--signal-vague)]/10',
    ring: 'ring-[var(--signal-vague)]/30',
    dot: 'bg-[var(--signal-vague)]',
  },
  weak: {
    text: 'text-[var(--signal-weak)]',
    bg: 'bg-[var(--signal-weak)]/10',
    ring: 'ring-[var(--signal-weak)]/30',
    dot: 'bg-[var(--signal-weak)]',
  },
}

const phaseLabel: Record<Phase, string> = {
  answering: 'Listening to candidate',
  processing: 'Evaluating answer',
  evaluated: 'Answer evaluated',
  adapting: 'Preparing next question',
}

export function InterviewDemo({ className }: { className?: string }) {
  const [turnIndex, setTurnIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('answering')
  const [seconds, setSeconds] = useState(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const turn = turns[turnIndex]
  const tone = toneMap[turn.signalTone]

  // phase state machine
  useEffect(() => {
    const durations: Record<Phase, number> = {
      answering: 3200,
      processing: 1800,
      evaluated: 2600,
      adapting: 2000,
    }
    timeoutRef.current = setTimeout(() => {
      setPhase((prev) => {
        if (prev === 'answering') return 'processing'
        if (prev === 'processing') return 'evaluated'
        if (prev === 'evaluated') return 'adapting'
        setTurnIndex((i) => (i + 1) % turns.length)
        return 'answering'
      })
    }, durations[phase])
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [phase])

  // interview timer
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  const showAnswer = phase !== 'answering'
  const showEval = phase === 'evaluated' || phase === 'adapting'
  const questionNumber = turnIndex + 1

  return (
    <div
      className={cn(
        'animate-scale-in relative w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/40',
        className,
      )}
      style={{ animationDelay: '400ms', animationFillMode: 'both' }}
    >
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Activity className="size-3.5 text-primary" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <p className="text-xs font-medium">Technical Interview</p>
            <p className="font-mono text-[10px] text-muted-foreground">
              Session #SV-2941
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <Signal className="size-3.5 text-[var(--signal-strong)]" />
            Live
          </span>
          <span className="rounded-md bg-background px-2 py-1 font-mono text-[11px] tabular-nums text-foreground">
            {mm}:{ss}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {/* AI question */}
        <div className="flex gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
            <Sparkles className="size-3.5 text-primary" />
          </span>
          <div className="flex-1">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              AI Interviewer · Q{questionNumber}
            </p>
            <div
              key={`q-${turnIndex}`}
              className="animate-reveal rounded-lg rounded-tl-sm border border-border bg-background/60 px-3.5 py-2.5 text-sm leading-relaxed text-pretty"
            >
              {turn.question}
            </div>
          </div>
        </div>

        {/* Candidate answer */}
        <div className="flex flex-row-reverse gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-foreground ring-1 ring-border">
            You
          </span>
          <div className="flex-1 text-right">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Candidate
            </p>
            <div className="inline-block max-w-full rounded-lg rounded-tr-sm bg-primary/10 px-3.5 py-2.5 text-left text-sm leading-relaxed ring-1 ring-primary/20">
              {showAnswer ? (
                <span key={`a-${turnIndex}`} className="animate-reveal block">
                  {turn.answer}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 py-0.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 rounded-full bg-primary"
                      style={{
                        animation: 'pulse-dot 1s ease-in-out infinite',
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                  <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                    speaking…
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Evaluation panel */}
        <div
          className={cn(
            'grid grid-cols-1 gap-2 transition-all duration-500 sm:grid-cols-2',
            showEval
              ? 'opacity-100'
              : 'pointer-events-none max-h-0 -translate-y-1 opacity-0',
          )}
        >
          {showEval ? (
            <>
              <div
                key={`s-${turnIndex}`}
                className={cn(
                  'animate-reveal flex items-center gap-2 rounded-lg px-3 py-2.5 ring-1',
                  tone.bg,
                  tone.ring,
                )}
              >
                <span className={cn('size-2 rounded-full', tone.dot)} />
                <span className={cn('text-xs font-medium', tone.text)}>
                  {turn.signal}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Score
                </span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700 ease-out"
                    style={{ width: `${turn.score}%` }}
                  />
                </div>
                <span className="font-mono text-xs tabular-nums text-foreground">
                  {turn.score}
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* processing / adapting status strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {phase === 'processing' ? (
              <Cpu
                className="size-3.5 text-primary"
                style={{ animation: 'pulse-dot 1.1s ease-in-out infinite' }}
              />
            ) : phase === 'adapting' ? (
              <ArrowUpRight className="size-3.5 text-primary" />
            ) : phase === 'evaluated' ? (
              <Check className="size-3.5 text-[var(--signal-strong)]" />
            ) : (
              <span
                className="size-2 rounded-full bg-primary"
                style={{ animation: 'pulse-dot 1.2s ease-in-out infinite' }}
              />
            )}
            <span key={phase} className="animate-fade-in font-mono text-[11px]">
              {phaseLabel[phase]}
            </span>
          </span>
          <span
            key={`d-${turnIndex}-${phase}`}
            className={cn(
              'flex items-center gap-1.5 rounded-md bg-background px-2 py-1 font-mono text-[11px]',
              phase === 'adapting'
                ? 'animate-reveal text-primary ring-1 ring-primary/30'
                : 'text-muted-foreground',
            )}
          >
            {phase === 'adapting' ? (
              <>
                <ArrowUpRight className="size-3" />
                {turn.decision}
              </>
            ) : (
              <>Difficulty · {turn.difficulty}</>
            )}
          </span>
        </div>

        {/* difficulty progression track */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Progression
          </span>
          <div className="flex flex-1 items-center gap-1.5">
            {(['Warm-up', 'Core', 'Advanced', 'Expert'] as const).map(
              (level) => {
                const order = ['Warm-up', 'Core', 'Advanced', 'Expert']
                const active =
                  order.indexOf(level) <= order.indexOf(turn.difficulty)
                return (
                  <div
                    key={level}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-500',
                      active ? 'bg-primary' : 'bg-secondary',
                    )}
                  />
                )
              },
            )}
          </div>
        </div>
      </div>
    </div>
  )
}