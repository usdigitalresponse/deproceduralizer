import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';

export default function RegulationDetailLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      {/* PageHeader skeleton */}
      <div className="bg-[var(--color-primary-weaker)] py-8 border-b border-[var(--color-neutral-200)]">
        <Container size="xl">
          <div className="h-8 w-96 bg-[var(--color-neutral-300)] rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse" />
        </Container>
      </div>

      <Container size="xl" className="py-6">
        {/* Back button skeleton */}
        <div className="mb-6">
          <div className="h-8 w-40 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
        </div>

        <div className="space-y-6">
          {/* Hierarchy info skeleton */}
          <Card>
            <div className="h-5 w-40 bg-[var(--color-neutral-200)] rounded animate-pulse mb-3" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-4 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              ))}
            </div>
          </Card>

          {/* Analysis overview skeleton */}
          <Card>
            <div className="h-5 w-40 bg-[var(--color-neutral-200)] rounded animate-pulse mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-20 bg-[var(--color-neutral-200)] rounded animate-pulse mb-1" />
                  <div className="h-6 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              ))}
            </div>
          </Card>

          {/* Summary skeleton */}
          <Card>
            <div className="h-5 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="h-4 w-full bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            </div>
          </Card>

          {/* Compliance issues skeleton */}
          <Card>
            <div className="h-5 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 border border-[var(--color-neutral-200)] rounded-[var(--radius-md)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-4 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    <div className="h-5 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    <div className="h-3 w-2/3 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Full text skeleton */}
          <Card>
            <div className="h-5 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse mb-3" />
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-4 w-full bg-[var(--color-neutral-200)] rounded animate-pulse" />
              ))}
              <div className="h-4 w-1/2 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
