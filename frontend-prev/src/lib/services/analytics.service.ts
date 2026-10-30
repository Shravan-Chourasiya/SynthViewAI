import { httpGet } from '../http';

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

// The http helpers unwrap the backend's `{ success, data }` envelope,
// so these resolve directly to the analytics payload itself.
class AnalyticsService {
  /**
   * Get user analytics
   */
  async getUserAnalytics(): Promise<UserAnalytics> {
    return httpGet<UserAnalytics>('/analytics/me');
  }

  /**
   * Get user trend analytics
   */
  async getUserTrendAnalytics(): Promise<{ trendData: UserAnalytics['trendData']; overallStats: UserAnalytics['overallStats'] }> {
    return httpGet<{ trendData: UserAnalytics['trendData']; overallStats: UserAnalytics['overallStats'] }>('/analytics/me/trend');
  }
  
  /**
   * Get analytics data for the analytics page (wrapper function to match expected interface)
   */
  async getAnalyticsData(): Promise<{
    interviewStats: {
      totalInterviews: number;
      completedInterviews: number;
      inProgressInterviews: number;
      averageRating: number;
      totalDuration: number;
    };
    performanceData: Array<{
      date: string;
      interviews: number;
      avgRating: number;
    }>;
    categoryBreakdown: Array<{
      category: string;
      count: number;
      percentage: number;
    }>;
    topPerformers: Array<{
      id: string;
      name: string;
      avatar: string;
      totalInterviews: number;
      avgRating: number;
      completionRate: number;
    }>;
    recentActivity: Array<{
      id: string;
      user: string;
      action: string;
      time: string;
      status: "completed" | "in-progress" | "cancelled";
    }>;
  }> {
    try {
      const data = await this.getUserAnalytics();
      
      // Transform backend data to match frontend expectations
      return {
        interviewStats: {
          totalInterviews: data.overallStats.totalInterviews,
          completedInterviews: data.overallStats.totalInterviews, // Assuming all interviews are completed for simplicity
          inProgressInterviews: 0, // Placeholder - would need actual data
          averageRating: data.overallStats.avgOverallScore || 0,
          totalDuration: 0 // Placeholder - would need actual data
        },
        performanceData: data.trendData.map(item => ({
          date: item.date,
          interviews: 1, // Placeholder - would need actual data
          avgRating: item.overallScore
        })),
        categoryBreakdown: Object.entries(data.categoryBreakdown.strengths).map(([category, count], index) => ({
          category,
          count,
          percentage: Math.min(100, Math.round((count / Math.max(1, Object.values(data.categoryBreakdown.strengths).reduce((a, b) => a + b, 0))) * 100))
        })),
        topPerformers: [], // Placeholder - would need actual data
        recentActivity: [] // Placeholder - would need actual data
      };
    } catch (error) {
      // Return default values in case of error
      return {
        interviewStats: {
          totalInterviews: 0,
          completedInterviews: 0,
          inProgressInterviews: 0,
          averageRating: 0,
          totalDuration: 0
        },
        performanceData: [],
        categoryBreakdown: [],
        topPerformers: [],
        recentActivity: []
      };
    }
  }
}

export const analyticsService = new AnalyticsService();