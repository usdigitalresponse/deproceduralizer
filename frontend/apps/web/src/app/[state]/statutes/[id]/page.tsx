import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Alert } from '@/components/ui';
import { getStatuteWithLinks, getStatuteAncestorChain, getStatuteHierarchyChildren } from '@/lib/actions/statutes';
import { StatuteDetailSidebar } from './StatuteDetailSidebar';
import { StatuteDetailContent } from './StatuteDetailContent';
import { RegulationDetailLayout } from '@/app/[state]/regulations/[id]/RegulationDetailLayout';
import { isValidState } from '@/types/state';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ state: string; id: string }>;
  searchParams: Promise<{ from?: string; highlight?: string }>;
}

export default async function StatuteDetailPage({ params, searchParams }: PageProps) {
  const { state, id } = await params;
  const { from, highlight } = await searchParams;

  if (!isValidState(state)) {
    notFound();
  }

  const statuteId = parseInt(id, 10);
  if (isNaN(statuteId)) {
    notFound();
  }

  const backUrl = from ? decodeURIComponent(from) : `/${state}/statutes`;

  // Fetch all data in parallel with partial success
  const [statuteResult, ancestorsResult, childrenResult] = await Promise.allSettled([
    getStatuteWithLinks(statuteId),
    getStatuteAncestorChain(statuteId),
    getStatuteHierarchyChildren(statuteId),
  ]);

  // Statute is required
  const statuteData = statuteResult.status === 'fulfilled' ? statuteResult.value : null;
  if (!statuteData?.success || !statuteData.data) {
    return (
      <div className="bg-[var(--color-background)] min-h-screen">
        <PageHeader title="Error Loading Statute" description={undefined} />
        <Container size="xl" className="py-6">
          <Alert variant="error">
            Failed to load statute: {statuteData?.success === false ? statuteData.error : 'Unknown error'}
          </Alert>
        </Container>
      </div>
    );
  }

  const statute = statuteData.data;

  // Optional data with fallbacks
  const ancestors = ancestorsResult.status === 'fulfilled' && ancestorsResult.value.success
    ? ancestorsResult.value.data
    : [];

  const children = childrenResult.status === 'fulfilled' && childrenResult.value.success
    ? childrenResult.value.data
    : [];

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={statute.title || 'Untitled Statute'}
        description={statute.citation}
      />

      <Container size="xl" className="py-6">
        <RegulationDetailLayout
          sidebar={
            <StatuteDetailSidebar
              statute={statute}
              state={state}
              backUrl={backUrl}
              ancestors={ancestors}
              childStatutes={children}
            />
          }
          content={
            <StatuteDetailContent
              content={statute.content}
              initialHighlight={highlight}
            />
          }
        />
      </Container>
    </div>
  );
}
