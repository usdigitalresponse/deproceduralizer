import { Suspense } from 'react';
import { db, RegulatoryDocumentsRepository, type PaginationOptions, type FilterOptions } from '@deproceduralizer/database';
import RegulationsClient from '@/components/RegulationsClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    severity?: string;
    complexity?: string;
    hasFlags?: string;
    hasImplIssues?: string;
    techReview?: string;
    reporting?: string;
  }>;
}

// Parse boolean filter from URL param
function parseBooleanParam(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const search = params.search || '';
  const sortBy = (params.sortBy || 'maxSeverity') as PaginationOptions['sortBy'];
  const sortOrder = (params.sortOrder || 'desc') as PaginationOptions['sortOrder'];

  // Parse filters from URL params
  const filters: FilterOptions = {};
  if (params.severity) {
    const sev = parseInt(params.severity, 10);
    if (!isNaN(sev) && sev >= 1 && sev <= 5) {
      filters.severity = sev;
    }
  }
  if (params.complexity && ['LOW', 'MEDIUM', 'MEDIUM-HIGH', 'HIGH'].includes(params.complexity)) {
    filters.complexity = params.complexity as FilterOptions['complexity'];
  }
  const hasFlags = parseBooleanParam(params.hasFlags);
  if (hasFlags !== undefined) filters.hasFlags = hasFlags;

  const hasImplIssues = parseBooleanParam(params.hasImplIssues);
  if (hasImplIssues !== undefined) filters.hasImplementationIssues = hasImplIssues;

  const techReview = parseBooleanParam(params.techReview);
  if (techReview !== undefined) filters.requiresTechnicalReview = techReview;

  const reporting = parseBooleanParam(params.reporting);
  if (reporting !== undefined) filters.hasReportingRequirement = reporting;

  const repo = new RegulatoryDocumentsRepository(db);
  const result = await repo.getAllWithAnalysisPaginated({
    page,
    pageSize: 25,
    search: search || undefined,
    sortBy,
    sortOrder,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  // Filter out entries without titles (same behavior as before)
  const regulations = result.data.filter(reg => reg.title);

  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title="Regulatory Analysis"
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
              page: result.page,
              pageSize: result.pageSize,
              total: result.total,
              totalPages: result.totalPages,
            }}
            search={search}
            filters={filters}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        </Suspense>
      </Container>
    </div>
  );
}
