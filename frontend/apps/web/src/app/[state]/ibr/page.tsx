import { notFound } from 'next/navigation';
import { getIbrOverviewStats, getIbrSourceOrganizations, getIbrTopStandards } from '@/lib/actions/ibr';
import { IbrClient } from '@/components/ibr/IbrClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';

interface IbrPageProps {
  params: Promise<{ state: string }>;
}

export default async function IbrPage({ params }: IbrPageProps) {
  const { state } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = JURISDICTION_CONFIG[state];

  // Fetch all data in parallel
  const [
    statsResult,
    organizationsResult,
    topStandardsResult,
  ] = await Promise.all([
    getIbrOverviewStats(stateCode),
    getIbrSourceOrganizations(stateCode),
    getIbrTopStandards(stateCode, 20),
  ]);

  const stats = statsResult.success ? statsResult.data : null;
  const organizations = organizationsResult.success ? organizationsResult.data : [];
  const topStandards = topStandardsResult.success ? topStandardsResult.data : null;

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Standards (IBR)`}
        description="External standards incorporated by reference into state regulations"
      />
      <Container size="2xl" className="py-6">
        <IbrClient
          jurisdiction={stateCode}
          stats={stats}
          organizations={organizations}
          topStandards={topStandards}
        />
      </Container>
    </div>
  );
}
