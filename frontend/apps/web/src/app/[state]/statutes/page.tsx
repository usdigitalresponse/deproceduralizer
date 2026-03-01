import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { JurisdictionCode } from '@deproceduralizer/database';
import { StatuteBrowseClient } from '@/components/statutes/StatuteBrowseClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui';
import { isValidJurisdiction, JURISDICTION_CONFIG } from '@/types/state';
import { getStatuteHierarchyRoots } from '@/lib/actions/statutes';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ state: string }>;
}

export default async function StatuteBrowsePage({ params }: PageProps) {
  const { state } = await params;

  // Validate state parameter
  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state as JurisdictionCode;
  const stateConfig = JURISDICTION_CONFIG[stateCode];

  // Fetch root-level statutes
  const result = await getStatuteHierarchyRoots(stateCode.toUpperCase());

  if (!result.success) {
    return (
      <div className="bg-[var(--color-background)] min-h-screen">
        <PageHeader
          title={`Browse ${stateConfig.name} Statutes`}
          description={`Navigate the ${stateConfig.name} statutory hierarchy`}
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">Failed to load statute data: {result.error}</Alert>
        </Container>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`Browse ${stateConfig.name} Statutes`}
        description={`Navigate the ${stateConfig.name} statutory hierarchy by law, title, chapter, and section`}
      />

      <Container size="2xl" className="py-6">
        <Suspense fallback={<StatuteBrowsePageSkeleton />}>
          <StatuteBrowseClient
            jurisdiction={stateCode}
            initialRoots={result.data}
          />
        </Suspense>
      </Container>
    </div>
  );
}

function StatuteBrowsePageSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters skeleton */}
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="w-full lg:w-[400px] lg:shrink-0">
          <Card padding="none" className="h-[40vh] lg:h-[calc(100vh-16rem)]">
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
  );
}
