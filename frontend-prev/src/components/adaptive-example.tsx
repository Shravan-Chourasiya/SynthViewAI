import { useEffect, useRef, useState } from 'react'
import { RotateCcw, Sparkles, TrendingUp, ArrowDown } from 'lucide-react'
import { Section } from '@/components/section'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { cn } from '@/lib/utils'

interface Beat {
  kind: 'question' | 'answer' | 'eval' | 'decision' | 'next'
  render: React.ReactNode
}

const beats: Beat[] = [
  {
    kind: 'question',
    render: (
      <p className="text-sm leading-relaxed">
        How would you design a scalable URL shortening service?
      </p>
    ),
  },
  {
    kind: 'answer',
    render: (
      <p className="text-sm leading-relaxed">
        Base62 keys over a counter, Redis for hot links, and a datastore
        sharded by key range with async replication for reads.
      </p>
    ),
  },
  {
    kind: 'eval',
    render: (
      <span className="flex items-center gap-2 text-sm font-medium">
        <TrendingUp className="size-4" />
        Strong technical understanding
      </span>
    ),
  },
  {
    kind: 'decision',
    render: <span className="text-sm font-medium">Difficulty increased</span>,
  },
  {
    kind: 'next',
    render: (
      <p className="text-sm leading-relaxed">
        How would you handle high-volume redirects and prevent a single region
        from becoming a bottleneck?
      </p>
    ),
  },
]

export function AdaptiveExample() {
  const [visible, setVisible] = useState(0)
  const [started, setStarted] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const play = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setVisible(0)
    setStarted(true)
    beats.forEach((_, i) => {
      timers.current.push(setTimeout(() => setVisible(i + 1), 700 + i * 900))
    })
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  return (
    <Section bordered>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Adaptive intelligence"
            title={
              <>
                Every answer changes{' '}
                <span className="text-primary">what comes next.</span>
              </>
            }
            description="This isn't a claim — watch it happen. A strong answer earns a harder question. SynthView is always deciding where to take you next."
          />
          <Reveal delay={120}>
            <button
              type="button"
              onClick={play}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:scale-[1.03] hover:shadow-lg hover:shadow-primary/20 active:scale-95"
            >
              <RotateCcw className="size-4" />
              {started ? 'Replay adaptation' : 'Play adaptation'}
            </button>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            {!started ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/25">
                  <Sparkles className="size-5 text-primary" />
                </span>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Press play to watch a single strong answer reshape the
                  interview.
                </p>
              </div>
            ) : (
              <ol className="flex min-h-[360px] flex-col gap-3">
                {beats.map((beat, i) => {
                  if (i >= visible) return null
                  return (
                    <BeatRow key={i} kind={beat.kind}>
                      {beat.render}
                    </BeatRow>
                  )
                })}
                {visible > 0 && visible < beats.length ? (
                  <li className="flex items-center gap-1.5 pl-1 text-muted-foreground">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="size-1.5 rounded-full bg-primary"
                        style={{
                          animation: 'pulse-dot 1s ease-in-out infinite',
                          animationDelay: `${d * 0.15}s`,
                        }}
                      />
                    ))}
                  </li>
                ) : visible === beats.length ? (
                  <li className="animate-reveal flex items-center gap-2 rounded-lg border border-[var(--signal-strong)]/30 bg-[var(--signal-strong)]/10 px-3.5 py-2.5">
                    <span className="size-2 rounded-full bg-[var(--signal-strong)]" />
                    <span className="text-xs font-medium text-[var(--signal-strong)]">
                      Adaptation complete
                    </span>
                  </li>
                ) : null}
              </ol>
            )}
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

function BeatRow({
  kind,
  children,
}: {
  kind: Beat['kind']
  children: React.ReactNode
}) {
  if (kind === 'question' || kind === 'next') {
    const isNext = kind === 'next'
    return (
      <li className="animate-reveal">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {isNext ? 'Next question' : 'AI Interviewer'}
        </p>
        <div
          className={cn(
            'flex gap-3 rounded-xl border px-4 py-3',
            isNext
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-background/50',
          )}
        >
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          {children}
        </div>
      </li>
    )
  }
  if (kind === 'answer') {
    return (
      <li className="animate-reveal">
        <p className="mb-1 text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Candidate
        </p>
        <div className="ml-auto max-w-[92%] rounded-xl bg-primary/10 px-4 py-3 ring-1 ring-primary/20">
          {children}
        </div>
      </li>
    )
  }
  if (kind === 'eval') {
    return (
      <li className="animate-reveal flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-[var(--signal-strong)]/10 px-3.5 py-2 text-[var(--signal-strong)] ring-1 ring-[var(--signal-strong)]/30">
          {children}
        </div>
      </li>
    )
  }
  // decision
  return (
    <li className="animate-reveal flex items-center gap-2 pl-1">
      <ArrowDown className="size-4 text-primary" />
      <span className="rounded-lg bg-primary/15 px-3.5 py-2 text-primary ring-1 ring-primary/30">
        {children}
      </span>
    </li>
  )
}