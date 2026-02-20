import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';
import { TreeNodeSkeleton } from '@/components/browse/TreeNode';

export default function BrowseLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title="Browse Regulations"
        description="Navigate the regulatory hierarchy by title, chapter, part, and section"
      />

      <Container size="2xl" className="py-6">
        <div className="space-y-4">
          {/* Filters skeleton */}
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            ))}
          </div>

          {/* Main content skeleton */}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            <div className="w-full lg:w-[400px] lg:shrink-0">
              <Card padding="none" className="h-[40vh] lg:h-[calc(100vh-16rem)]">
                <div className="p-2">
                  <TreeNodeSkeleton depth={0} count={8} />
                </div>
              </Card>
            </div>
            <div className="hidden lg:flex flex-1">
              <Card className="h-[calc(100vh-16rem)] flex items-center justify-center w-full">
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
