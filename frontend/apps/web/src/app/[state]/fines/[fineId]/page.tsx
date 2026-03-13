import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getFineById } from '@/lib/actions/fines';
import { FineDetailContent } from '@/components/fines/FineDetailContent';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { isValidJurisdiction } from '@/types/state';
import { PENALTY_TYPE_LABELS } from '@/lib/constants/fines';
import { FineBookmarkProvider, FineDetailBookmark, FineDetailNotesCard } from '@/components/fines/FineDetailBookmark';

interface FineDetailPageProps {
  params: Promise<{ state: string; fineId: string }>;
}

export default async function FineDetailPage({ params }: FineDetailPageProps) {
  const { state, fineId: fineIdStr } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const fineId = parseInt(fineIdStr, 10);
  if (isNaN(fineId)) {
    notFound();
  }

  const result = await getFineById(fineId);

  if (!result.success || !result.data) {
    notFound();
  }

  const fine = result.data;
  const penaltyLabel = PENALTY_TYPE_LABELS[fine.penaltyType] || fine.penaltyType;
  const title = `${penaltyLabel}: ${fine.amount || 'Amount not specified'}`;

  return (
    <FineBookmarkProvider fineId={fine.id} jurisdiction={state}>
      <div className="bg-[var(--color-background)] min-h-screen">
        <PageHeader
          title={title}
          description={fine.agencyCanonicalName ?? fine.responsibleAgency ?? undefined}
          breadcrumb={
            <Link
              href={`/${state}/fines?tab=browse`}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Fines
            </Link>
          }
          actions={<FineDetailBookmark fineId={fine.id} jurisdiction={state} />}
        />
        <Container size="2xl" className="py-6">
          <FineDetailNotesCard />
          <FineDetailContent fine={fine} state={state} />
        </Container>
      </div>
    </FineBookmarkProvider>
  );
}
