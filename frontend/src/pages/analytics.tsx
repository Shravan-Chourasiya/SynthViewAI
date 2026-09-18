import { useEffect } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useAnalyticsStore } from '@/lib/stores/analytics.store';
import { TrendingUp, Target, BarChart3, Activity } from 'lucide-react';

export function AnalyticsPage() {
  const { 
    userAnalytics, 
    loading, 
    error, 
    loadUserAnalytics 
  } = useAnalyticsStore();

  useEffect(() => {
    loadUserAnalytics();
  }, []);

  // Prepare data for charts
  const performanceByCategory = userAnalytics?.performanceByCategory || [];
  const trendData = userAnalytics?.trendData || [];

  // Top strengths and weaknesses
  const strengths = Object.entries(userAnalytics?.categoryBreakdown.strengths || {})
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  const weaknesses = Object.entries(userAnalytics?.categoryBreakdown.weaknesses || {})
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  return (
    <AppShell title="Analytics">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Performance Analytics</h1>
          <p className="mt-2 text-muted-foreground">
            Track your interview performance and identify areas for improvement
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 mb-6">
            Error loading analytics: {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && (!userAnalytics || userAnalytics.overallStats.totalInterviews === 0) && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No interview data yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Complete your first interview to start seeing performance analytics.
            </p>
            <a 
              href="/interviews/new" 
              className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              Start New Interview
            </a>
          </div>
        )}

        {/* Stats Cards */}
        {userAnalytics && userAnalytics.overallStats.totalInterviews > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Interviews Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userAnalytics.overallStats.totalInterviews}</div>
                <p className="text-xs text-muted-foreground">Completed sessions</p>
              </CardContent>
            </Card>

            {/* Avg Overall Score Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
                <Target className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userAnalytics.overallStats.avgOverallScore !== null 
                    ? userAnalytics.overallStats.avgOverallScore 
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">Overall performance</p>
              </CardContent>
            </Card>

            {/* Completion Rate Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completion</CardTitle>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userAnalytics.overallStats.completionRate}%
                </div>
                <p className="text-xs text-muted-foreground">Questions answered</p>
              </CardContent>
            </Card>

            {/* Questions Answered Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Qs Answered</CardTitle>
                <Activity className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userAnalytics.overallStats.totalQuestionsAnswered}</div>
                <p className="text-xs text-muted-foreground">Across all interviews</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Performance Charts */}
        {userAnalytics && userAnalytics.overallStats.totalInterviews > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Score Trend Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Score Trend</CardTitle>
                <CardDescription>Your performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {loading ? (
                    <Skeleton className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="overallScore" stroke="#8884d8" name="Overall" strokeWidth={2} />
                        <Line type="monotone" dataKey="technicalScore" stroke="#82ca9d" name="Technical" strokeWidth={2} />
                        <Line type="monotone" dataKey="communicationScore" stroke="#ffc658" name="Communication" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Performance by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Performance by Category</CardTitle>
                <CardDescription>Your strengths and weaknesses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {loading ? (
                    <Skeleton className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceByCategory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="avgScore" name="Average Score">
                          {performanceByCategory.map((entry, index) => (
                            <svg key={index}>
                              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                            </svg>
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Strengths and Weaknesses */}
        {userAnalytics && userAnalytics.overallStats.totalInterviews > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Strengths */}
            <Card>
              <CardHeader>
                <CardTitle>Top Strengths</CardTitle>
                <CardDescription>Areas where you excel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {strengths.length > 0 ? (
                    strengths.map(([strength, count]) => (
                      <div key={strength} className="flex items-center justify-between">
                        <span>{strength}</span>
                        <Badge variant="secondary">{count} mentions</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No strengths data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Weaknesses */}
            <Card>
              <CardHeader>
                <CardTitle>Areas for Improvement</CardTitle>
                <CardDescription>Focus on these areas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {weaknesses.length > 0 ? (
                    weaknesses.map(([weakness, count]) => (
                      <div key={weakness} className="flex items-center justify-between">
                        <span>{weakness}</span>
                        <Badge variant="destructive">{count} mentions</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No weaknesses data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}