import { Container, PageHeader } from '@/components/layout';
import { DashboardStats, StateCard, QuickLinks } from '@/components/home';
import { getDashboardStats, getAllStateStats } from '@/lib/actions/dashboard';

/**
 * Home page dashboard with aggregate stats, state selector, and quick links.
 */
export default async function HomePage() {
  // Fetch stats for all states combined and per-state
  const [aggregateStats, stateStats] = await Promise.all([
    getDashboardStats(),
    getAllStateStats(),
  ]);

  return (
    <>
      <PageHeader
        title="Regulatory Analysis Dashboard"
        description="AI-powered analysis of state regulations to identify procedural complexity and potential issues"
      />

      <Container size="2xl" className="py-6 space-y-8">
        {/* Aggregate Stats */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Overview
          </h2>
          <DashboardStats stats={aggregateStats} />
        </section>

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

        {/* Quick Links - default to NY */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Quick Actions
          </h2>
          <QuickLinks state="ny" />
        </section>
      </Container>
    </>
  );
}
