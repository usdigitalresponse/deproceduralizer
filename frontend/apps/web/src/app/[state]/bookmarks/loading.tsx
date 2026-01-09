import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

/**
 * Loading skeleton for the bookmarks page.
 * Shows tabs and table skeleton.
 */
export default function BookmarksLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title="Bookmarks"
        description="View and manage your bookmarked analyses and documents"
      />

      <Container size="2xl" className="py-6">
        <div className="space-y-6">
          {/* Tab navigation skeleton */}
          <div className="flex gap-2 border-b border-[var(--color-neutral-200)]">
            <div className="flex items-center gap-2 px-4 py-2 -mb-px border-b-2 border-[var(--color-primary)]">
              <div className="w-4 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="h-4 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="h-5 w-8 bg-[var(--color-neutral-200)] rounded-full animate-pulse" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2">
              <div className="w-4 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="h-4 w-20 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="h-5 w-8 bg-[var(--color-neutral-200)] rounded-full animate-pulse" />
            </div>
          </div>

          {/* Table skeleton */}
          <Card padding="none">
            {/* Table header */}
            <div className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)] px-4 py-3">
              <div className="flex items-center gap-4">
                <div className="w-20 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="flex-1 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-16 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-24 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-32 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-20 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-16 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              </div>
            </div>
            {/* Table rows */}
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="border-b border-[var(--color-neutral-100)] px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <div className="w-20 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-4 w-3/4 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  </div>
                  <div className="w-8 h-8 bg-[var(--color-neutral-100)] rounded-full animate-pulse" />
                  <div className="w-16 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="w-32 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="w-20 h-4 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                    <div className="w-6 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </Container>
    </div>
  );
}
