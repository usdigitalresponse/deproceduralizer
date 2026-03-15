import { notFound } from 'next/navigation';
import { getGuidanceAgencies, getGuidanceDocTypes } from '@/lib/actions/guidance-documents';
import { GuidanceClient } from '@/components/guidance/GuidanceClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';

interface GuidancePageProps {
  params: Promise<{ state: string }>;
}

export default async function GuidancePage({ params }: GuidancePageProps) {
  const { state } = await params;
  if (!isValidJurisdiction(state)) notFound();

  const stateConfig = JURISDICTION_CONFIG[state];

  const [agenciesResult, docTypesResult] = await Promise.all([
    getGuidanceAgencies(state),
    getGuidanceDocTypes(state),
  ]);

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Guidance Documents`}
        description="Sub-regulatory policy directives, advisories, and informational letters from state agencies"
      />
      <Container size="2xl" className="py-6">
        <GuidanceClient
          jurisdiction={state}
          agencies={agenciesResult.success ? agenciesResult.data : []}
          docTypes={docTypesResult.success ? docTypesResult.data : []}
        />
      </Container>
    </div>
  );
}
