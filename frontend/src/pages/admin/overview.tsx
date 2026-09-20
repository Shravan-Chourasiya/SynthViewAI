import { useEffect } from 'react';
import { AppShell } from '@/components/app-shell';
import { AdminGate, AdminHeader } from './shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStore } from '@/lib/stores/admin.store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function AdminOverviewPage() {
  const { overviewStats, overviewLoading, overviewError, loadOverviewStats } = useAdminStore();

  useEffect(() => {
    loadOverviewStats();
  }, []);

  // Sample data for chart visualization
  const statusData = overviewStats 
    ? Object.entries(overviewStats.interviewsByStatus).map(([status, count]) => ({
        name: status,
        count,
      }))
    : [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <AppShell title="Admin Overview">
      <AdminGate>
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <AdminHeader 
            title="Platform Overview" 
            description="Monitor platform health, user activity, and interview trends" 
          />

          {overviewError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              Error loading overview data: {overviewError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Users Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Users</CardDescription>
                <CardTitle className="text-2xl">
                  {overviewLoading ? <Skeleton className="h-8 w-20" /> : overviewStats?.totalUsers ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">+{overviewStats?.recentSignups ?? 0} in last 30 days</p>
              </CardContent>
            </Card>

            {/* Total Interviews Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Interviews</CardDescription>
                <CardTitle className="text-2xl">
                  {overviewLoading ? <Skeleton className="h-8 w-20" /> : overviewStats?.totalInterviews ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {overviewStats?.activeUsers ? Math.round((overviewStats.activeUsers / (overviewStats.totalUsers || 1)) * 100) : 0}% active
                </p>
              </CardContent>
            </Card>

            {/* Active Users Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Users</CardDescription>
                <CardTitle className="text-2xl">
                  {overviewLoading ? <Skeleton className="h-8 w-20" /> : overviewStats?.activeUsers ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Completed at least 1 interview</p>
              </CardContent>
            </Card>

            {/* Completion Rate Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Recent Signups</CardDescription>
                <CardTitle className="text-2xl">
                  {overviewLoading ? <Skeleton className="h-8 w-20" /> : overviewStats?.recentSignups ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">In last 30 days</p>
              </CardContent>
            </Card>
          </div>

          {/* Interviews by Status Chart */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Interviews by Status</CardTitle>
              <CardDescription>Distribution of interviews across different statuses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {overviewLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" name="Interviews">
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminGate>
    </AppShell>
  );
}

export default AdminOverviewPage;