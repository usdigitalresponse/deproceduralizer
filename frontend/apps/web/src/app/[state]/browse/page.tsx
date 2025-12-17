import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import {
  db,
  RegulatoryDocumentsRepository,
  type HierarchyFilterOptions,
  type StateCode,
} from '@deproceduralizer/database';
import { BrowseClient } from '@/components/browse';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { HierarchyTreeSkeleton } from '@/components/browse/HierarchyTree';
import { Card } from '@/components/ui/Card';
import { isValidState, STATE_CONFIG } from '@/types/state';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<{
    analyzed?: string;
    hasFlags?: string;
    severity?: string;
    hasDefs?: string;
    hasCompliance?: string;
    selected?: string;
    search?: string;
  }>;
}

// Parse boolean filter from URL param
function parseBooleanParam(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export default async function BrowsePage({ params, searchParams }: PageProps) {
  const { state } = await params;
  const queryParams = await searchParams;

  // Validate state parameter
  if (!isValidState(state)) {
    notFound();
  }

  const stateCode = state as StateCode;
  const stateConfig = STATE_CONFIG[stateCode];

  // Parse filters from URL params - state is always required
  const filters: HierarchyFilterOptions = { state: stateCode };

  const hasAnalysis = parseBooleanParam(queryParams.analyzed);
  if (hasAnalysis !== undefined) filters.hasAnalysis = hasAnalysis;

  const hasFlags = parseBooleanParam(queryParams.hasFlags);
  if (hasFlags !== undefined) filters.hasFlags = hasFlags;

  if (queryParams.severity && ['high', 'medium', 'low'].includes(queryParams.severity)) {
    filters.severity = queryParams.severity as HierarchyFilterOptions['severity'];
  }

  const hasDefinitions = parseBooleanParam(queryParams.hasDefs);
  if (hasDefinitions !== undefined) filters.hasDefinitions = hasDefinitions;

  const hasComplianceIssues = parseBooleanParam(queryParams.hasCompliance);
  if (hasComplianceIssues !== undefined) filters.hasComplianceIssues = hasComplianceIssues;

  // Parse search term
  const search = queryParams.search?.trim() || '';
  if (search) {
    filters.search = search;
  }

  // Check if any filters are active (beyond just state)
  const hasActiveFilters = Boolean(
    search ||
    filters.hasAnalysis !== undefined ||
    filters.hasFlags !== undefined ||
    filters.severity !== undefined ||
    filters.hasDefinitions !== undefined ||
    filters.hasComplianceIssues !== undefined
  );

  // Fetch data filtered by state
  const repo = new RegulatoryDocumentsRepository(db);

  // Use fast queries when no filters active (uses precomputed stats)
  // This is especially important for NJ which has 61k+ documents
  const [roots, orphans, stats] = await Promise.all([
    hasActiveFilters
      ? repo.getHierarchyRoots(filters)
      : repo.getHierarchyRootsFast(stateCode),
    repo.getOrphanDocuments(filters),
    repo.getHierarchyStats(filters),
  ]);

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`Browse ${stateConfig.name} Regulations`}
        description={`Navigate the ${stateConfig.regulationsLabel} hierarchy by title, chapter, part, and section`}
      />

      <Container size="2xl" className="py-6">
        <Suspense fallback={<BrowsePageSkeleton />}>
          <BrowseClient
            state={stateCode}
            initialRoots={roots}
            initialOrphans={orphans}
            stats={stats}
            filters={filters}
            search={search}
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
