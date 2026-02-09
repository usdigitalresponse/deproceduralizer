import { Container, PageHeader } from '@/components/layout';
import { DashboardStats, StateCard, QuickLinks, RecentActivityCard, TopIssuesChart } from '@/components/home';
import { getDashboardStats, getAllStateStats, getRecentActivity } from '@/lib/actions/dashboard';
import { Alert } from '@/components/ui';

/**
 * Home page dashboard with aggregate stats, state selector, and quick links.
 */
export default async function HomePage() {
  // Fetch stats for all states combined, per-state, and recent activity
  const [aggregateResult, stateStatsResult, activityResult] = await Promise.all([
    getDashboardStats(),
    getAllStateStats(),
    getRecentActivity(),
  ]);

  // Handle errors - display them obviously
  if (!aggregateResult.success) {
    return (
      <>
        <PageHeader
          title="Regulatory Analysis Dashboard"
          description="AI-powered analysis of state regulations to identify procedural complexity and potential issues"
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">
            Failed to load dashboard stats: {aggregateResult.error}
          </Alert>
        </Container>
      </>
    );
  }

  if (!stateStatsResult.success) {
    return (
      <>
        <PageHeader
          title="Regulatory Analysis Dashboard"
          description="AI-powered analysis of state regulations to identify procedural complexity and potential issues"
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">
            Failed to load state stats: {stateStatsResult.error}
          </Alert>
        </Container>
      </>
    );
  }

  const aggregateStats = aggregateResult.data;
  const stateStats = stateStatsResult.data;
  const recentActivity = activityResult.success ? activityResult.data : null;

  return (
    <>
      <PageHeader
        title="Regulatory Analysis Dashboard"
        description="AI-powered analysis of state regulations to identify procedural complexity and potential issues"
      />

      <Container size="2xl" className="py-6 space-y-8">
        {/* Overview */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Overview
          </h2>
          <DashboardStats stats={aggregateStats} />
        </section>

        {/* Recent Activity + Top Issues */}
        {(recentActivity || aggregateStats.complianceIssues?.total > 0) && (
          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Recent Activity &amp; Top Issues
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {recentActivity && (
                <RecentActivityCard activity={recentActivity} />
              )}
              {aggregateStats.complianceIssues?.total > 0 && (
                <TopIssuesChart byType={aggregateStats.complianceIssues.byType} />
              )}
            </div>
          </section>
        )}

        {/* State Selection */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Select a State
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StateCard state="ny" stats={stateStats.ny} />
            <StateCard state="nj" stats={stateStats.nj} />
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Quick Actions
          </h2>
          <QuickLinks state="nj" stats={aggregateStats} />
        </section>
      </Container>
    </>
  );
}
