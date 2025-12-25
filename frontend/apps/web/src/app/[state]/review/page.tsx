import { redirect, notFound } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui';
import {
  ReviewQueue,
  ReviewTypeTabs,
  ComplianceReviewQueue,
  ReviewModeSwitcher,
  DeveloperQueue,
  NeedMoreInfoQueue,
  DefinitionsReviewQueue,
  DefinitionsDeveloperQueue,
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
import { getDefinitionReviewStats, getDefinitionDeveloperStatusCounts } from '@/lib/actions/definitions';
import type { RedFlagFilterOptions, StateCode } from '@deproceduralizer/database';
import { isValidState, STATE_CONFIG } from '@/types/state';
import type { ReviewType, ReviewMode } from '@/types/regulation';

interface PageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<{
    mode?: string;
    type?: string;
    reviewStatus?: string;
    severity?: string;
    category?: string;
    issueType?: string;
    developerStatus?: string;
    developerAssigned?: string;
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
      // Preserve type parameter for definitions
      const typeParam = reviewType !== 'flags' ? `&type=${reviewType}` : '';
      redirect(`/${state}/review?mode=developer${typeParam}&developerStatus=unresolved`);
    }
  } else {
    // Review mode: default to unreviewed items
    if (!queryParams.reviewStatus && reviewType !== 'needs_info') {
      redirect(`/${state}/review?type=${reviewType}&reviewStatus=unreviewed`);
    }
  }

  // Parse pagination params
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const pageSize = 10;
  const sortOrder = (queryParams.sortOrder || 'desc') as 'asc' | 'desc';

  // Fetch counts for tabs based on mode
  if (mode === 'developer') {
    // Developer mode: fetch developer status counts
    const [developerStatusCountsResult, needsInfoCountsResult, definitionDevCountsResult] = await Promise.all([
      getCombinedDeveloperStatusCounts(stateCode),
      getNeedMoreInfoCounts(stateCode),
      getDefinitionDeveloperStatusCounts(stateCode),
    ]);

    // Handle errors - display them obviously
    if (!developerStatusCountsResult.success) {
      return (
        <div className="bg-[var(--color-background)]">
          <PageHeader
            title={`Developer Review - ${stateConfig.name}`}
            description="Track implementation status of reviewed regulatory items"
          />
          <Container size="2xl" className="py-6">
            <Alert variant="error">
              Failed to load developer status counts: {developerStatusCountsResult.error}
            </Alert>
          </Container>
        </div>
      );
    }

    if (!needsInfoCountsResult.success) {
      return (
        <div className="bg-[var(--color-background)]">
          <PageHeader
            title={`Developer Review - ${stateConfig.name}`}
            description="Track implementation status of reviewed regulatory items"
          />
          <Container size="2xl" className="py-6">
            <Alert variant="error">
              Failed to load needs info counts: {needsInfoCountsResult.error}
            </Alert>
          </Container>
        </div>
      );
    }

    const developerStatusCounts = developerStatusCountsResult.data;
    const needsInfoCounts = needsInfoCountsResult.data;
    const definitionDevCounts = definitionDevCountsResult.success ? definitionDevCountsResult.data : { total: 0 };

    // In developer mode, tabs show "All Reviewed Items" (combined), "Definitions", and "Needs More Info"
    const tabCounts = {
      flags: developerStatusCounts.total, // Total reviewed items (flags + compliance)
      compliance: 0, // Combined into flags for developer mode
      definitions: definitionDevCounts.total, // Definitions have their own tab
      needs_info: needsInfoCounts.combined.total,
    };

    // Handle definitions tab in developer mode
    if (reviewType === 'definitions') {
      return (
        <div className="bg-[var(--color-background)]">
          <PageHeader
            title={`Developer Review - ${stateConfig.name} Definitions`}
            description="Track implementation status of reviewed definitions"
          />

          <Container size="2xl" className="py-6">
            <ReviewModeSwitcher mode={mode} />
            <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
            <DefinitionsDeveloperQueue state={stateCode} />
          </Container>
        </div>
      );
    }

    // Handle needs_info tab in developer mode
    if (reviewType === 'needs_info') {
      const needsInfoItemsResult = await getNeedMoreInfoItems(stateCode, {
        page,
        pageSize,
      });

      if (!needsInfoItemsResult.success) {
        return (
          <div className="bg-[var(--color-background)]">
            <PageHeader
              title={`Developer Review - ${stateConfig.name}`}
              description="Track implementation status of reviewed regulatory items"
            />
            <Container size="2xl" className="py-6">
              <ReviewModeSwitcher mode={mode} />
              <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
              <Alert variant="error">
                Failed to load needs more info items: {needsInfoItemsResult.error}
              </Alert>
            </Container>
          </div>
        );
      }

      const needsInfoItems = needsInfoItemsResult.data;

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
    const developerAssigned = queryParams.developerAssigned || undefined;

    const reviewedItemsResult = await getCombinedReviewedItems(stateCode, {
      page,
      pageSize,
      sortOrder,
      developerStatus,
      developerAssigned,
    });

    if (!reviewedItemsResult.success) {
      return (
        <div className="bg-[var(--color-background)]">
          <PageHeader
            title={`Developer Review - ${stateConfig.name}`}
            description="Track implementation status of reviewed regulatory items"
          />
          <Container size="2xl" className="py-6">
            <ReviewModeSwitcher mode={mode} />
            <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
            <Alert variant="error">
              Failed to load reviewed items: {reviewedItemsResult.error}
            </Alert>
          </Container>
        </div>
      );
    }

    const reviewedItems = reviewedItemsResult.data;

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
          />
        </Container>
      </div>
    );
  }

  // Review mode: fetch review status counts
  const [flagStatusCountsResult, complianceStatusCountsResult, definitionsStatsResult, needsInfoCountsResult] = await Promise.all([
    getRedFlagStatusCounts(stateCode),
    getComplianceIssueStatusCounts(stateCode),
    getDefinitionReviewStats(stateCode),
    getNeedMoreInfoCounts(stateCode),
  ]);

  // Handle errors - display them obviously
  if (!flagStatusCountsResult.success) {
    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`Review ${stateConfig.name} Regulations`}
          description={`Efficiently triage red flags identified in ${stateConfig.regulationsLabel}`}
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">
            Failed to load red flag status counts: {flagStatusCountsResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  if (!complianceStatusCountsResult.success) {
    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`Review ${stateConfig.name} Regulations`}
          description={`Efficiently triage compliance issues identified in ${stateConfig.regulationsLabel}`}
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">
            Failed to load compliance issue status counts: {complianceStatusCountsResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  if (!definitionsStatsResult.success) {
    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`Review ${stateConfig.name} Regulations`}
          description="Review extracted definitions"
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">
            Failed to load definitions counts: {definitionsStatsResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  if (!needsInfoCountsResult.success) {
    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`Review ${stateConfig.name} Regulations`}
          description="Items that need additional information from reviewers"
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">
            Failed to load needs info counts: {needsInfoCountsResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  const flagStatusCounts = flagStatusCountsResult.data;
  const complianceStatusCounts = complianceStatusCountsResult.data;
  const definitionsStats = definitionsStatsResult.data;
  const needsInfoCounts = needsInfoCountsResult.data;

  const tabCounts = {
    flags: flagStatusCounts.total,
    compliance: complianceStatusCounts.total,
    definitions: definitionsStats.total,
    needs_info: needsInfoCounts.combined.total,
  };

  // Handle needs_info tab in review mode
  if (reviewType === 'needs_info') {
    const needsInfoItemsResult = await getNeedMoreInfoItems(stateCode, {
      page,
      pageSize,
    });

    if (!needsInfoItemsResult.success) {
      return (
        <div className="bg-[var(--color-background)]">
          <PageHeader
            title={`Review ${stateConfig.name} Regulations`}
            description="Items that need additional information from reviewers"
          />
          <Container size="2xl" className="py-6">
            <ReviewModeSwitcher mode={mode} />
            <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
            <Alert variant="error">
              Failed to load needs more info items: {needsInfoItemsResult.error}
            </Alert>
          </Container>
        </div>
      );
    }

    const needsInfoItems = needsInfoItemsResult.data;

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

  // Handle definitions tab in review mode
  if (reviewType === 'definitions') {
    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`Review ${stateConfig.name} Definitions`}
          description="Review and correct LLM-extracted definitions"
        />

        <Container size="2xl" className="py-6">
          <ReviewModeSwitcher mode={mode} />
          <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
          <DefinitionsReviewQueue state={stateCode} />
        </Container>
      </div>
    );
  }

  // Render based on review type
  if (reviewType === 'compliance') {
    const sortBy = (queryParams.sortBy || 'createdAt') as 'issueType' | 'createdAt' | 'reviewedAt';
    const filters = {
      status: queryParams.reviewStatus === 'all' ? undefined : queryParams.reviewStatus,
      issueType: queryParams.issueType || undefined,
    };

    const [issuesResultAction, issueTypesResult] = await Promise.all([
      getComplianceIssuesPaginated(stateCode, {
        page,
        pageSize,
        sortBy,
        sortOrder,
        filters,
      }),
      getComplianceIssueTypes(stateCode),
    ]);

    if (!issuesResultAction.success) {
      return (
        <div className="bg-[var(--color-background)]">
          <PageHeader
            title={`Review ${stateConfig.name} Regulations`}
            description={`Efficiently triage compliance issues identified in ${stateConfig.regulationsLabel}`}
          />
          <Container size="2xl" className="py-6">
            <ReviewModeSwitcher mode={mode} />
            <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
            <Alert variant="error">
              Failed to load compliance issues: {issuesResultAction.error}
            </Alert>
          </Container>
        </div>
      );
    }

    if (!issueTypesResult.success) {
      return (
        <div className="bg-[var(--color-background)]">
          <PageHeader
            title={`Review ${stateConfig.name} Regulations`}
            description={`Efficiently triage compliance issues identified in ${stateConfig.regulationsLabel}`}
          />
          <Container size="2xl" className="py-6">
            <ReviewModeSwitcher mode={mode} />
            <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
            <Alert variant="error">
              Failed to load issue types: {issueTypesResult.error}
            </Alert>
          </Container>
        </div>
      );
    }

    const issuesResult = issuesResultAction.data;
    const issueTypes = issueTypesResult.data;

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
          />
        </Container>
      </div>
    );
  }

  // Default: Red Flags view
  const sortBy = (queryParams.sortBy || 'severity') as 'severity' | 'category' | 'reviewedAt';
  const filters: Omit<RedFlagFilterOptions, 'state'> = {
    status: queryParams.reviewStatus === 'all' ? 'all' : (queryParams.reviewStatus as RedFlagFilterOptions['status']),
    severity: queryParams.severity as 'high' | 'medium' | 'low' | undefined,
    category: queryParams.category || undefined,
  };

  const [flagsResultAction, categoriesResult] = await Promise.all([
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

  if (!flagsResultAction.success) {
    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`Review ${stateConfig.name} Regulations`}
          description={`Efficiently triage red flags identified in ${stateConfig.regulationsLabel}`}
        />
        <Container size="2xl" className="py-6">
          <ReviewModeSwitcher mode={mode} />
          <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
          <Alert variant="error">
            Failed to load red flags: {flagsResultAction.error}
          </Alert>
        </Container>
      </div>
    );
  }

  if (!categoriesResult.success) {
    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`Review ${stateConfig.name} Regulations`}
          description={`Efficiently triage red flags identified in ${stateConfig.regulationsLabel}`}
        />
        <Container size="2xl" className="py-6">
          <ReviewModeSwitcher mode={mode} />
          <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
          <Alert variant="error">
            Failed to load categories: {categoriesResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  const flagsResult = flagsResultAction.data;
  const categories = categoriesResult.data;

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
        />
      </Container>
    </div>
  );
}
