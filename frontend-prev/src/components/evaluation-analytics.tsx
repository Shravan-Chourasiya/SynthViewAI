import { useEffect, useRef, useState } from 'react'
import { Section } from '@/components/section'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { cn } from '@/lib/utils'

const metrics = [
  { label: 'Overall Performance', value: 82 },
  { label: 'Technical Accuracy', value: 88 },
  { label: 'Relevance', value: 79 },
  { label: 'Depth', value: 71 },
  { label: 'Communication', value: 90 },
]

const topics = [
  { label: 'Data Structures', value: 86 },
  { label: 'Algorithms', value: 80 },
  { label: 'System Design', value: 64 },
  { label: 'Communication', value: 90 },
]

const signals = [
  { label: 'Strong', tone: 'strong', desc: 'Raises difficulty' },
  { label: 'Weak', tone: 'weak', desc: 'Eases the next question' },
  { label: 'Vague', tone: 'vague', desc: 'Triggers a probe' },
  { label: 'Incomplete', tone: 'vague', desc: 'Adds a follow-up' },
] as const

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  return { ref, inView }
}

function MetricBar({
  label,
  value,
  inView,
  delay,
}: {
  label: string
  value: number
  inView: boolean
  delay: number
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {value}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out"
          style={{
            width: inView ? `${value}%` : '0%',
            transitionDelay: `${delay}ms`,
          }}
        />
      </div>
    </div>
  )
}

const toneDot: Record<string, string> = {
  strong: 'bg-[var(--signal-strong)] text-[var(--signal-strong)]',
  weak: 'bg-[var(--signal-weak)] text-[var(--signal-weak)]',
  vague: 'bg-[var(--signal-vague)] text-[var(--signal-vague)]',
}

export function EvaluationAnalytics() {
  const { ref, inView } = useInView<HTMLDivElement>()

  return (
    <Section id="reports" bordered>
      <SectionHeading
        eyebrow="Evaluation"
        title="Measured on more than a single score"
        description="SynthView scores every dimension of your performance — and those same signals steer the interview in real time."
      />
      <div ref={ref} className="mt-12 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold">Performance metrics</h3>
            <div className="mt-5 flex flex-col gap-4">
              {metrics.map((m, i) => (
                <MetricBar
                  key={m.label}
                  label={m.label}
                  value={m.value}
                  inView={inView}
                  delay={i * 120}
                />
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="flex h-full flex-col gap-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold">Topic performance</h3>
              <div className="mt-5 grid grid-cols-2 gap-4">
                {topics.map((t, i) => (
                  <MetricBar
                    key={t.label}
                    label={t.label}
                    value={t.value}
                    inView={inView}
                    delay={i * 120 + 200}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold">
                Qualitative signals
                <span className="ml-2 font-normal text-muted-foreground">
                  — these change the interview
                </span>
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {signals.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-background/50 px-3 py-2.5"
                  >
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        toneDot[s.tone].split(' ')[0],
                      )}
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-xs font-medium',
                          toneDot[s.tone].split(' ')[1],
                        )}
                      >
                        {s.label}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}