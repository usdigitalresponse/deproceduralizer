import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getAnalysisTierStats, getGuidanceAnalysisTierStats, getPriorityPicks } from '@/lib/actions/analysis';
import { getGuidanceAgencies, getGuidanceDocTypes } from '@/lib/actions/guidance-documents';
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

  // Fetch all data in parallel based on source mode
  const [statsResult, priorityResult, agenciesResult, docTypesResult] = await Promise.all([
    isGuidance ? getGuidanceAnalysisTierStats(stateCode) : getAnalysisTierStats(stateCode),
    isGuidance ? null : getPriorityPicks(stateCode),
    isGuidance ? getGuidanceAgencies(stateCode) : null,
    isGuidance ? getGuidanceDocTypes(stateCode) : null,
  ]);

  const tierCounts = statsResult.success ? statsResult.data.tierCounts : null;
  const classificationBreakdown = statsResult.success ? statsResult.data.classificationBreakdown : null;
  const total = statsResult.success ? statsResult.data.total : 0;
  const priorityPicks = priorityResult?.success ? priorityResult.data : null;
  const guidanceAgencies = agenciesResult?.success ? agenciesResult.data : [];
  const guidanceDocTypes = docTypesResult?.success ? docTypesResult.data : [];

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
            guidanceAgencies={guidanceAgencies}
            guidanceDocTypes={guidanceDocTypes}
          />
        </div>
      </Container>
    </div>
  );
}
