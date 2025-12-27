import { redirect, notFound } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  ReviewQueue,
  ReviewTypeTabs,
  ComplianceReviewQueue,
  ReviewModeSwitcher,
  DeveloperQueue,
  NeedMoreInfoQueue,
  DefinitionsReviewQueue,
  DefinitionsDeveloperQueue,
  ReviewPageError,
} from '@/components/review';
import {
  getDeveloperModeCountsData,
  getReviewModeCountsData,
  getRedFlagsQueueData,
  getComplianceQueueData,
  getNeedsInfoQueueData,
  getDeveloperQueueData,
} from '@/lib/actions/review-page';
import {
  parseSeverityFilter,
  parseBooleanFilter,
  parseRequirementFoundFilter,
  getReviewPageConfig,
} from '@/lib/url/filter-helpers';
import type { StateCode, RedFlagFilterOptions } from '@deproceduralizer/database';
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
    requiredByStatute?: string;
    requirementFound?: string;
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

  const { tabCounts, developerStatusCounts, needsInfoCounts } = countsResult.data;

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

  // Default: Combined developer queue
  const itemsResult = await getDeveloperQueueData(stateCode, {
    page,
    pageSize,
    sortOrder,
    developerStatus: queryParams.developerStatus || undefined,
    developerAssigned: queryParams.developerAssigned || undefined,
  });

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
      <DeveloperQueue
        initialItems={items.data}
        pagination={{ page: items.page, pageSize: items.pageSize, total: items.total, totalPages: items.totalPages }}
        statusCounts={developerStatusCounts}
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
    const sortBy = (queryParams.sortBy || 'createdAt') as 'issueType' | 'createdAt' | 'reviewedAt' | 'severity';
    const filters = {
      status: queryParams.reviewStatus === 'all' ? undefined : queryParams.reviewStatus,
      issueType: queryParams.issueType || undefined,
      severity: parseSeverityFilter(queryParams.severity),
      requiredByStatute: parseBooleanFilter(queryParams.requiredByStatute),
      requirementFound: parseRequirementFoundFilter(queryParams.requirementFound),
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
