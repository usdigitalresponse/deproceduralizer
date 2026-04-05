import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getPriorityPicks, getAnalysisFilterStats } from '@/lib/actions/analysis';
import { getAnalyticsSummary } from '@/lib/actions/analytics-metrics';
import { AnalysisDashboard, PipelineSourceTabs } from '@/components/analysis';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';
import type { PipelineSourceValue } from '@/lib/constants/values';
import type { AnalysisSource } from '@deproceduralizer/database';

interface AnalysisPageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<{ source?: string }>;
}

export default async function AnalysisPage({ params, searchParams }: AnalysisPageProps) {
  const { state } = await params;
  const queryParams = await searchParams;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = JURISDICTION_CONFIG[state];
  const source: PipelineSourceValue = queryParams.source === 'guidance' ? 'guidance' : 'regulations';
  const isGuidance = source === 'guidance';
  const repoSource: AnalysisSource = isGuidance ? 'guidance' : 'regulation';

  // Fetch stats using shared metrics service (same as analytics page)
  const [summaryResult, priorityResult, filterStatsResult] = await Promise.all([
    getAnalyticsSummary(stateCode, repoSource),
    isGuidance ? Promise.resolve(null) : getPriorityPicks(stateCode),
    isGuidance ? Promise.resolve(null) : getAnalysisFilterStats(stateCode),
  ]);

  const tierCounts = summaryResult.success ? summaryResult.data.tierCounts : null;
  const classificationBreakdown = summaryResult.success ? summaryResult.data.classificationBreakdown : null;
  const total = summaryResult.success
    ? summaryResult.data.tierCounts.tier0 + summaryResult.data.tierCounts.tier1 + summaryResult.data.tierCounts.tier2 + summaryResult.data.tierCounts.tier3
    : 0;

  const priorityPicks = priorityResult?.success ? priorityResult.data : null;
  const filterStats = filterStatsResult?.success ? filterStatsResult.data : null;

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Research Pipeline`}
        description="View research pipeline progression, tier distributions, and classification outcomes"
      />
      <Container size="2xl" className="py-6">
        <Suspense fallback={null}>
          <PipelineSourceTabs />
        </Suspense>

        <div className="mt-4">
          <AnalysisDashboard
            jurisdiction={stateCode}
            tierCounts={tierCounts}
            classificationBreakdown={classificationBreakdown}
            total={total}
            priorityPicks={priorityPicks}
            source={source}
            filterStats={filterStats}
          />
        </div>
      </Container>
    </div>
  );
}
