import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

export default function IbrLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title="Standards (IBR)"
        description="External standards incorporated by reference into state regulations"
      />

      <Container size="2xl" className="py-6">
        <div className="space-y-6">
          {/* Tab navigation skeleton */}
          <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] w-fit">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]"
              >
                <div className="h-4 w-4 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                <div className="h-4 w-16 bg-[var(--color-neutral-300)] rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Stat cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="flex items-center gap-4">
                <div className="p-3 rounded-[var(--radius-lg)] bg-[var(--color-neutral-100)]">
                  <div className="w-6 h-6 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-6 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              </Card>
            ))}
          </div>

          {/* Charts row skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card padding="lg" className="min-h-[250px]">
              <div className="h-5 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse mb-4" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 mb-2">
                  <div className="h-4 w-20 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="flex-1 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                </div>
              ))}
            </Card>
            <Card padding="lg" className="min-h-[250px]">
              <div className="h-5 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse mb-4" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-[var(--color-neutral-100)] rounded animate-pulse mb-2" />
              ))}
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
