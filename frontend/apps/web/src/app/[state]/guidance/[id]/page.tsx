import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getGuidanceById, getGuidanceSupersedureChain } from '@/lib/actions/guidance-documents';
import { GuidanceDetailSidebar } from '@/components/guidance/GuidanceDetailSidebar';
import { GuidanceDetailContent } from '@/components/guidance/GuidanceDetailContent';
import { SupersedureChain } from '@/components/guidance/SupersedureChain';
import { GuidanceStatusBadge } from '@/components/guidance/GuidanceStatusBadge';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { isValidJurisdiction } from '@/types/state';

interface GuidanceDetailPageProps {
  params: Promise<{ state: string; id: string }>;
}

export default async function GuidanceDetailPage({ params }: GuidanceDetailPageProps) {
  const { state, id } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const docId = parseInt(id, 10);
  if (isNaN(docId)) {
    notFound();
  }

  const [result, supersedureResult] = await Promise.all([
    getGuidanceById(docId),
    getGuidanceSupersedureChain(docId),
  ]);

  if (!result.success || !result.data) {
    notFound();
  }

  const doc = result.data;
  const supersedureLinks = supersedureResult.success ? supersedureResult.data : [];

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={doc.title}
        description={doc.canonicalRef ?? undefined}
        actions={
          <div className="flex items-center gap-3">
            <Link
              href={`/${state}/guidance`}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Guidance
            </Link>
            <GuidanceStatusBadge status={doc.status} />
          </div>
        }
      />
      <Container size="2xl" className="py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <GuidanceDetailContent doc={doc} />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <GuidanceDetailSidebar doc={doc} />
            {supersedureLinks.length > 0 && (
              <SupersedureChain
                links={supersedureLinks}
                state={state}
              />
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
