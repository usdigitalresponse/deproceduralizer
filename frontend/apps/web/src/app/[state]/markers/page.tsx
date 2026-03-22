import { notFound } from 'next/navigation';
import { getBookmarks, getBookmarkCounts } from '@/lib/actions/bookmarks';
import { getMarkerGroups } from '@/lib/actions/marker-groups';
import { MarkersContent } from '@/components/markers/MarkersContent';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';

interface MarkersPageProps {
  params: Promise<{ state: string }>;
}

export default async function MarkersPage({ params }: MarkersPageProps) {
  const { state } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = JURISDICTION_CONFIG[state];

  const [bookmarksResult, countsResult, groupsResult] = await Promise.all([
    getBookmarks(stateCode),
    getBookmarkCounts(stateCode),
    getMarkerGroups(stateCode),
  ]);

  const bookmarks = bookmarksResult.success ? bookmarksResult.data : [];
  const counts = countsResult.success ? countsResult.data : { analysis: 0, document: 0, guidance: 0, fine: 0, total: 0 };
  const markerGroups = groupsResult.success ? groupsResult.data : [];

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Labels`}
        description="View and manage your marked analyses, documents, and fines"
      />
      <Container size="2xl" className="py-6">
        <MarkersContent
          bookmarks={bookmarks}
          counts={counts}
          jurisdiction={stateCode}
          markerGroups={markerGroups}
        />
      </Container>
    </div>
  );
}
