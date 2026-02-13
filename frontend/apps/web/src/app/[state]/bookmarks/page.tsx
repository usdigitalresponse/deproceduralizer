import { notFound } from 'next/navigation';
import { getBookmarks, getBookmarkCounts } from '@/lib/actions/bookmarks';
import { BookmarksContent } from '@/components/bookmarks/BookmarksContent';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { STATE_CONFIG, isValidState } from '@/types/state';

interface BookmarksPageProps {
  params: Promise<{ state: string }>;
}

export default async function BookmarksPage({ params }: BookmarksPageProps) {
  const { state } = await params;

  if (!isValidState(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = STATE_CONFIG[state];

  // Fetch bookmarks and counts
  const [bookmarksResult, countsResult] = await Promise.all([
    getBookmarks(stateCode),
    getBookmarkCounts(stateCode),
  ]);

  const bookmarks = bookmarksResult.success ? bookmarksResult.data : [];
  const counts = countsResult.success ? countsResult.data : { analysis: 0, document: 0, total: 0 };

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Bookmarks`}
        description="View and manage your bookmarked analyses and documents"
      />
      <Container size="2xl" className="py-6">
        <BookmarksContent
          bookmarks={bookmarks}
          counts={counts}
          state={stateCode}
        />
      </Container>
    </div>
  );
}
