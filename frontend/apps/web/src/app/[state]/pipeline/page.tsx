import { notFound } from 'next/navigation';
import { getAnalysisTierStats } from '@/lib/actions/analysis';
import { AnalysisDashboard } from '@/components/analysis';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { STATE_CONFIG, isValidState } from '@/types/state';

interface AnalysisPageProps {
  params: Promise<{ state: string }>;
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { state } = await params;

  if (!isValidState(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = STATE_CONFIG[state];

  // Fetch analysis stats
  const statsResult = await getAnalysisTierStats(stateCode);

  const tierCounts = statsResult.success ? statsResult.data.tierCounts : null;
  const classificationBreakdown = statsResult.success ? statsResult.data.classificationBreakdown : null;
  const total = statsResult.success ? statsResult.data.total : 0;

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Research Pipeline`}
        description="View research pipeline progression, tier distributions, and classification outcomes"
      />
      <Container size="2xl" className="py-6">
        <AnalysisDashboard
          state={stateCode}
          tierCounts={tierCounts}
          classificationBreakdown={classificationBreakdown}
          total={total}
        />
      </Container>
    </div>
  );
}
