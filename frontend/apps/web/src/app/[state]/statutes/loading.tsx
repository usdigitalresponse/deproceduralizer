import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';

export default function StatuteBrowseLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title="Browse Statutes"
        description="Navigate the statutory hierarchy"
      />

      <Container size="2xl" className="py-6">
        <div className="space-y-4">
          {/* Filters skeleton */}
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            ))}
          </div>

          {/* Main content skeleton */}
          <div className="flex gap-6">
            <div className="w-[400px] shrink-0">
              <Card padding="none" className="h-[calc(100vh-16rem)]">
                <div className="p-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 py-1.5 px-2 animate-pulse"
                      style={{ paddingLeft: '8px' }}
                    >
                      <span className="w-5 shrink-0" />
                      <div className="w-4 h-4 bg-[var(--color-neutral-200)] rounded shrink-0" />
                      <div className="flex-1">
                        <div className="h-4 bg-[var(--color-neutral-200)] rounded w-3/4 mb-1" />
                        <div className="h-3 bg-[var(--color-neutral-100)] rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div className="flex-1">
              <Card className="h-[calc(100vh-16rem)] flex items-center justify-center">
                <div className="text-center text-[var(--color-text-muted)]">
                  <div className="w-12 h-12 bg-[var(--color-neutral-200)] rounded mx-auto mb-3 animate-pulse" />
                  <div className="h-4 w-32 bg-[var(--color-neutral-200)] rounded mx-auto animate-pulse" />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
