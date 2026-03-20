import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getAnalysisTierStats, getGuidanceAnalysisTierStats, getPriorityPicks, getAnalysisFilterStats } from '@/lib/actions/analysis';
import { AnalysisDashboard, PipelineSourceTabs } from '@/components/analysis';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';
import type { PipelineSourceValue } from '@/lib/constants/values';

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

  // Fetch stats based on source, and priority picks (regulations only)
  const [statsResult, priorityResult, filterStatsResult] = await Promise.all([
    isGuidance
      ? getGuidanceAnalysisTierStats(stateCode)
      : getAnalysisTierStats(stateCode),
    isGuidance ? Promise.resolve(null) : getPriorityPicks(stateCode),
    isGuidance ? Promise.resolve(null) : getAnalysisFilterStats(stateCode),
  ]);

  const tierCounts = statsResult.success ? statsResult.data.tierCounts : null;
  const classificationBreakdown = statsResult.success ? statsResult.data.classificationBreakdown : null;
  const total = statsResult.success ? statsResult.data.total : 0;

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
