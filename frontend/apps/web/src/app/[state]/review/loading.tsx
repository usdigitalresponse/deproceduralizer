import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

export default function ReviewLoading() {
  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title="Review Mode"
        description="Efficiently triage compliance issues identified by analysis"
      />

      <Container size="2xl" className="py-6">
        <div className="space-y-6">
          {/* Progress skeleton */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="h-4 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            </div>
            <div className="h-2 bg-[var(--color-neutral-200)] rounded-full mb-4" />
            <div className="flex gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-3 w-20 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              ))}
            </div>
          </Card>

          {/* Filters skeleton */}
          <div className="flex flex-wrap items-center gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-9 w-32 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
            ))}
          </div>

          {/* Results info skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-4 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            <div className="h-4 w-40 bg-[var(--color-neutral-200)] rounded animate-pulse" />
          </div>

          {/* Card skeletons */}
          {[...Array(3)].map((_, i) => (
            <Card key={i} padding="md">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="h-5 w-40 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-5 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    <div className="h-5 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  </div>
                </div>

                {/* Citation line */}
                <div className="h-4 w-64 bg-[var(--color-neutral-200)] rounded animate-pulse" />

                {/* Explanation block */}
                <div className="p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border-l-4 border-[var(--color-neutral-300)]">
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    <div className="h-3 w-3/4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  </div>
                </div>

                {/* Form skeleton */}
                <div className="pt-4 border-t border-[var(--color-neutral-200)]">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    {[...Array(4)].map((_, j) => (
                      <div key={j}>
                        <div className="h-3 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse mb-1" />
                        <div className="h-9 w-full bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
                      </div>
                    ))}
                  </div>
                  <div className="h-16 w-full bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse mb-3" />
                  <div className="flex justify-between">
                    <div className="h-8 w-28 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
                    <div className="h-8 w-24 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </div>
  );
}
