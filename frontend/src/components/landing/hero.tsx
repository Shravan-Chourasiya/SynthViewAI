import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Play } from 'lucide-react'
import { gsap } from '@/lib/gsap'
import { useMotion } from '@/components/motion-context'
import { Section } from '@/components/section'
import { Reveal } from '@/components/reveal'
import { InterviewDemo } from './interview-demo'
import { NeuralField } from '@/components/neural-field'
import { SplitText } from '@/components/motion/split-text'
import { Magnetic } from '@/components/motion/magnetic'
import { TiltCard } from '@/components/motion/tilt-card'
import { Parallax } from '@/components/motion/parallax'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATS = [
  { title: 'Real-time', body: 'answer evaluation' },
  { title: 'Adaptive', body: 'difficulty & path' },
  { title: 'Resumable', body: 'interrupted sessions' },
]

export function Hero() {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const { resolvedMotion } = useMotion()
  const reduced = resolvedMotion === 'reduced'

  // The hero drifts up and dims as it leaves, so the next section reads as
  // arriving over it rather than following it.
  useLayoutEffect(() => {
    const node = gridRef.current
    if (!node || reduced) return
    const ctx = gsap.context(() => {
      gsap.to(node, {
        yPercent: -7,
        opacity: 0.55,
        ease: 'none',
        scrollTrigger: { trigger: node, start: 'top 18%', end: 'bottom top', scrub: 0.4 },
      })
    }, node)
    return () => ctx.revert()
  }, [reduced])

  return (
    <Section id="top" className="relative overflow-hidden pt-14 sm:pt-16 lg:pt-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-80" />

      {/* rotating 3D point cloud, drifting against the scroll */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
        <Parallax distance={120} className="size-full">
          <NeuralField nodes={86} />
        </Parallax>
      </div>

      {/* aurora light */}
      <div
        aria-hidden
        className="sv-aurora pointer-events-none absolute inset-x-0 top-0 h-[36rem] animate-aurora opacity-45"
      />

      <div ref={gridRef} className="relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div className="min-w-0 max-w-xl">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 backdrop-blur">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Adaptive AI interviewer
              </span>
            </span>
          </Reveal>

          <h1 className="mt-6 text-4xl leading-[1.08] font-semibold tracking-tight text-balance [perspective:1000px] sm:text-5xl lg:text-6xl">
            <SplitText text="An AI interview that" accent="adapts to you." delay={120} />
          </h1>

          <Reveal delay={420}>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
              SynthView AI listens to your answer, scores it honestly, then picks the next question based on
              what you actually said. Not a questionnaire — a conversation that gets harder where you are
              strong.
            </p>
          </Reveal>

          <Reveal delay={500}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Magnetic strength={0.3}>
                <Link to="/register" className={cn(buttonVariants({ size: 'lg' }), 'sv-sheen relative h-11 px-6 text-sm')}>
                  Start an Interview
                  <ArrowRight className="size-4" />
                </Link>
              </Magnetic>
              <Magnetic strength={0.22}>
                <a
                  href="#how-it-works"
                  className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 px-6 text-sm')}
                >
                  <Play className="size-4" />
                  See How It Works
                </a>
              </Magnetic>
            </div>
          </Reveal>

          <Reveal delay={560} staggerSelector="[data-stat]" stagger={90}>
            <dl className="mt-12 grid grid-cols-1 gap-px border-t border-border pt-6 sm:grid-cols-3">
              {STATS.map((stat) => (
                <div key={stat.title} data-stat className="py-2 sm:py-0">
                  <dt className="text-sm font-semibold tracking-tight">{stat.title}</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">{stat.body}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <Parallax distance={-64} className="relative min-w-0">
          <Reveal delay={200} className="relative min-w-0">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 -z-10 animate-glow-pulse rounded-[2.5rem] bg-primary/20 blur-3xl"
            />
            <TiltCard max={7} lift={18} className="rounded-2xl">
              <InterviewDemo />
            </TiltCard>
          </Reveal>
        </Parallax>
      </div>
    </Section>
  )
}
