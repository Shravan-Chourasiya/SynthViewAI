import { httpGet } from '../http';
import type { UserAnalytics } from './analytics.service'; // Import the type

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

// Define the response type for the API
type AnalyticsResponse = {
  data: UserAnalytics;
};

class AnalyticsService {
  /**
   * Get user analytics
   */
  async getUserAnalytics() {
    return await httpGet<AnalyticsResponse>('/analytics/me');
  }

  /**
   * Get user trend analytics
   */
  async getUserTrendAnalytics() {
    return await httpGet<{ data: { trendData: any[]; overallStats: any } }>('/analytics/me/trend');
  }
}

export const analyticsService = new AnalyticsService();