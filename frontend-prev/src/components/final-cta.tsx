import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/reveal'

export function FinalCta() {
  return (
    <section className="border-t border-border py-24 sm:py-28 lg:py-32">
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center sm:px-12 sm:py-16">
          {/* grid backdrop */}
          <div
            aria-hidden="true"
            className="bg-grid bg-grid-fade pointer-events-none absolute inset-0"
          />
          {/* radial glow pulse — conversion section ambient */}
          <div
            aria-hidden="true"
            className="animate-glow-pulse pointer-events-none absolute inset-0 -z-10 rounded-3xl"
            style={{
              background:
                'radial-gradient(ellipse 65% 45% at 50% 100%, oklch(0.66 0.16 250 / 18%), transparent)',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
            style={{
              background:
                'radial-gradient(ellipse 40% 30% at 50% 0%, oklch(0.66 0.16 250 / 8%), transparent)',
            }}
          />

          <div className="relative">
            <Reveal>
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.75rem] md:leading-[1.1]">
                Your next interview{' '}
                <span className="text-primary">shouldn't be a surprise.</span>
              </h2>
            </Reveal>
            <Reveal delay={100}>
              <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                Practice in an interview that responds to how you actually
                perform.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-8 flex justify-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-card px-7 text-[15px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-7 text-[15px] font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Get Started
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}