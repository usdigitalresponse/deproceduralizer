import { notFound } from 'next/navigation';
import { getBarrierBurdenStats, getBarrierCategories, getBarrierParts, getBarrierSectionTypes } from '@/lib/actions/barrier';
import { BurdenClient } from '@/components/burden/BurdenClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';

interface BurdenPageProps {
  params: Promise<{ state: string }>;
}

export default async function BurdenPage({ params }: BurdenPageProps) {
  const { state } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateConfig = JURISDICTION_CONFIG[state];

  const [statsResult, categoriesResult, partsResult, sectionTypesResult] = await Promise.all([
    getBarrierBurdenStats(state),
    getBarrierCategories(state),
    getBarrierParts(state),
    getBarrierSectionTypes(state),
  ]);

  const stats = statsResult.success ? statsResult.data : null;
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const parts = partsResult.success ? partsResult.data : [];
  const sectionTypes = sectionTypesResult.success ? sectionTypesResult.data : [];

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Burden Index`}
        description="Composite burden scores ranking regulatory sections by aggregate implementation difficulty"
      />
      <Container size="2xl" className="py-6">
        <BurdenClient
          jurisdiction={state}
          stats={stats}
          categories={categories}
          parts={parts}
          sectionTypes={sectionTypes}
        />
      </Container>
    </div>
  );
}
