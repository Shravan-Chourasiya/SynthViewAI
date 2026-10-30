import { httpGet } from '../http'
import type { AnalyticsSummary } from '../types'

interface BackendAnalytics {
  overallStats: {
    totalInterviews: number
    avgOverallScore: number | null
    avgTechnicalScore: number | null
    avgCommunicationScore: number | null
    avgProblemSolvingScore: number | null
    avgConfidenceScore: number | null
    totalQuestionsAnswered: number
    totalQuestionsSkipped: number
    completionRate: number
  }
  trendData: { date: string; overallScore: number; technicalScore: number; communicationScore: number }[]
  categoryBreakdown: { strengths: Record<string, number>; weaknesses: Record<string, number> }
  performanceByCategory: { category: string; avgScore: number; count: number }[]
}

function mapAnalytics(raw: BackendAnalytics): AnalyticsSummary {
  const { overallStats, trendData, categoryBreakdown, performanceByCategory } = raw
  return {
    kpis: [
      { label: 'Total interviews', value: String(overallStats.totalInterviews), delta: '', trend: 'flat', hint: '' },
      { label: 'Avg score', value: overallStats.avgOverallScore != null ? String(Math.round(overallStats.avgOverallScore)) : '—', delta: '', trend: 'flat', hint: '' },
      { label: 'Completion rate', value: `${Math.round(overallStats.completionRate)}%`, delta: '', trend: 'flat', hint: '' },
    ],
    scoreOverTime: trendData.map((p) => ({ label: p.date, score: Math.round(p.overallScore), benchmark: 70 })),
    byCategory: performanceByCategory.map((p) => ({ category: p.category, score: Math.round(p.avgScore), attempts: p.count })),
    byDifficulty: [],
    skills: [],
    strengths: Object.keys(categoryBreakdown.strengths).slice(0, 5),
    gaps: Object.keys(categoryBreakdown.weaknesses).slice(0, 5),
  }
}

export const analyticsService = {
  async summary(): Promise<AnalyticsSummary> {
    const raw = await httpGet<BackendAnalytics>('/analytics/me')
    return mapAnalytics(raw)
  },

  /**
   * `GET /analytics/me/trend` answers `{ trendData, overallStats }` — the same
   * series the summary charts read, not the view model
   * (backend/src/modules/analytics/controllers/analytics.controller.ts).
   */
  async trend(): Promise<{ label: string; score: number; benchmark: number }[]> {
    const raw = await httpGet<Pick<BackendAnalytics, 'trendData'>>('/analytics/me/trend')
    return (raw?.trendData ?? []).map((point) => ({
      label: point.date,
      score: Math.round(point.overallScore),
      benchmark: 70,
    }))
  },
}
