import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

/**
 * Loading skeleton for the pipeline page.
 * Shows tier stats, filter bar, and table skeleton.
 */
export default function PipelineLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title="Research Pipeline"
        description="View research pipeline progression, tier distributions, and classification outcomes"
      />

      <Container size="2xl" className="py-6">
        <div className="space-y-6">
          {/* Tier stats cards skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="text-center p-4">
                <div className="h-3 w-16 mx-auto bg-[var(--color-neutral-200)] rounded animate-pulse mb-2" />
                <div className="h-8 w-12 mx-auto bg-[var(--color-neutral-200)] rounded animate-pulse" />
              </Card>
            ))}
          </div>

          {/* Filter bar skeleton */}
          <Card padding="md">
            <div className="flex flex-wrap items-center gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-12 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-9 w-28 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                </div>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <div className="h-8 w-20 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-8 w-8 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              </div>
            </div>
          </Card>

          {/* Table skeleton */}
          <Card padding="none">
            {/* Table header */}
            <div className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)] px-4 py-3">
              <div className="flex items-center gap-4">
                <div className="w-8 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-24 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="flex-1 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-12 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-12 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-12 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-16 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-16 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              </div>
            </div>
            {/* Table rows */}
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="border-b border-[var(--color-neutral-100)] px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="w-24 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-4 w-3/4 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  </div>
                  <div className="w-12 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="w-12 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="w-12 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="w-8 h-8 bg-[var(--color-neutral-100)] rounded-full animate-pulse" />
                  <div className="w-12 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                </div>
              </div>
            ))}
            {/* Pagination skeleton */}
            <div className="bg-[var(--color-neutral-50)] border-t border-[var(--color-neutral-200)] px-4 py-3 flex items-center justify-between">
              <div className="h-4 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-4 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-8 w-8 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              </div>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
