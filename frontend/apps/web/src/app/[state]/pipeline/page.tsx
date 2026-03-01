import { notFound } from 'next/navigation';
import { getAnalysisTierStats, getPriorityPicks } from '@/lib/actions/analysis';
import { AnalysisDashboard } from '@/components/analysis';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';

interface AnalysisPageProps {
  params: Promise<{ state: string }>;
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { state } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = JURISDICTION_CONFIG[state];

  // Fetch analysis stats and priority picks in parallel
  const [statsResult, priorityResult] = await Promise.all([
    getAnalysisTierStats(stateCode),
    getPriorityPicks(stateCode),
  ]);

  const tierCounts = statsResult.success ? statsResult.data.tierCounts : null;
  const classificationBreakdown = statsResult.success ? statsResult.data.classificationBreakdown : null;
  const total = statsResult.success ? statsResult.data.total : 0;

  const priorityPicks = priorityResult.success ? priorityResult.data : null;

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Research Pipeline`}
        description="View research pipeline progression, tier distributions, and classification outcomes"
      />
      <Container size="2xl" className="py-6">
        <AnalysisDashboard
          jurisdiction={stateCode}
          tierCounts={tierCounts}
          classificationBreakdown={classificationBreakdown}
          total={total}
          priorityPicks={priorityPicks}
        />
      </Container>
    </div>
  );
}
