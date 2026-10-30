import { useNavigate } from 'react-router-dom'
import { ArrowRight, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/reveal'
import { InterviewDemo } from '@/components/interview-demo'

export function Hero() {
  const navigate = useNavigate()

  return (
    <section
      id="product"
      className="relative overflow-hidden pt-28 pb-16 sm:pt-32 lg:pt-36 lg:pb-24"
    >
      {/* subtle technical grid backdrop */}
      <div
        aria-hidden="true"
        className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 -z-10"
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 lg:px-8">
        <div className="flex flex-col items-start">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Adaptive AI interviewer
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              An AI interview that{' '}
              <span className="text-primary">adapts to you.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Practice realistic interviews with an AI interviewer that
              evaluates your answers, adapts the conversation, and challenges
              you based on how you actually perform.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="group h-12 px-6 text-[15px]"
                onClick={() => navigate('/register')}
              >
                Start an Interview
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-border bg-card px-6 text-[15px] hover:bg-accent"
                onClick={() =>
                  document
                    .getElementById('how-it-works')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                <Play className="size-4" />
                See How It Works
              </Button>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-6">
              {[
                { v: 'Real-time', l: 'answer evaluation' },
                { v: 'Adaptive', l: 'difficulty & path' },
                { v: 'Resumable', l: 'interrupted sessions' },
              ].map((stat) => (
                <div key={stat.l}>
                  <dt className="text-sm font-semibold text-foreground">{stat.v}</dt>
                  <dd className="mt-0.5 text-xs text-muted-foreground">{stat.l}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <Reveal delay={200} className="w-full">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-4 -z-10 rounded-3xl bg-primary/5 blur-2xl"
            />
            <InterviewDemo />
          </div>
        </Reveal>
      </div>
    </section>
  )
}