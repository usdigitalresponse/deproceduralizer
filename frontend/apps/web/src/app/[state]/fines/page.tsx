import { notFound } from 'next/navigation';
import { getFinesOverviewStats, getFinesAgencies, getFinesWhoPays, getFinesPerUnits } from '@/lib/actions/fines';
import { FinesClient } from '@/components/fines/FinesClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';

interface FinesPageProps {
  params: Promise<{ state: string }>;
}

export default async function FinesPage({ params }: FinesPageProps) {
  const { state } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = JURISDICTION_CONFIG[state];

  const [statsResult, agenciesResult, whoPaysResult, perUnitsResult] = await Promise.all([
    getFinesOverviewStats(stateCode),
    getFinesAgencies(stateCode),
    getFinesWhoPays(stateCode),
    getFinesPerUnits(stateCode),
  ]);

  const stats = statsResult.success ? statsResult.data : null;
  const agencies = agenciesResult.success ? agenciesResult.data : [];
  const whoPaysValues = whoPaysResult.success ? whoPaysResult.data : [];
  const perUnitValues = perUnitsResult.success ? perUnitsResult.data : [];

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Fines & Fees`}
        description="Comprehensive schedule of fines, fees, penalties, and surcharges across regulations and guidance"
      />
      <Container size="2xl" className="py-6">
        <FinesClient
          jurisdiction={stateCode}
          stats={stats}
          agencies={agencies}
          whoPaysValues={whoPaysValues}
          perUnitValues={perUnitValues}
        />
      </Container>
    </div>
  );
}
