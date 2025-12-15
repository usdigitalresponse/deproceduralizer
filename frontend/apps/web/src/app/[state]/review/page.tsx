import { redirect, notFound } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { ReviewQueue } from '@/components/review';
import {
  getRedFlagsPaginated,
  getRedFlagStatusCounts,
  getRedFlagCategories,
} from '@/lib/actions/red-flags';
import type { RedFlagFilterOptions, StateCode } from '@deproceduralizer/database';
import { isValidState, STATE_CONFIG } from '@/types/state';

interface PageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<{
    status?: string;
    severity?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
  }>;
}

export default async function ReviewPage({ params, searchParams }: PageProps) {
  const { state } = await params;
  const queryParams = await searchParams;

  // Validate state parameter
  if (!isValidState(state)) {
    notFound();
  }

  const stateCode = state as StateCode;
  const stateConfig = STATE_CONFIG[stateCode];

  // Default to showing unreviewed flags
  if (!queryParams.status) {
    redirect(`/${state}/review?status=unreviewed`);
  }

  // Parse pagination params
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const pageSize = 10;
  const sortBy = (queryParams.sortBy || 'severity') as 'severity' | 'category' | 'reviewedAt';
  const sortOrder = (queryParams.sortOrder || 'desc') as 'asc' | 'desc';

  // Parse filter params
  const filters: Omit<RedFlagFilterOptions, 'state'> = {
    status: queryParams.status === 'all' ? 'all' : (queryParams.status as RedFlagFilterOptions['status']),
    severity: queryParams.severity as 'high' | 'medium' | 'low' | undefined,
    category: queryParams.category || undefined,
  };

  // Fetch data in parallel - all calls now require state
  const [flagsResult, statusCounts, categories] = await Promise.all([
    getRedFlagsPaginated(stateCode, {
      page,
      pageSize,
      sortBy,
      sortOrder,
      filters: {
        status: filters.status,
        severity: filters.severity,
        category: filters.category,
      },
    }),
    getRedFlagStatusCounts(stateCode),
    getRedFlagCategories(stateCode),
  ]);

  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title={`Review ${stateConfig.name} Regulations`}
        description={`Efficiently triage red flags identified in ${stateConfig.regulationsLabel}`}
      />

      <Container size="2xl" className="py-6">
        <ReviewQueue
          initialFlags={flagsResult.data}
          pagination={{
            page: flagsResult.page,
            pageSize: flagsResult.pageSize,
            total: flagsResult.total,
            totalPages: flagsResult.totalPages,
          }}
          statusCounts={statusCounts}
          categories={categories}
          currentFilters={filters}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </Container>
    </div>
  );
}
