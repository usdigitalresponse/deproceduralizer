import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { PaginationOptions, FilterOptions, JurisdictionCode } from '@deproceduralizer/database';
import { getRegulationsPaginated } from '@/lib/actions/regulations';
import RegulationsClient from '@/components/RegulationsClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Alert } from '@/components/ui';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';
import { parseBooleanParam } from '@/lib/url/filter-helpers';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    severity?: string;
    complexity?: string;
    hasFlags?: string;
    category?: string;
    summarySearch?: string;
    explanationSearch?: string;
  }>;
}

export default async function Home({ params, searchParams }: PageProps) {
  const { state } = await params;
  const queryParams = await searchParams;

  // Validate state parameter
  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state as JurisdictionCode;
  const stateConfig = JURISDICTION_CONFIG[stateCode];

  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const search = queryParams.search || '';
  const sortBy = (queryParams.sortBy || 'title') as PaginationOptions['sortBy'];
  const sortOrder = (queryParams.sortOrder || 'desc') as PaginationOptions['sortOrder'];

  // Parse filters from URL params
  const filters: FilterOptions = {};

  if (queryParams.explanationSearch) {
    filters.explanationSearch = queryParams.explanationSearch;
  }

  const result = await getRegulationsPaginated({
    jurisdiction: stateCode,
    page,
    pageSize: 25,
    search: search || undefined,
    sortBy,
    sortOrder,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  if (!result.success) {
    return (
      <div className="bg-[var(--color-background)] min-h-screen">
        <PageHeader
          title={`${stateConfig.name} Regulatory Analysis`}
          description="Searchable database of compliance issues, procedural complexity, and technical review requirements"
        />
        <Container size="xl" className="py-6">
          <Alert variant="error">
            Failed to load regulations: {result.error}
          </Alert>
        </Container>
      </div>
    );
  }

  // Filter out entries without titles (same behavior as before)
  const regulations = result.data.data.filter(reg => reg.title);

  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title={`${stateConfig.name} Regulatory Analysis`}
        description="Searchable database of compliance issues, procedural complexity, and technical review requirements"
      />

      <Container size="2xl" className="py-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)]">
              <svg
                className="animate-spin mr-3 h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading regulations...
            </div>
          }
        >
          <RegulationsClient
            initialData={regulations}
            pagination={{
              page: result.data.page,
              pageSize: result.data.pageSize,
              total: result.data.total,
              totalPages: result.data.totalPages,
            }}
            search={search}
            filters={filters}
          />
        </Suspense>
      </Container>
    </div>
  );
}
