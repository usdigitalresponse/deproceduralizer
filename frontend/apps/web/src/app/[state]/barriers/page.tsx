import { notFound } from 'next/navigation';
import { getBarrierStrategyStats, getTournamentResults } from '@/lib/actions/barrier-strategies';
import { BarrierStrategiesClient } from '@/components/barriers/BarrierStrategiesClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';

interface BarrierPageProps {
  params: Promise<{ state: string }>;
}

export default async function BarrierStrategiesPage({ params }: BarrierPageProps) {
  const { state } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = JURISDICTION_CONFIG[state];

  const [statsResult, tournamentResult] = await Promise.all([
    getBarrierStrategyStats(stateCode),
    getTournamentResults(),
  ]);

  const stats = statsResult.success ? statsResult.data : null;
  const tournamentResults = tournamentResult.success ? tournamentResult.data : null;

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Barrier Analysis`}
        description="Regulatory findings filtered by strategy — best narratives, surprises, framework alignment, and action plans"
      />
      <Container size="2xl" className="py-6">
        <BarrierStrategiesClient
          jurisdiction={stateCode}
          stats={stats}
          tournamentResults={tournamentResults}
        />
      </Container>
    </div>
  );
}
