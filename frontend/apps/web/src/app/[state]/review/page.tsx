import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  ReviewQueue,
  ReviewTypeTabs,
  ComplianceReviewQueue,
  ReviewModeSwitcher,
  DeveloperQueue,
  NeedMoreInfoQueue,
} from '@/components/review';
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
import {
  getCombinedDeveloperStatusCounts,
  getCombinedReviewedItems,
  getNeedMoreInfoItems,
  getNeedMoreInfoCounts,
} from '@/lib/actions/developer';
import type { RedFlagFilterOptions, StateCode } from '@deproceduralizer/database';
import { isValidState, STATE_CONFIG } from '@/types/state';
import type { ReviewType, ReviewMode } from '@/types/regulation';

interface PageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<{
    mode?: string;
    type?: string;
    status?: string;
    severity?: string;
    category?: string;
    issueType?: string;
    developerStatus?: string;
    developer?: string;
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

  // Determine mode (review or developer)
  const mode = (queryParams.mode || 'review') as ReviewMode;

  // Determine review type (flags, compliance, or needs_info)
  const reviewType = (queryParams.type || 'flags') as ReviewType;

  // Default redirects based on mode
  if (mode === 'developer') {
    // Developer mode: default to unresolved items
    if (!queryParams.developerStatus && reviewType !== 'needs_info') {
      redirect(`/${state}/review?mode=developer&developerStatus=unresolved`);
    }
  } else {
    // Review mode: default to unreviewed items
    if (!queryParams.status && reviewType !== 'needs_info') {
      redirect(`/${state}/review?type=${reviewType}&status=unreviewed`);
    }
  }

  // Parse pagination params
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const pageSize = 10;
  const sortOrder = (queryParams.sortOrder || 'desc') as 'asc' | 'desc';

  // Fetch counts for tabs based on mode
  if (mode === 'developer') {
    // Developer mode: fetch developer status counts
    const [developerStatusCounts, needsInfoCounts] = await Promise.all([
      getCombinedDeveloperStatusCounts(stateCode),
      getNeedMoreInfoCounts(stateCode),
    ]);

    // In developer mode, tabs show "All Reviewed Items" (combined) and "Needs More Info"
    // The flags + compliance sum is shown for "All Reviewed Items"
    const tabCounts = {
      flags: developerStatusCounts.total, // Total reviewed items
      compliance: 0, // Combined into flags for developer mode
      needs_info: needsInfoCounts.combined.total,
    };

    // Handle needs_info tab in developer mode
    if (reviewType === 'needs_info') {
      const needsInfoItems = await getNeedMoreInfoItems(stateCode, {
        page,
        pageSize,
      });

      return (
        <div className="bg-[var(--color-background)]">
          <PageHeader
            title={`Developer Review - ${stateConfig.name}`}
            description="Track implementation status of reviewed regulatory items"
          />

          <Container size="2xl" className="py-6">
            <ReviewModeSwitcher mode={mode} />
            <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
            <NeedMoreInfoQueue
              initialItems={needsInfoItems.data}
              pagination={{
                page: needsInfoItems.page,
                pageSize: needsInfoItems.pageSize,
                total: needsInfoItems.total,
                totalPages: needsInfoItems.totalPages,
              }}
              counts={needsInfoCounts}
            />
          </Container>
        </div>
      );
    }

    // Developer mode: combined queue view
    const developerStatus = queryParams.developerStatus || undefined;
    const developerAssigned = queryParams.developer || undefined;

    const reviewedItems = await getCombinedReviewedItems(stateCode, {
      page,
      pageSize,
      sortOrder,
      developerStatus,
      developerAssigned,
    });

    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`Developer Review - ${stateConfig.name}`}
          description="Track implementation status of reviewed regulatory items"
        />

        <Container size="2xl" className="py-6">
          <ReviewModeSwitcher mode={mode} />
          <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
          <DeveloperQueue
            initialItems={reviewedItems.data}
            pagination={{
              page: reviewedItems.page,
              pageSize: reviewedItems.pageSize,
              total: reviewedItems.total,
              totalPages: reviewedItems.totalPages,
            }}
            statusCounts={developerStatusCounts}
            currentDeveloperStatus={developerStatus}
            currentDeveloperAssigned={developerAssigned}
            sortBy="reviewedAt"
            sortOrder={sortOrder}
          />
        </Container>
      </div>
    );
  }

  // Review mode: fetch review status counts
  const [flagStatusCounts, complianceStatusCounts, needsInfoCounts] = await Promise.all([
    getRedFlagStatusCounts(stateCode),
    getComplianceIssueStatusCounts(stateCode),
    getNeedMoreInfoCounts(stateCode),
  ]);

  const tabCounts = {
    flags: flagStatusCounts.total,
    compliance: complianceStatusCounts.total,
    needs_info: needsInfoCounts.combined.total,
  };

  // Handle needs_info tab in review mode
  if (reviewType === 'needs_info') {
    const needsInfoItems = await getNeedMoreInfoItems(stateCode, {
      page,
      pageSize,
    });

    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`Review ${stateConfig.name} Regulations`}
          description="Items that need additional information from reviewers"
        />

        <Container size="2xl" className="py-6">
          <ReviewModeSwitcher mode={mode} />
          <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
          <NeedMoreInfoQueue
            initialItems={needsInfoItems.data}
            pagination={{
              page: needsInfoItems.page,
              pageSize: needsInfoItems.pageSize,
              total: needsInfoItems.total,
              totalPages: needsInfoItems.totalPages,
            }}
            counts={needsInfoCounts}
          />
        </Container>
      </div>
    );
  }

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
          <ReviewModeSwitcher mode={mode} />
          <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
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
        <ReviewModeSwitcher mode={mode} />
        <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
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
