import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

/**
 * Loading skeleton for the pipeline detail page.
 * Shows header card skeleton and timeline placeholder.
 */
export default function PipelineDetailLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title="Pipeline: Loading..."
        description="Loading analysis details..."
      />

      <Container size="2xl" className="py-6">
        {/* Navigation skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 w-40 bg-[var(--color-neutral-200)] rounded animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-8 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            <div className="h-5 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
          </div>
        </div>

        {/* Header Card skeleton */}
        <Card padding="lg" className="mb-6">
          {/* Badges row */}
          <div className="flex flex-wrap items-start gap-4 mb-4">
            <div className="h-7 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            <div className="h-6 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            <div className="h-6 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
          </div>

          {/* Title */}
          <div className="h-7 w-3/4 bg-[var(--color-neutral-200)] rounded animate-pulse mb-2" />
          <div className="h-5 w-1/3 bg-[var(--color-neutral-200)] rounded animate-pulse mb-4" />

          {/* Tier Classification Flow skeleton */}
          <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
            <div className="flex items-center gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-12 h-12 bg-[var(--color-neutral-100)] rounded-full animate-pulse" />
                  {i < 3 && (
                    <div className="w-8 h-1 bg-[var(--color-neutral-200)] animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Stats row skeleton */}
          <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)] grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-3 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse mb-2" />
                <div className="h-8 w-12 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </Card>

        {/* Timeline skeleton */}
        <Card padding="lg">
          <div className="space-y-6">
            {[...Array(3)].map((_, tierIndex) => (
              <div key={tierIndex} className="space-y-4">
                {/* Tier header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--color-neutral-200)] rounded-full animate-pulse" />
                  <div className="h-6 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                {/* Tier content */}
                <div className="ml-12 space-y-3">
                  <div className="h-4 w-full bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="h-4 w-4/6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Metadata skeleton */}
        <div className="mt-6 flex flex-wrap gap-4">
          <div className="h-4 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
          <div className="h-4 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
          <div className="h-4 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
        </div>
      </Container>
    </div>
  );
}
