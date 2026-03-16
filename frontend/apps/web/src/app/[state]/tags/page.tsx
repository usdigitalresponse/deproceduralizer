import { notFound } from 'next/navigation';
import { getTagOverview } from '@/lib/actions/tags';
import { TagsClient } from '@/components/tags/TagsClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';

interface TagsPageProps {
  params: Promise<{ state: string }>;
}

export default async function TagsPage({ params }: TagsPageProps) {
  const { state } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = JURISDICTION_CONFIG[state];

  const overviewResult = await getTagOverview(stateCode);
  const overview = overviewResult.success ? overviewResult.data : null;

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Tag Analytics`}
        description="Cross-domain tag analysis across regulations, guidance, fines, compliance, and JenAI"
      />
      <Container size="2xl" className="py-6">
        <TagsClient
          jurisdiction={stateCode}
          overview={overview}
        />
      </Container>
    </div>
  );
}
