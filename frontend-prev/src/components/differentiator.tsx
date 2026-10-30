import { Section } from '@/components/section'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { AdaptiveFlow } from '@/components/adaptive-flow'

export function Differentiator() {
  return (
    <Section id="how-it-works" bordered>
      <SectionHeading
        eyebrow="The difference"
        title={
          <>
            Not a fixed questionnaire.{' '}
            <span className="text-primary">A dynamic interview.</span>
          </>
        }
        description="SynthView continuously evaluates each response and changes the interview accordingly. Every answer routes you down a different path — just like a real interviewer would."
      />
      <Reveal delay={120} className="mt-12">
        <AdaptiveFlow />
      </Reveal>
    </Section>
  )
}