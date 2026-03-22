import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { getFinesOverviewStats, getFinesAgencies, getFinesWhoPays, getFinesPerUnits } from '@/lib/actions/fines';
import { getBookmarkCounts } from '@/lib/actions/bookmarks';
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

  const [statsResult, agenciesResult, whoPaysResult, perUnitsResult, bookmarkCountsResult] = await Promise.all([
    getFinesOverviewStats(stateCode),
    getFinesAgencies(stateCode),
    getFinesWhoPays(stateCode),
    getFinesPerUnits(stateCode),
    getBookmarkCounts(stateCode),
  ]);

  const stats = statsResult.success ? statsResult.data : null;
  const agencies = agenciesResult.success ? agenciesResult.data : [];
  const whoPaysValues = whoPaysResult.success ? whoPaysResult.data : [];
  const perUnitValues = perUnitsResult.success ? perUnitsResult.data : [];
  const fineBookmarkCount = bookmarkCountsResult.success ? bookmarkCountsResult.data.fine : 0;

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Fines & Fees`}
        description="Comprehensive schedule of fines, fees, penalties, and surcharges across regulations and guidance"
        actions={
          fineBookmarkCount > 0 ? (
            <Link
              href={`/${state}/bookmarks?tab=fine`}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:underline"
            >
              <Star className="w-4 h-4" />
              View Marked Fines ({fineBookmarkCount})
            </Link>
          ) : undefined
        }
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
