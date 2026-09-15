import { useEffect } from 'react'
import { SiteNav } from '@/components/site-nav'
import { Hero } from '@/components/hero'
import { Differentiator } from '@/components/differentiator'
import { InterviewTypes } from '@/components/interview-types'
import { LiveExperience } from '@/components/live-experience'
import { EvaluationAnalytics } from '@/components/evaluation-analytics'
import { AdaptiveExample } from '@/components/adaptive-example'
import { FinalReport } from '@/components/final-report'
import { InterviewHistory } from '@/components/interview-history'
import { Principles } from '@/components/principles'
import { FinalCta } from '@/components/final-cta'
import { SiteFooter } from '@/components/site-footer'

export function LandingPage() {
  // Support footer/nav hash links like /#how-it-works
  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.length > 1) {
      const el = document.getElementById(hash.slice(1))
      el?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="animate-slide-up">
        <Hero />
        <Differentiator />
        <InterviewTypes />
        <LiveExperience />
        <EvaluationAnalytics />
        <AdaptiveExample />
        <FinalReport />
        <InterviewHistory />
        <Principles />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}