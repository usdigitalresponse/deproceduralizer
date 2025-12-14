import { Suspense } from 'react';
import {
  db,
  RegulatoryDocumentsRepository,
  type HierarchyFilterOptions,
} from '@deproceduralizer/database';
import { BrowseClient } from '@/components/browse';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { HierarchyTreeSkeleton } from '@/components/browse/HierarchyTree';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    analyzed?: string;
    hasFlags?: string;
    severity?: string;
    hasDefs?: string;
    selected?: string;
  }>;
}

// Parse boolean filter from URL param
function parseBooleanParam(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Parse filters from URL params
  const filters: HierarchyFilterOptions = {};

  const hasAnalysis = parseBooleanParam(params.analyzed);
  if (hasAnalysis !== undefined) filters.hasAnalysis = hasAnalysis;

  const hasFlags = parseBooleanParam(params.hasFlags);
  if (hasFlags !== undefined) filters.hasFlags = hasFlags;

  if (params.severity && ['high', 'medium', 'low'].includes(params.severity)) {
    filters.severity = params.severity as HierarchyFilterOptions['severity'];
  }

  const hasDefinitions = parseBooleanParam(params.hasDefs);
  if (hasDefinitions !== undefined) filters.hasDefinitions = hasDefinitions;

  // Fetch data
  const repo = new RegulatoryDocumentsRepository(db);
  const [roots, orphans, stats] = await Promise.all([
    repo.getHierarchyRoots(filters),
    repo.getOrphanDocuments(filters),
    repo.getHierarchyStats(filters),
  ]);

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title="Browse Regulations"
        description="Navigate the regulatory hierarchy by title, chapter, part, and section"
      />

      <Container size="2xl" className="py-6">
        <Suspense fallback={<BrowsePageSkeleton />}>
          <BrowseClient
            initialRoots={roots}
            initialOrphans={orphans}
            stats={stats}
            filters={filters}
          />
        </Suspense>
      </Container>
    </div>
  );
}

function BrowsePageSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters skeleton */}
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="flex gap-6">
        <div className="w-[400px] shrink-0">
          <Card padding="none" className="h-[calc(100vh-16rem)]">
            <HierarchyTreeSkeleton />
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
  );
}
