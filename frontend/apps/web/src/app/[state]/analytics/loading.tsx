import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

/**
 * Loading skeleton for the analytics page.
 * Shows tab navigation skeleton, stat cards, and chart placeholders.
 */
export default function AnalyticsLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title="Analytics"
        description="Comprehensive analytics, patterns, and insights across regulatory data"
      />

      <Container size="2xl" className="py-6">
        <div className="space-y-6">
          {/* Tab navigation skeleton */}
          <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] w-fit">
            {[...Array(4)].map((_, i) => (
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
                  <div className="h-2 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              </Card>
            ))}
          </div>

          {/* Charts row skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut chart placeholder */}
            <Card padding="lg" className="min-h-[300px]">
              <div className="space-y-4">
                <div className="h-5 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-3 w-64 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="flex justify-center items-center py-8">
                  <div className="w-48 h-48 rounded-full border-[16px] border-[var(--color-neutral-200)] animate-pulse" />
                </div>
                <div className="flex justify-center gap-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[var(--color-neutral-300)] rounded-full animate-pulse" />
                      <div className="h-3 w-12 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Progress bars placeholder */}
            <Card padding="lg" className="min-h-[300px]">
              <div className="space-y-6">
                <div className="h-5 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <div className="h-4 w-20 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                      <div className="h-4 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    </div>
                    <div className="h-3 bg-[var(--color-neutral-200)] rounded-full animate-pulse" />
                    <div className="flex gap-4">
                      <div className="h-3 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                      <div className="h-3 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Summary stats skeleton */}
          <Card padding="lg">
            <div className="space-y-4">
              <div className="h-5 w-36 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="text-center p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)]"
                  >
                    <div className="h-8 w-12 mx-auto bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    <div className="h-3 w-24 mx-auto mt-2 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
