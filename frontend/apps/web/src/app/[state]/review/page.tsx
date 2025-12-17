import { redirect, notFound } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { ReviewQueue, ReviewTypeTabs, ComplianceReviewQueue } from '@/components/review';
import {
  getRedFlagsPaginated,
  getRedFlagStatusCounts,
  getRedFlagCategories,
} from '@/lib/actions/red-flags';
import {
  getComplianceIssuesPaginated,
  getComplianceIssueStatusCounts,
  getComplianceIssueTypes,
} from '@/lib/actions/compliance-issues';
import type { RedFlagFilterOptions, StateCode } from '@deproceduralizer/database';
import { isValidState, STATE_CONFIG } from '@/types/state';
import type { ReviewType } from '@/types/regulation';

interface PageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<{
    type?: string;
    status?: string;
    severity?: string;
    category?: string;
    issueType?: string;
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

  // Determine review type (flags, compliance, or all)
  const reviewType = (queryParams.type || 'flags') as ReviewType;

  // Default to showing unreviewed items
  if (!queryParams.status) {
    redirect(`/${state}/review?type=${reviewType}&status=unreviewed`);
  }

  // Parse pagination params
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const pageSize = 10;
  const sortOrder = (queryParams.sortOrder || 'desc') as 'asc' | 'desc';

  // Fetch counts for tabs (always fetch both for tab display)
  const [flagStatusCounts, complianceStatusCounts] = await Promise.all([
    getRedFlagStatusCounts(stateCode),
    getComplianceIssueStatusCounts(stateCode),
  ]);

  const tabCounts = {
    flags: flagStatusCounts.total,
    compliance: complianceStatusCounts.total,
  };

  // Render based on review type
  if (reviewType === 'compliance') {
    const sortBy = (queryParams.sortBy || 'createdAt') as 'issueType' | 'createdAt' | 'reviewedAt';
    const filters = {
      status: queryParams.status === 'all' ? undefined : queryParams.status,
      issueType: queryParams.issueType || undefined,
    };

    const [issuesResult, issueTypes] = await Promise.all([
      getComplianceIssuesPaginated(stateCode, {
        page,
        pageSize,
        sortBy,
        sortOrder,
        filters,
      }),
      getComplianceIssueTypes(stateCode),
    ]);

    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`Review ${stateConfig.name} Regulations`}
          description={`Efficiently triage compliance issues identified in ${stateConfig.regulationsLabel}`}
        />

        <Container size="2xl" className="py-6">
          <ReviewTypeTabs activeType={reviewType} counts={tabCounts} />
          <ComplianceReviewQueue
            initialIssues={issuesResult.data}
            pagination={{
              page: issuesResult.page,
              pageSize: issuesResult.pageSize,
              total: issuesResult.total,
              totalPages: issuesResult.totalPages,
            }}
            statusCounts={complianceStatusCounts}
            issueTypes={issueTypes}
            currentFilters={filters}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        </Container>
      </div>
    );
  }

  // "All" view - show both red flags and compliance issues
  if (reviewType === 'all') {
    const flagSortBy = (queryParams.sortBy || 'severity') as 'severity' | 'category' | 'reviewedAt';
    const complianceSortBy = (queryParams.sortBy || 'createdAt') as 'issueType' | 'createdAt' | 'reviewedAt';
    const flagFilters: Omit<RedFlagFilterOptions, 'state'> = {
      status: queryParams.status === 'all' ? 'all' : (queryParams.status as RedFlagFilterOptions['status']),
      severity: queryParams.severity as 'high' | 'medium' | 'low' | undefined,
      category: queryParams.category || undefined,
    };
    const complianceFilters = {
      status: queryParams.status === 'all' ? undefined : queryParams.status,
      issueType: queryParams.issueType || undefined,
    };

    const [flagsResult, categories, issuesResult, issueTypes] = await Promise.all([
      getRedFlagsPaginated(stateCode, {
        page,
        pageSize: 5, // Show fewer of each in combined view
        sortBy: flagSortBy,
        sortOrder,
        filters: {
          status: flagFilters.status,
          severity: flagFilters.severity,
          category: flagFilters.category,
        },
      }),
      getRedFlagCategories(stateCode),
      getComplianceIssuesPaginated(stateCode, {
        page,
        pageSize: 5,
        sortBy: complianceSortBy,
        sortOrder,
        filters: complianceFilters,
      }),
      getComplianceIssueTypes(stateCode),
    ]);

    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`Review ${stateConfig.name} Regulations`}
          description={`Review all issues identified in ${stateConfig.regulationsLabel}`}
        />

        <Container size="2xl" className="py-6">
          <ReviewTypeTabs activeType={reviewType} counts={tabCounts} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Red Flags Section */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                Red Flags
                <span className="text-sm font-normal text-[var(--color-text-muted)]">
                  ({flagsResult.total} total)
                </span>
              </h2>
              <ReviewQueue
                initialFlags={flagsResult.data}
                pagination={{
                  page: flagsResult.page,
                  pageSize: flagsResult.pageSize,
                  total: flagsResult.total,
                  totalPages: flagsResult.totalPages,
                }}
                statusCounts={flagStatusCounts}
                categories={categories}
                currentFilters={flagFilters}
                sortBy={flagSortBy}
                sortOrder={sortOrder}
                compact
              />
            </div>

            {/* Compliance Issues Section */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                Compliance Issues
                <span className="text-sm font-normal text-[var(--color-text-muted)]">
                  ({issuesResult.total} total)
                </span>
              </h2>
              <ComplianceReviewQueue
                initialIssues={issuesResult.data}
                pagination={{
                  page: issuesResult.page,
                  pageSize: issuesResult.pageSize,
                  total: issuesResult.total,
                  totalPages: issuesResult.totalPages,
                }}
                statusCounts={complianceStatusCounts}
                issueTypes={issueTypes}
                currentFilters={complianceFilters}
                sortBy={complianceSortBy}
                sortOrder={sortOrder}
                compact
              />
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // Default: Red Flags view
  const sortBy = (queryParams.sortBy || 'severity') as 'severity' | 'category' | 'reviewedAt';
  const filters: Omit<RedFlagFilterOptions, 'state'> = {
    status: queryParams.status === 'all' ? 'all' : (queryParams.status as RedFlagFilterOptions['status']),
    severity: queryParams.severity as 'high' | 'medium' | 'low' | undefined,
    category: queryParams.category || undefined,
  };

  const [flagsResult, categories] = await Promise.all([
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
    getRedFlagCategories(stateCode),
  ]);

  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title={`Review ${stateConfig.name} Regulations`}
        description={`Efficiently triage red flags identified in ${stateConfig.regulationsLabel}`}
      />

      <Container size="2xl" className="py-6">
        <ReviewTypeTabs activeType={reviewType} counts={tabCounts} />
        <ReviewQueue
          initialFlags={flagsResult.data}
          pagination={{
            page: flagsResult.page,
            pageSize: flagsResult.pageSize,
            total: flagsResult.total,
            totalPages: flagsResult.totalPages,
          }}
          statusCounts={flagStatusCounts}
          categories={categories}
          currentFilters={filters}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </Container>
    </div>
  );
}
