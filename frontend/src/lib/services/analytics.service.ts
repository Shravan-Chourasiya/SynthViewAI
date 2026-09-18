import { api } from '../api';

export interface UserAnalytics {
  overallStats: {
    totalInterviews: number;
    avgOverallScore: number | null;
    avgTechnicalScore: number | null;
    avgCommunicationScore: number | null;
    avgProblemSolvingScore: number | null;
    avgConfidenceScore: number | null;
    totalQuestionsAnswered: number;
    totalQuestionsSkipped: number;
    completionRate: number;
  };
  trendData: Array<{
    date: string;
    overallScore: number;
    technicalScore: number;
    communicationScore: number;
  }>;
  categoryBreakdown: {
    strengths: Record<string, number>;
    weaknesses: Record<string, number>;
  };
  performanceByCategory: Array<{
    category: string;
    avgScore: number;
    count: number;
  }>;
}

class AnalyticsService {
  /**
   * Get user analytics
   */
  async getUserAnalytics() {
    const response = await api.get('/analytics/me');
    return response.data as { data: UserAnalytics };
  }

  /**
   * Get user trend analytics
   */
  async getUserTrendAnalytics() {
    const response = await api.get('/analytics/me/trend');
    return response.data as { data: { trendData: any[]; overallStats: any } };
  }
}

export const analyticsService = new AnalyticsService();