import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';

export default function StatuteDetailLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title="Loading Statute..."
        description={undefined}
      />
      <Container size="xl" className="py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <aside className="space-y-4">
            <div className="h-9 w-40 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            <Card className="p-4">
              <div className="space-y-3">
                <div className="h-4 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-6 w-full bg-[var(--color-neutral-100)] rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-[var(--color-neutral-100)] rounded animate-pulse" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="space-y-3">
                <div className="h-4 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-4 w-full bg-[var(--color-neutral-100)] rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-[var(--color-neutral-100)] rounded animate-pulse" />
              </div>
            </Card>
          </aside>
          <main>
            <Card className="p-6">
              <div className="space-y-3">
                <div className="h-6 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-40 w-full bg-[var(--color-neutral-100)] rounded animate-pulse" />
              </div>
            </Card>
          </main>
        </div>
      </Container>
    </div>
  );
}
