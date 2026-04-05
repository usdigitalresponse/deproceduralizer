import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

/**
 * Loading skeleton for the analytics page.
 * Matches the current layout: tab navigation, source toggle, stat cards,
 * classification filter, charts row, and breakdown table.
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
          {/* Tab navigation + source toggle skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] w-fit">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]"
                >
                  <div className="h-4 w-4 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                  <div className="h-4 w-14 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)]">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)]">
                  <div className="h-3.5 w-3.5 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                  <div className="h-3.5 w-16 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Stat cards skeleton (3 columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="flex items-center gap-4">
                <div className="p-3 rounded-[var(--radius-lg)] bg-[var(--color-neutral-100)]">
                  <div className="w-6 h-6 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-7 w-20 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-2 w-36 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              </Card>
            ))}
          </div>

          {/* Classification filter skeleton */}
          <div className="flex items-center gap-3">
            <div className="h-4 w-10 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)]">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-3 py-1.5 rounded-[var(--radius-md)]">
                  <div className="h-3.5 w-16 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Charts row skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut chart placeholder */}
            <Card padding="lg" className="min-h-[300px]">
              <div className="space-y-4">
                <div className="h-5 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-3 w-56 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="flex justify-center items-center py-8">
                  <div className="w-48 h-48 rounded-full border-[16px] border-[var(--color-neutral-200)] animate-pulse" />
                </div>
                <div className="flex justify-center gap-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[var(--color-neutral-300)] rounded-full animate-pulse" />
                      <div className="h-3 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Bar chart placeholder */}
            <Card padding="lg" className="min-h-[300px]">
              <div className="space-y-4">
                <div className="h-5 w-44 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="space-y-3 pt-4">
                  {[150, 130, 110, 100, 85, 70, 55, 35].map((width, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-3 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse flex-shrink-0" />
                      <div
                        className="h-6 bg-[var(--color-neutral-200)] rounded animate-pulse"
                        style={{ width: `${width}px` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Human review progress skeleton */}
          <Card padding="lg">
            <div className="space-y-4">
              <div className="h-5 w-40 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-4 w-36 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="h-3 bg-[var(--color-neutral-200)] rounded-full animate-pulse" />
              </div>
            </div>
          </Card>

          {/* Severity donuts skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <Card key={i} padding="lg">
                <div className="space-y-4">
                  <div className="h-5 w-40 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="flex justify-center py-4">
                    <div className="w-40 h-40 rounded-full border-[12px] border-[var(--color-neutral-200)] animate-pulse" />
                  </div>
                  <div className="flex justify-center gap-6">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-[var(--color-neutral-300)] rounded-full animate-pulse" />
                        <div className="h-3 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Data coverage skeleton */}
          <Card padding="lg">
            <div className="space-y-4">
              <div className="h-5 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="text-center p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)]"
                  >
                    <div className="h-8 w-14 mx-auto bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    <div className="h-3 w-20 mx-auto mt-2 bg-[var(--color-neutral-200)] rounded animate-pulse" />
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
