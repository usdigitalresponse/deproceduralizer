import { redirect, notFound } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  ReviewQueue,
  ReviewTypeTabs,
  ComplianceReviewQueue,
  ReviewModeSwitcher,
  NeedMoreInfoQueue,
  DefinitionsReviewQueue,
  DefinitionsDeveloperQueue,
  ReviewPageError,
  RedFlagDeveloperQueue,
  ComplianceDeveloperQueue,
} from '@/components/review';
import {
  getDeveloperModeCountsData,
  getReviewModeCountsData,
  getRedFlagsQueueData,
  getComplianceQueueData,
  getNeedsInfoQueueData,
  getRedFlagDeveloperQueueData,
  getComplianceDeveloperQueueData,
  getComplianceSuggestionQueueData,
} from '@/lib/actions/review-page';
import {
  parseSeverityFilter,
  parseBooleanFilter,
  parseRequirementFoundFilter,
  parseTierFilter,
  getReviewPageConfig,
} from '@/lib/url/filter-helpers';
import type { StateCode, RedFlagFilterOptions } from '@deproceduralizer/database';
import { isValidState, STATE_CONFIG } from '@/types/state';
import type { ReviewType, ReviewMode } from '@/types/regulation';
import type { GroupingModeValue } from '@/lib/constants/values';
import { getComplianceSuggestionBatch } from '@/lib/actions/compliance-issues';

// Helper to parse comma-separated IDs from URL
function parseCommaSeparatedIds(value: string | undefined): number[] {
  if (!value) return [];
  return value.split(',').map(Number).filter(id => !isNaN(id));
}

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
    requiredByStatute?: string;
    requirementFound?: string;
    // Research pipeline filters
    tierCompleted?: string;
    federalMandate?: string;
    hasAnalysis?: string;
    // Suggestion mode params
    queueMode?: string;
    groupingMode?: string;
    batchSize?: string;
    shownIds?: string;
    focusType?: string;
    focusSection?: string;
    focusPattern?: string;
  }>;
}

export default async function ReviewPage({ params, searchParams }: PageProps) {
  const { state } = await params;
  const queryParams = await searchParams;

  if (!isValidState(state)) {
    notFound();
  }

  const stateCode = state as StateCode;
  const stateConfig = STATE_CONFIG[stateCode];
  const mode = (queryParams.mode || 'review') as ReviewMode;
  const reviewType = (queryParams.type || 'flags') as ReviewType;

  // Handle default redirects
  if (shouldRedirect(mode, reviewType, queryParams)) {
    const redirectUrl = buildRedirectUrl(state, mode, reviewType, queryParams);
    redirect(redirectUrl);
  }

  // Parse common params
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const pageSize = 10;
  const sortOrder = (queryParams.sortOrder || 'desc') as 'asc' | 'desc';

  const pageConfig = getReviewPageConfig(stateConfig.name, stateConfig.regulationsLabel, mode, reviewType);

  // Developer mode
  if (mode === 'developer') {
    return renderDeveloperMode(stateCode, reviewType, page, pageSize, sortOrder, queryParams, pageConfig);
  }

  // Review mode
  return renderReviewMode(stateCode, stateConfig, reviewType, page, pageSize, sortOrder, queryParams, pageConfig);
}

// ============================================
// Redirect Logic
// ============================================

function shouldRedirect(
  mode: ReviewMode,
  reviewType: ReviewType,
  queryParams: PageProps['searchParams'] extends Promise<infer T> ? T : never
): boolean {
  if (mode === 'developer') {
    return !queryParams.developerStatus && reviewType !== 'needs_info';
  }
  // Suggestion mode doesn't need reviewStatus - it always shows unreviewed items
  if (reviewType === 'compliance' && queryParams.queueMode === 'suggestion') {
    return false;
  }
  return !queryParams.reviewStatus && reviewType !== 'needs_info';
}

function buildRedirectUrl(
  state: string,
  mode: ReviewMode,
  reviewType: ReviewType,
  queryParams: PageProps['searchParams'] extends Promise<infer T> ? T : never
): string {
  const params = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  if (mode === 'developer') {
    params.set('mode', 'developer');
    params.set('developerStatus', 'unresolved');
    if (reviewType !== 'flags') params.set('type', reviewType);
  } else {
    params.set('type', reviewType);
    params.set('reviewStatus', 'unreviewed');
  }

  return `/${state}/review?${params.toString()}`;
}

// ============================================
// Developer Mode Rendering
// ============================================

async function renderDeveloperMode(
  stateCode: StateCode,
  reviewType: ReviewType,
  page: number,
  pageSize: number,
  sortOrder: 'asc' | 'desc',
  queryParams: PageProps['searchParams'] extends Promise<infer T> ? T : never,
  pageConfig: { title: string; description: string }
) {
  const countsResult = await getDeveloperModeCountsData(stateCode);

  if (!countsResult.success) {
    return (
      <ReviewPageError
        title={pageConfig.title}
        description={pageConfig.description}
        error={countsResult.error}
      />
    );
  }

  const { tabCounts, redFlagDeveloperStatusCounts, complianceDeveloperStatusCounts, needsInfoCounts } = countsResult.data;

  // Definitions tab
  if (reviewType === 'definitions') {
    return (
      <ReviewPageLayout pageConfig={pageConfig} mode="developer" reviewType={reviewType} tabCounts={tabCounts}>
        <DefinitionsDeveloperQueue state={stateCode} />
      </ReviewPageLayout>
    );
  }

  // Needs info tab
  if (reviewType === 'needs_info') {
    const itemsResult = await getNeedsInfoQueueData(stateCode, { page, pageSize });

    if (!itemsResult.success) {
      return (
        <ReviewPageError
          title={pageConfig.title}
          description={pageConfig.description}
          error={itemsResult.error}
          controls={{ mode: 'developer', reviewType, tabCounts }}
        />
      );
    }

    const items = itemsResult.data;
    return (
      <ReviewPageLayout pageConfig={pageConfig} mode="developer" reviewType={reviewType} tabCounts={tabCounts}>
        <NeedMoreInfoQueue
          initialItems={items.data}
          pagination={{ page: items.page, pageSize: items.pageSize, total: items.total, totalPages: items.totalPages }}
          counts={needsInfoCounts}
        />
      </ReviewPageLayout>
    );
  }

  // Compliance issues tab
  if (reviewType === 'compliance') {
    const sortBy = (queryParams.sortBy || 'reviewedAt') as 'severity' | 'issueType' | 'reviewedAt' | 'developerCheckedAt';
    const dataResult = await getComplianceDeveloperQueueData(stateCode, {
      page,
      pageSize,
      sortBy,
      sortOrder,
      developerStatus: queryParams.developerStatus || undefined,
      developerAssigned: queryParams.developerAssigned || undefined,
      severity: (queryParams.severity || 'all') as 'high' | 'medium' | 'low' | 'all',
      reviewStatus: queryParams.reviewStatus || undefined,
      issueType: queryParams.issueType || undefined,
    });

    if (!dataResult.success) {
      return (
        <ReviewPageError
          title={pageConfig.title}
          description={pageConfig.description}
          error={dataResult.error}
          controls={{ mode: 'developer', reviewType, tabCounts }}
        />
      );
    }

    const { items, issueTypes } = dataResult.data;
    return (
      <ReviewPageLayout pageConfig={pageConfig} mode="developer" reviewType={reviewType} tabCounts={tabCounts}>
        <ComplianceDeveloperQueue
          initialItems={items.data}
          pagination={{ page: items.page, pageSize: items.pageSize, total: items.total, totalPages: items.totalPages }}
          statusCounts={complianceDeveloperStatusCounts}
          issueTypes={issueTypes}
        />
      </ReviewPageLayout>
    );
  }

  // Default: Red Flags tab
  const sortBy = (queryParams.sortBy || 'reviewedAt') as 'severity' | 'category' | 'reviewedAt' | 'developerCheckedAt';
  const dataResult = await getRedFlagDeveloperQueueData(stateCode, {
    page,
    pageSize,
    sortBy,
    sortOrder,
    developerStatus: queryParams.developerStatus || undefined,
    developerAssigned: queryParams.developerAssigned || undefined,
    severity: (queryParams.severity || 'all') as 'high' | 'medium' | 'low' | 'all',
    reviewStatus: queryParams.reviewStatus || undefined,
    category: queryParams.category || undefined,
  });

  if (!dataResult.success) {
    return (
      <ReviewPageError
        title={pageConfig.title}
        description={pageConfig.description}
        error={dataResult.error}
        controls={{ mode: 'developer', reviewType, tabCounts }}
      />
    );
  }

  const { items, categories } = dataResult.data;
  return (
    <ReviewPageLayout pageConfig={pageConfig} mode="developer" reviewType={reviewType} tabCounts={tabCounts}>
      <RedFlagDeveloperQueue
        initialItems={items.data}
        pagination={{ page: items.page, pageSize: items.pageSize, total: items.total, totalPages: items.totalPages }}
        statusCounts={redFlagDeveloperStatusCounts}
        categories={categories}
      />
    </ReviewPageLayout>
  );
}

// ============================================
// Review Mode Rendering
// ============================================

async function renderReviewMode(
  stateCode: StateCode,
  stateConfig: { name: string; regulationsLabel: string },
  reviewType: ReviewType,
  page: number,
  pageSize: number,
  sortOrder: 'asc' | 'desc',
  queryParams: PageProps['searchParams'] extends Promise<infer T> ? T : never,
  pageConfig: { title: string; description: string }
) {
  const countsResult = await getReviewModeCountsData(stateCode);

  if (!countsResult.success) {
    return (
      <ReviewPageError
        title={pageConfig.title}
        description={pageConfig.description}
        error={countsResult.error}
      />
    );
  }

  const { tabCounts, flagStatusCounts, complianceStatusCounts, needsInfoCounts } = countsResult.data;

  // Definitions tab
  if (reviewType === 'definitions') {
    return (
      <ReviewPageLayout pageConfig={pageConfig} mode="review" reviewType={reviewType} tabCounts={tabCounts}>
        <DefinitionsReviewQueue state={stateCode} />
      </ReviewPageLayout>
    );
  }

  // Needs info tab
  if (reviewType === 'needs_info') {
    const itemsResult = await getNeedsInfoQueueData(stateCode, { page, pageSize });

    if (!itemsResult.success) {
      return (
        <ReviewPageError
          title={pageConfig.title}
          description={pageConfig.description}
          error={itemsResult.error}
          controls={{ mode: 'review', reviewType, tabCounts }}
        />
      );
    }

    const items = itemsResult.data;
    return (
      <ReviewPageLayout pageConfig={pageConfig} mode="review" reviewType={reviewType} tabCounts={tabCounts}>
        <NeedMoreInfoQueue
          initialItems={items.data}
          pagination={{ page: items.page, pageSize: items.pageSize, total: items.total, totalPages: items.totalPages }}
          counts={needsInfoCounts}
        />
      </ReviewPageLayout>
    );
  }

  // Compliance tab
  if (reviewType === 'compliance') {
    // Default to 'suggestion' mode unless explicitly set to 'filter'
    const queueMode = queryParams.queueMode === 'filter' ? 'filter' : 'suggestion';

    // Suggestion mode
    if (queueMode === 'suggestion') {
      const batchSize = Math.min(5, Math.max(2, parseInt(queryParams.batchSize || '3', 10)));
      const groupingMode = (queryParams.groupingMode || 'issue_type') as GroupingModeValue;
      const shownIds = parseCommaSeparatedIds(queryParams.shownIds);
      const focus = {
        issueType: queryParams.focusType || undefined,
        section: queryParams.focusSection || undefined,
        pattern: queryParams.focusPattern || undefined,
      };

      const dataResult = await getComplianceSuggestionQueueData(stateCode, {
        batchSize,
        excludeIds: shownIds,
        groupingMode,
        focus: Object.values(focus).some(v => v) ? focus : undefined,
      });

      if (!dataResult.success) {
        return (
          <ReviewPageError
            title={pageConfig.title}
            description={pageConfig.description}
            error={dataResult.error}
            controls={{ mode: 'review', reviewType, tabCounts }}
          />
        );
      }

      const { batch, issueTypes } = dataResult.data;

      // Create a fetch function for the client to call for subsequent batches
      async function fetchSuggestionBatch(options: {
        batchSize: number;
        excludeIds: number[];
        groupingMode: GroupingModeValue;
        focus?: { issueType?: string; section?: string; pattern?: string };
        recentIssueTypes?: string[];
      }) {
        'use server';
        const result = await getComplianceSuggestionBatch(stateCode, {
          ...options,
          recentIssueTypes: options.recentIssueTypes,
        });
        if (!result.success) {
          throw new Error(result.error);
        }
        return result.data;
      }

      return (
        <ReviewPageLayout pageConfig={pageConfig} mode="review" reviewType={reviewType} tabCounts={tabCounts}>
          <ComplianceReviewQueue
            mode="suggestion"
            initialBatch={batch}
            fetchBatch={fetchSuggestionBatch}
            statusCounts={complianceStatusCounts}
            issueTypes={issueTypes}
          />
        </ReviewPageLayout>
      );
    }

    // Filter mode (default)
    const sortBy = (queryParams.sortBy || 'severity') as 'issueType' | 'createdAt' | 'reviewedAt' | 'severity';
    const filters = {
      status: queryParams.reviewStatus === 'all' ? undefined : queryParams.reviewStatus,
      issueType: queryParams.issueType || undefined,
      severity: parseSeverityFilter(queryParams.severity),
      requiredByStatute: parseBooleanFilter(queryParams.requiredByStatute),
      requirementFound: parseRequirementFoundFilter(queryParams.requirementFound),
      // Research pipeline filters
      tierCompleted: parseTierFilter(queryParams.tierCompleted),
      federalMandate: parseBooleanFilter(queryParams.federalMandate),
      hasAnalysis: parseBooleanFilter(queryParams.hasAnalysis),
    };

    const dataResult = await getComplianceQueueData(stateCode, { page, pageSize, sortBy, sortOrder, filters });

    if (!dataResult.success) {
      return (
        <ReviewPageError
          title={pageConfig.title}
          description={pageConfig.description}
          error={dataResult.error}
          controls={{ mode: 'review', reviewType, tabCounts }}
        />
      );
    }

    const { issues, issueTypes } = dataResult.data;
    return (
      <ReviewPageLayout pageConfig={pageConfig} mode="review" reviewType={reviewType} tabCounts={tabCounts}>
        <ComplianceReviewQueue
          mode="filter"
          initialIssues={issues.data}
          pagination={{ page: issues.page, pageSize: issues.pageSize, total: issues.total, totalPages: issues.totalPages }}
          statusCounts={complianceStatusCounts}
          issueTypes={issueTypes}
        />
      </ReviewPageLayout>
    );
  }

  // Default: Red Flags tab
  const sortBy = (queryParams.sortBy || 'severity') as 'severity' | 'category' | 'reviewedAt';
  const filters: Omit<RedFlagFilterOptions, 'state'> = {
    status: queryParams.reviewStatus === 'all' ? 'all' : (queryParams.reviewStatus as RedFlagFilterOptions['status']),
    severity: queryParams.severity as 'high' | 'medium' | 'low' | undefined,
    category: queryParams.category || undefined,
  };

  const dataResult = await getRedFlagsQueueData(stateCode, { page, pageSize, sortBy, sortOrder, filters });

  if (!dataResult.success) {
    return (
      <ReviewPageError
        title={pageConfig.title}
        description={pageConfig.description}
        error={dataResult.error}
        controls={{ mode: 'review', reviewType, tabCounts }}
      />
    );
  }

  const { flags, categories } = dataResult.data;
  return (
    <ReviewPageLayout pageConfig={pageConfig} mode="review" reviewType={reviewType} tabCounts={tabCounts}>
      <ReviewQueue
        initialFlags={flags.data}
        pagination={{ page: flags.page, pageSize: flags.pageSize, total: flags.total, totalPages: flags.totalPages }}
        statusCounts={flagStatusCounts}
        categories={categories}
      />
    </ReviewPageLayout>
  );
}

// ============================================
// Shared Layout Component
// ============================================

function ReviewPageLayout({
  pageConfig,
  mode,
  reviewType,
  tabCounts,
  children,
}: {
  pageConfig: { title: string; description: string };
  mode: ReviewMode;
  reviewType: ReviewType;
  tabCounts: { flags: number; compliance: number; definitions: number; needs_info: number };
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader title={pageConfig.title} description={pageConfig.description} />
      <Container size="2xl" className="py-6">
        <ReviewModeSwitcher mode={mode} />
        <ReviewTypeTabs activeType={reviewType} counts={tabCounts} mode={mode} />
        {children}
      </Container>
    </div>
  );
}
