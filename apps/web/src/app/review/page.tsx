import { redirect } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { ReviewQueue } from '@/components/review';
import {
  getRedFlagsPaginated,
  getRedFlagStatusCounts,
  getRedFlagCategories,
} from '@/lib/actions/red-flags';
import type { RedFlagFilterOptions } from '@deproceduralizer/database';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    severity?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
  }>;
}

export default async function ReviewPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Default to showing unreviewed flags
  if (!params.status) {
    redirect('/review?status=unreviewed');
  }

  // Parse pagination params
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = 10;
  const sortBy = (params.sortBy || 'severity') as 'severity' | 'category' | 'reviewedAt';
  const sortOrder = (params.sortOrder || 'desc') as 'asc' | 'desc';

  // Parse filter params
  const filters: RedFlagFilterOptions = {
    status: params.status === 'all' ? 'all' : (params.status as RedFlagFilterOptions['status']),
    severity: params.severity as 'high' | 'medium' | 'low' | undefined,
    category: params.category || undefined,
  };

  // Fetch data in parallel
  const [flagsResult, statusCounts, categories] = await Promise.all([
    getRedFlagsPaginated({
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
    getRedFlagStatusCounts(),
    getRedFlagCategories(),
  ]);

  return (
    <Container>
      <PageHeader
        title="Review Mode"
        description="Efficiently triage red flags identified by analysis"
      />

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
  );
}
