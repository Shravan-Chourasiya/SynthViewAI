import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { analyticsService, UserAnalytics } from '../services/analytics.service';

interface AnalyticsState {
  userAnalytics: UserAnalytics | null;
  loading: boolean;
  error: string | null;
  trendData: any[];
  overallStats: any;
  
  loadUserAnalytics: () => Promise<void>;
  loadTrendData: () => Promise<void>;
  reset: () => void;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  devtools((set) => ({
    userAnalytics: null,
    loading: false,
    error: null,
    trendData: [],
    overallStats: null,
    
    loadUserAnalytics: async () => {
      set({ loading: true, error: null });
      try {
        const response = await analyticsService.getUserAnalytics();
        set({ 
          userAnalytics: response.data,
          loading: false 
        });
      } catch (error: any) {
        set({ 
          error: error.message || 'Failed to load analytics',
          loading: false 
        });
      }
    },
    
    loadTrendData: async () => {
      set({ loading: true, error: null });
      try {
        const response = await analyticsService.getUserTrendAnalytics();
        set({ 
          trendData: response.data.trendData,
          overallStats: response.data.overallStats,
          loading: false 
        });
      } catch (error: any) {
        set({ 
          error: error.message || 'Failed to load trend data',
          loading: false 
        });
      }
    },
    
    reset: () => set({ 
      userAnalytics: null, 
      trendData: [], 
      overallStats: null, 
      error: null 
    }),
  }))
);