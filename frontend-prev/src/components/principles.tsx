import {
  Video,
  GitBranch,
  MousePointerClick,
  LineChart,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { Section } from '@/components/section'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'

interface Principle {
  icon: LucideIcon
  title: string
  description: string
}

const principles: Principle[] = [
  {
    icon: Video,
    title: 'Realistic',
    description: 'Designed to feel like an actual interview, not a form.',
  },
  {
    icon: GitBranch,
    title: 'Adaptive',
    description: 'The interview changes according to how you perform.',
  },
  {
    icon: MousePointerClick,
    title: 'Interactive',
    description:
      'You actively participate rather than answering a static questionnaire.',
  },
  {
    icon: LineChart,
    title: 'Insightful',
    description: 'Performance is analyzed well beyond a single final score.',
  },
  {
    icon: ShieldCheck,
    title: 'Resilient',
    description:
      'Interrupted interviews resume — a dropped connection won’t destroy your session.',
  },
]

export function Principles() {
  return (
    <Section bordered>
      <SectionHeading
        eyebrow="Product principles"
        title="Built on five commitments"
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {principles.map((p, i) => {
          const Icon = p.icon
          return (
            <Reveal key={p.title} delay={i * 80}>
              <article className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
                  <Icon className="size-5 text-primary" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
              </article>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}