import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

export default function DefinitionsLoading() {
  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title="Definitions"
        description="Browse regulatory definitions"
      />

      <Container size="2xl" className="py-6">
        <div className="space-y-6">
          {/* Stats card skeleton */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-6 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="h-5 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
                  <div className="h-8 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse mb-1" />
                  <div className="h-4 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              ))}
            </div>
          </Card>

          {/* Search and A-Z filter skeleton */}
          <Card>
            <div className="space-y-4">
              {/* Search input skeleton */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-10 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
              </div>

              {/* A-Z bar skeleton */}
              <div className="flex flex-wrap gap-1">
                <div className="h-7 w-10 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                {[...Array(26)].map((_, i) => (
                  <div key={i} className="h-7 w-8 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                ))}
              </div>
            </div>
          </Card>

          {/* Results summary skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-4 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            <div className="h-4 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
          </div>

          {/* Definition card skeletons */}
          {[...Array(5)].map((_, i) => (
            <Card key={i} padding="md">
              <div className="space-y-3">
                {/* Term header */}
                <div className="flex items-center gap-2">
                  <div className="h-5 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-5 w-20 bg-[var(--color-neutral-200)] rounded-full animate-pulse" />
                </div>

                {/* Definition text */}
                <div className="space-y-2">
                  <div className="h-4 w-full bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>

                {/* Source link */}
                <div className="pt-3 border-t border-[var(--color-neutral-100)]">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    <div className="h-4 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {/* Pagination skeleton */}
          <div className="flex items-center justify-center gap-2">
            <div className="h-9 w-24 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 w-9 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
            ))}
            <div className="h-9 w-20 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
          </div>
        </div>
      </Container>
    </div>
  );
}
