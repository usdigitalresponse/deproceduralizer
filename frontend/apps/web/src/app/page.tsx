import { Container, PageHeader } from '@/components/layout';
import { DashboardStats, StateCard, QuickLinks, RecentActivityCard, TopIssuesChart, HomePrioritySection, PipelineHeroBanner } from '@/components/home';
import { getDashboardStats, getAllStateStats, getRecentActivity } from '@/lib/actions/dashboard';
import { getPriorityPicks } from '@/lib/actions/analysis';
import { DEFAULT_JURISDICTION, VALID_JURISDICTIONS } from '@/types/state';
import type { JurisdictionCode } from '@deproceduralizer/database';
import { Alert } from '@/components/ui';

/**
 * Home page dashboard with aggregate stats, state selector, and quick links.
 */
export default async function HomePage() {
  // Fetch stats for all states combined, per-state, recent activity, and priority picks
  const [aggregateResult, stateStatsResult, activityResult, ...priorityResults] = await Promise.all([
    getDashboardStats(),
    getAllStateStats(),
    getRecentActivity(),
    ...VALID_JURISDICTIONS.map((s) => getPriorityPicks(s as JurisdictionCode)),
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

  const statePriorities = VALID_JURISDICTIONS.map((s, i) => {
    const result = priorityResults[i];
    return {
      jurisdiction: s as JurisdictionCode,
      items: result.success ? result.data.items : [],
      totalQuickWins: result.success ? result.data.totalQuickWins : 0,
      isQuickWinMode: result.success ? result.data.isQuickWinMode : false,
    };
  });

  return (
    <>
      <PageHeader
        title="Regulatory Analysis Dashboard"
        description="AI-powered analysis of state regulations to identify procedural complexity and potential issues"
      />

      <Container size="2xl" className="py-6 space-y-8">
        {/* Pipeline Hero Banner */}
        <PipelineHeroBanner state={DEFAULT_JURISDICTION} />

        {/* Overview */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Overview
          </h2>
          <DashboardStats stats={aggregateStats} />
        </section>

        {/* Priority Picks */}
        {statePriorities.some((sp) => sp.items.length > 0) && (
          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Featured Issues
            </h2>
            <HomePrioritySection jurisdictionPriorities={statePriorities} />
          </section>
        )}

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
            Select a Jurisdiction
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StateCard jurisdiction="ny" stats={stateStats.ny} />
            <StateCard jurisdiction="nj" stats={stateStats.nj} />
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Quick Actions
          </h2>
          <QuickLinks jurisdiction={DEFAULT_JURISDICTION} stats={aggregateStats} />
        </section>
      </Container>
    </>
  );
}
