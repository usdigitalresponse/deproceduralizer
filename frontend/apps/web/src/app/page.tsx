import { Container } from '@/components/layout';
import { StateCard, HomeHero, RegulatoryLandscape } from '@/components/home';
import { getDashboardStats, getAllStateStats } from '@/lib/actions/dashboard';
import { getGuidanceOverviewStats } from '@/lib/actions/guidance-documents';
import { getBarrierBurdenStats, getBarrierStatusCounts, getBarrierCategories } from '@/lib/actions/barrier';
import { getFinesOverviewStats } from '@/lib/actions/fines';
import { DEFAULT_JURISDICTION, VALID_JURISDICTIONS } from '@/types/state';
import { Alert } from '@/components/ui';

/**
 * Home page dashboard with aggregate stats, regulatory landscape, and jurisdiction cards.
 */
export default async function HomePage() {
  const [
    aggregateResult,
    stateStatsResult,
    guidanceNY,
    guidanceNJ,
    guidanceNYC,
    burdenNY,
    burdenNJ,
    burdenNYC,
    finesNY,
    finesNJ,
    finesNYC,
    barrierNY,
    barrierNJ,
    barrierNYC,
    barrierCategoriesResult,
  ] = await Promise.all([
    getDashboardStats(),
    getAllStateStats(),
    getGuidanceOverviewStats('ny'),
    getGuidanceOverviewStats('nj'),
    getGuidanceOverviewStats('nyc'),
    getBarrierBurdenStats('ny'),
    getBarrierBurdenStats('nj'),
    getBarrierBurdenStats('nyc'),
    getFinesOverviewStats('ny'),
    getFinesOverviewStats('nj'),
    getFinesOverviewStats('nyc'),
    getBarrierStatusCounts('ny'),
    getBarrierStatusCounts('nj'),
    getBarrierStatusCounts('nyc'),
    getBarrierCategories('ny'),
  ]);

  // Handle errors
  if (!aggregateResult.success) {
    return (
      <>
        <div className="bg-[var(--color-primary-faint)] border-b border-[var(--color-neutral-200)]">
          <Container size="2xl" className="py-8">
            <p className="text-xs tracking-[0.15em] font-medium uppercase text-[var(--color-primary-mid)]">
              Regulatory Analysis Dashboard
            </p>
          </Container>
        </div>
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
        <div className="bg-[var(--color-primary-faint)] border-b border-[var(--color-neutral-200)]">
          <Container size="2xl" className="py-8">
            <p className="text-xs tracking-[0.15em] font-medium uppercase text-[var(--color-primary-mid)]">
              Regulatory Analysis Dashboard
            </p>
          </Container>
        </div>
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

  // Guidance
  const guidanceByState = {
    ny: guidanceNY.success ? guidanceNY.data : null,
    nj: guidanceNJ.success ? guidanceNJ.data : null,
    nyc: guidanceNYC.success ? guidanceNYC.data : null,
  };
  const aggregateGuidanceTotal = Object.values(guidanceByState)
    .reduce((sum, s) => sum + (s?.total ?? 0), 0);
  const aggregateGuidanceAgencies = Object.values(guidanceByState)
    .reduce((sum, s) => sum + (s?.byAgency?.length ?? 0), 0);

  // Burden
  const burdenByState = {
    ny: burdenNY.success ? burdenNY.data : null,
    nj: burdenNJ.success ? burdenNJ.data : null,
    nyc: burdenNYC.success ? burdenNYC.data : null,
  };

  // Fines
  const finesByState = {
    ny: finesNY.success ? finesNY.data : null,
    nj: finesNJ.success ? finesNJ.data : null,
    nyc: finesNYC.success ? finesNYC.data : null,
  };
  const aggregateFinesTotal = Object.values(finesByState)
    .reduce((sum, s) => sum + (s?.total ?? 0), 0);
  const aggregateFinesAgencies = Object.values(finesByState)
    .reduce((sum, s) => sum + (s?.uniqueAgencies ?? 0), 0);

  // Barrier
  const barrierByState = {
    ny: barrierNY.success ? barrierNY.data : null,
    nj: barrierNJ.success ? barrierNJ.data : null,
    nyc: barrierNYC.success ? barrierNYC.data : null,
  };
  const aggregateBarrierTotal = Object.values(barrierByState)
    .reduce((sum, s) => sum + (s?.total ?? 0), 0);
  const aggregateBarrierUnreviewed = Object.values(barrierByState)
    .reduce((sum, s) => sum + (s?.unreviewed ?? 0), 0);
  const barrierTopCategory = barrierCategoriesResult.success
    ? barrierCategoriesResult.data
        .filter((c) => c.category.toLowerCase() !== 'other')
        .sort((a, b) => b.count - a.count)[0]?.category ?? null
    : null;

  return (
    <>
      <HomeHero
        stats={aggregateStats}
        stateStats={stateStats}
        guidanceTotal={aggregateGuidanceTotal}
        barrierTotal={aggregateBarrierTotal}
        barrierUnreviewed={aggregateBarrierUnreviewed}
      />

      <Container size="2xl" className="py-6 space-y-8">
        {/* Regulatory Landscape */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Regulatory Landscape
          </h2>
          <RegulatoryLandscape
            complianceStats={aggregateStats.complianceIssues}
            guidanceStats={{ total: aggregateGuidanceTotal, agencyCount: aggregateGuidanceAgencies }}
            finesStats={{ total: aggregateFinesTotal, uniqueAgencies: aggregateFinesAgencies }}
            barrierStats={{ total: aggregateBarrierTotal, unreviewed: aggregateBarrierUnreviewed, topCategory: barrierTopCategory }}
            jurisdiction={DEFAULT_JURISDICTION}
          />
        </section>

        {/* Jurisdictions */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Jurisdictions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {VALID_JURISDICTIONS.map((j) => (
              <StateCard
                key={j}
                jurisdiction={j}
                stats={stateStats[j]}
                guidanceTotal={guidanceByState[j]?.total}
                burdenStats={burdenByState[j]}
                barrierStats={barrierByState[j]}
              />
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
