import { Hero } from '@/components/landing/hero'
import { SectionRail, type RailItem } from '@/components/landing/section-rail'
import {
  AdaptiveExample,
  Differentiator,
  EvaluationAnalytics,
  FinalCta,
  FinalReport,
  InterviewHistoryPreview,
  InterviewTypes,
  LiveExperience,
  Principles,
} from '@/components/landing/sections'

/** One source of truth for the rail and the ids the sections carry. */
const RAIL: RailItem[] = [
  { id: 'top', label: 'Top' },
  { id: 'why', label: 'Why adaptive' },
  { id: 'interview-types', label: 'Formats' },
  { id: 'how-it-works', label: 'Inside the room' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'reports', label: 'The report' },
  { id: 'history', label: 'History' },
  { id: 'principles', label: 'Principles' },
]

export default function LandingPage() {
  return (
    <>
      <SectionRail items={RAIL} />
      <Hero />
      <Differentiator />
      <InterviewTypes />
      <LiveExperience />
      <EvaluationAnalytics />
      <AdaptiveExample />
      <FinalReport />
      <InterviewHistoryPreview />
      <Principles />
      <FinalCta />
    </>
  )
}
