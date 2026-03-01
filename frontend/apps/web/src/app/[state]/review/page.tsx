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
import { JenAIQueue } from '@/components/review/JenAIQueue';
import {
  getDeveloperModeCountsData,
  getReviewModeCountsData,
  getRedFlagsQueueData,
  getComplianceQueueData,
  getNeedsInfoQueueData,
  getRedFlagDeveloperQueueData,
  getComplianceDeveloperQueueData,
  getComplianceSuggestionQueueData,
  type DeveloperModeCountsData,
  type ReviewModeCountsData,
  type TabCounts,
} from '@/lib/actions/review-page';
import {
  parseSeverityFilter,
  parseBooleanFilter,
  parseRequirementFoundFilter,
  parseTierFilter,
  getReviewPageConfig,
} from '@/lib/url/filter-helpers';
import type { JurisdictionCode, RedFlagFilterOptions } from '@deproceduralizer/database';
import { isValidJurisdiction, JURISDICTION_CONFIG } from '@/types/state';
import type { ReviewType, ReviewMode } from '@/types/regulation';
import type { GroupingModeValue } from '@/lib/constants/values';
import { getComplianceSuggestionBatch } from '@/lib/actions/compliance-issues';

// ============================================
// Shared Types
// ============================================

/** Resolved query parameters from the URL search params */
type ReviewPageQueryParams = {
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
  tierCompleted?: string;
  federalMandate?: string;
  hasAnalysis?: string;
  queueMode?: string;
  groupingMode?: string;
  batchSize?: string;
  shownIds?: string;
  focusType?: string;
  focusSection?: string;
  focusPattern?: string;
};

/** Common context passed to every tab loader */
interface TabLoaderContext {
  stateCode: JurisdictionCode;
  page: number;
  pageSize: number;
  sortOrder: 'asc' | 'desc';
  queryParams: ReviewPageQueryParams;
  pageConfig: { title: string; description: string };
}

/** Error controls for tabs that support them */
interface ErrorControls {
  mode: ReviewMode;
  reviewType: ReviewType;
  tabCounts: TabCounts;
}

// Helper to parse comma-separated IDs from URL
function parseCommaSeparatedIds(value: string | undefined): number[] {
  if (!value) return [];
  return value.split(',').map(Number).filter(id => !isNaN(id));
}

interface PageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<ReviewPageQueryParams>;
}

export default async function ReviewPage({ params, searchParams }: PageProps) {
  const { state } = await params;
  const queryParams = await searchParams;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state as JurisdictionCode;
  const stateConfig = JURISDICTION_CONFIG[stateCode];
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
  const ctx: TabLoaderContext = { stateCode, page, pageSize, sortOrder, queryParams, pageConfig };

  // Developer mode
  if (mode === 'developer') {
    return renderDeveloperMode(ctx, reviewType);
  }

  // Review mode
  return renderReviewMode(ctx, reviewType);
}

// ============================================
// Redirect Logic
// ============================================

function shouldRedirect(
  mode: ReviewMode,
  reviewType: ReviewType,
  queryParams: ReviewPageQueryParams
): boolean {
  if (mode === 'developer') {
    return !queryParams.developerStatus && reviewType !== 'needs_info' && reviewType !== 'jenai';
  }
  // Suggestion mode doesn't need reviewStatus - it always shows unreviewed items
  if (reviewType === 'compliance' && queryParams.queueMode === 'suggestion') {
    return false;
  }
  return !queryParams.reviewStatus && reviewType !== 'needs_info' && reviewType !== 'jenai';
}

function buildRedirectUrl(
  state: string,
  mode: ReviewMode,
  reviewType: ReviewType,
  queryParams: ReviewPageQueryParams
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
  ctx: TabLoaderContext,
  reviewType: ReviewType,
) {
  const countsResult = await getDeveloperModeCountsData(ctx.stateCode);

  if (!countsResult.success) {
    return (
      <ReviewPageError
        title={ctx.pageConfig.title}
        description={ctx.pageConfig.description}
        error={countsResult.error}
      />
    );
  }

  const countsData = countsResult.data;
  const { tabCounts } = countsData;

  switch (reviewType) {
    case 'definitions':
      return loadDeveloperDefinitionsTab(ctx, tabCounts);
    case 'needs_info':
      return loadDeveloperNeedsInfoTab(ctx, tabCounts, countsData.needsInfoCounts);
    case 'jenai':
      return loadDeveloperJenAITab(ctx, tabCounts);
    case 'compliance':
      return loadDeveloperComplianceTab(ctx, tabCounts, countsData.complianceDeveloperStatusCounts);
    default:
      return loadDeveloperRedFlagsTab(ctx, tabCounts, countsData.redFlagDeveloperStatusCounts);
  }
}

// ============================================
// Developer Mode Tab Loaders
// ============================================

async function loadDeveloperDefinitionsTab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
) {
  return (
    <ReviewPageLayout pageConfig={ctx.pageConfig} mode="developer" reviewType="definitions" tabCounts={tabCounts}>
      <DefinitionsDeveloperQueue jurisdiction={ctx.stateCode} />
    </ReviewPageLayout>
  );
}

async function loadDeveloperNeedsInfoTab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
  needsInfoCounts: DeveloperModeCountsData['needsInfoCounts'],
) {
  const errorControls: ErrorControls = { mode: 'developer', reviewType: 'needs_info', tabCounts };
  const itemsResult = await getNeedsInfoQueueData(ctx.stateCode, { page: ctx.page, pageSize: ctx.pageSize });

  if (!itemsResult.success) {
    return (
      <ReviewPageError
        title={ctx.pageConfig.title}
        description={ctx.pageConfig.description}
        error={itemsResult.error}
        controls={errorControls}
      />
    );
  }

  const items = itemsResult.data;
  return (
    <ReviewPageLayout pageConfig={ctx.pageConfig} mode="developer" reviewType="needs_info" tabCounts={tabCounts}>
      <NeedMoreInfoQueue
        initialItems={items.data}
        pagination={{ page: items.page, pageSize: items.pageSize, total: items.total, totalPages: items.totalPages }}
        counts={needsInfoCounts}
      />
    </ReviewPageLayout>
  );
}

async function loadDeveloperJenAITab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
) {
  return (
    <ReviewPageLayout pageConfig={ctx.pageConfig} mode="developer" reviewType="jenai" tabCounts={tabCounts}>
      <JenAIQueue jurisdiction={ctx.stateCode} mode="developer" />
    </ReviewPageLayout>
  );
}

async function loadDeveloperComplianceTab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
  complianceDeveloperStatusCounts: DeveloperModeCountsData['complianceDeveloperStatusCounts'],
) {
  const errorControls: ErrorControls = { mode: 'developer', reviewType: 'compliance', tabCounts };
  const sortBy = (ctx.queryParams.sortBy || 'reviewedAt') as 'severity' | 'issueType' | 'reviewedAt' | 'developerCheckedAt';
  const dataResult = await getComplianceDeveloperQueueData(ctx.stateCode, {
    page: ctx.page,
    pageSize: ctx.pageSize,
    sortBy,
    sortOrder: ctx.sortOrder,
    developerStatus: ctx.queryParams.developerStatus || undefined,
    developerAssigned: ctx.queryParams.developerAssigned || undefined,
    severity: (ctx.queryParams.severity || 'all') as 'high' | 'medium' | 'low' | 'all',
    reviewStatus: ctx.queryParams.reviewStatus || undefined,
    issueType: ctx.queryParams.issueType || undefined,
  });

  if (!dataResult.success) {
    return (
      <ReviewPageError
        title={ctx.pageConfig.title}
        description={ctx.pageConfig.description}
        error={dataResult.error}
        controls={errorControls}
      />
    );
  }

  const { items, issueTypes } = dataResult.data;
  return (
    <ReviewPageLayout pageConfig={ctx.pageConfig} mode="developer" reviewType="compliance" tabCounts={tabCounts}>
      <ComplianceDeveloperQueue
        initialItems={items.data}
        pagination={{ page: items.page, pageSize: items.pageSize, total: items.total, totalPages: items.totalPages }}
        statusCounts={complianceDeveloperStatusCounts}
        issueTypes={issueTypes}
      />
    </ReviewPageLayout>
  );
}

async function loadDeveloperRedFlagsTab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
  redFlagDeveloperStatusCounts: DeveloperModeCountsData['redFlagDeveloperStatusCounts'],
) {
  const errorControls: ErrorControls = { mode: 'developer', reviewType: 'flags', tabCounts };
  const sortBy = (ctx.queryParams.sortBy || 'reviewedAt') as 'severity' | 'category' | 'reviewedAt' | 'developerCheckedAt';
  const dataResult = await getRedFlagDeveloperQueueData(ctx.stateCode, {
    page: ctx.page,
    pageSize: ctx.pageSize,
    sortBy,
    sortOrder: ctx.sortOrder,
    developerStatus: ctx.queryParams.developerStatus || undefined,
    developerAssigned: ctx.queryParams.developerAssigned || undefined,
    severity: (ctx.queryParams.severity || 'all') as 'high' | 'medium' | 'low' | 'all',
    reviewStatus: ctx.queryParams.reviewStatus || undefined,
    category: ctx.queryParams.category || undefined,
  });

  if (!dataResult.success) {
    return (
      <ReviewPageError
        title={ctx.pageConfig.title}
        description={ctx.pageConfig.description}
        error={dataResult.error}
        controls={errorControls}
      />
    );
  }

  const { items, categories } = dataResult.data;
  return (
    <ReviewPageLayout pageConfig={ctx.pageConfig} mode="developer" reviewType="flags" tabCounts={tabCounts}>
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
  ctx: TabLoaderContext,
  reviewType: ReviewType,
) {
  const countsResult = await getReviewModeCountsData(ctx.stateCode);

  if (!countsResult.success) {
    return (
      <ReviewPageError
        title={ctx.pageConfig.title}
        description={ctx.pageConfig.description}
        error={countsResult.error}
      />
    );
  }

  const countsData = countsResult.data;
  const { tabCounts } = countsData;

  switch (reviewType) {
    case 'definitions':
      return loadReviewDefinitionsTab(ctx, tabCounts);
    case 'needs_info':
      return loadReviewNeedsInfoTab(ctx, tabCounts, countsData.needsInfoCounts);
    case 'jenai':
      return loadReviewJenAITab(ctx, tabCounts);
    case 'compliance':
      return loadReviewComplianceTab(ctx, tabCounts, countsData.complianceStatusCounts);
    default:
      return loadReviewRedFlagsTab(ctx, tabCounts, countsData.flagStatusCounts);
  }
}

// ============================================
// Review Mode Tab Loaders
// ============================================

async function loadReviewDefinitionsTab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
) {
  return (
    <ReviewPageLayout pageConfig={ctx.pageConfig} mode="review" reviewType="definitions" tabCounts={tabCounts}>
      <DefinitionsReviewQueue jurisdiction={ctx.stateCode} />
    </ReviewPageLayout>
  );
}

async function loadReviewNeedsInfoTab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
  needsInfoCounts: ReviewModeCountsData['needsInfoCounts'],
) {
  const errorControls: ErrorControls = { mode: 'review', reviewType: 'needs_info', tabCounts };
  const itemsResult = await getNeedsInfoQueueData(ctx.stateCode, { page: ctx.page, pageSize: ctx.pageSize });

  if (!itemsResult.success) {
    return (
      <ReviewPageError
        title={ctx.pageConfig.title}
        description={ctx.pageConfig.description}
        error={itemsResult.error}
        controls={errorControls}
      />
    );
  }

  const items = itemsResult.data;
  return (
    <ReviewPageLayout pageConfig={ctx.pageConfig} mode="review" reviewType="needs_info" tabCounts={tabCounts}>
      <NeedMoreInfoQueue
        initialItems={items.data}
        pagination={{ page: items.page, pageSize: items.pageSize, total: items.total, totalPages: items.totalPages }}
        counts={needsInfoCounts}
      />
    </ReviewPageLayout>
  );
}

async function loadReviewJenAITab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
) {
  return (
    <ReviewPageLayout pageConfig={ctx.pageConfig} mode="review" reviewType="jenai" tabCounts={tabCounts}>
      <JenAIQueue jurisdiction={ctx.stateCode} mode="review" />
    </ReviewPageLayout>
  );
}

async function loadReviewComplianceTab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
  complianceStatusCounts: ReviewModeCountsData['complianceStatusCounts'],
) {
  const errorControls: ErrorControls = { mode: 'review', reviewType: 'compliance', tabCounts };
  // Default to 'suggestion' mode unless explicitly set to 'filter'
  const queueMode = ctx.queryParams.queueMode === 'filter' ? 'filter' : 'suggestion';

  if (queueMode === 'suggestion') {
    return loadReviewComplianceSuggestionTab(ctx, tabCounts, complianceStatusCounts, errorControls);
  }

  return loadReviewComplianceFilterTab(ctx, tabCounts, complianceStatusCounts, errorControls);
}

async function loadReviewComplianceSuggestionTab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
  complianceStatusCounts: ReviewModeCountsData['complianceStatusCounts'],
  errorControls: ErrorControls,
) {
  const batchSize = Math.min(5, Math.max(2, parseInt(ctx.queryParams.batchSize || '3', 10)));
  const groupingMode = (ctx.queryParams.groupingMode || 'issue_type') as GroupingModeValue;
  const shownIds = parseCommaSeparatedIds(ctx.queryParams.shownIds);
  const focus = {
    issueType: ctx.queryParams.focusType || undefined,
    section: ctx.queryParams.focusSection || undefined,
    pattern: ctx.queryParams.focusPattern || undefined,
  };

  const dataResult = await getComplianceSuggestionQueueData(ctx.stateCode, {
    batchSize,
    excludeIds: shownIds,
    groupingMode,
    focus: Object.values(focus).some(v => v) ? focus : undefined,
  });

  if (!dataResult.success) {
    return (
      <ReviewPageError
        title={ctx.pageConfig.title}
        description={ctx.pageConfig.description}
        error={dataResult.error}
        controls={errorControls}
      />
    );
  }

  const { batch, issueTypes } = dataResult.data;

  // Create a fetch function for the client to call for subsequent batches
  // Note: stateCode is captured from ctx in the closure
  const stateCode = ctx.stateCode;
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
    <ReviewPageLayout pageConfig={ctx.pageConfig} mode="review" reviewType="compliance" tabCounts={tabCounts}>
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

async function loadReviewComplianceFilterTab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
  complianceStatusCounts: ReviewModeCountsData['complianceStatusCounts'],
  errorControls: ErrorControls,
) {
  const sortBy = (ctx.queryParams.sortBy || 'severity') as 'issueType' | 'createdAt' | 'reviewedAt' | 'severity';
  const filters = {
    status: ctx.queryParams.reviewStatus === 'all' ? undefined : ctx.queryParams.reviewStatus,
    issueType: ctx.queryParams.issueType || undefined,
    severity: parseSeverityFilter(ctx.queryParams.severity),
    requiredByStatute: parseBooleanFilter(ctx.queryParams.requiredByStatute),
    requirementFound: parseRequirementFoundFilter(ctx.queryParams.requirementFound),
    // Research pipeline filters
    tierCompleted: parseTierFilter(ctx.queryParams.tierCompleted),
    federalMandate: parseBooleanFilter(ctx.queryParams.federalMandate),
    hasAnalysis: parseBooleanFilter(ctx.queryParams.hasAnalysis),
  };

  const dataResult = await getComplianceQueueData(ctx.stateCode, {
    page: ctx.page,
    pageSize: ctx.pageSize,
    sortBy,
    sortOrder: ctx.sortOrder,
    filters,
  });

  if (!dataResult.success) {
    return (
      <ReviewPageError
        title={ctx.pageConfig.title}
        description={ctx.pageConfig.description}
        error={dataResult.error}
        controls={errorControls}
      />
    );
  }

  const { issues, issueTypes } = dataResult.data;
  return (
    <ReviewPageLayout pageConfig={ctx.pageConfig} mode="review" reviewType="compliance" tabCounts={tabCounts}>
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

async function loadReviewRedFlagsTab(
  ctx: TabLoaderContext,
  tabCounts: TabCounts,
  flagStatusCounts: ReviewModeCountsData['flagStatusCounts'],
) {
  const errorControls: ErrorControls = { mode: 'review', reviewType: 'flags', tabCounts };
  const sortBy = (ctx.queryParams.sortBy || 'severity') as 'severity' | 'category' | 'reviewedAt';
  const filters: Omit<RedFlagFilterOptions, 'jurisdiction'> = {
    status: ctx.queryParams.reviewStatus === 'all' ? 'all' : (ctx.queryParams.reviewStatus as RedFlagFilterOptions['status']),
    severity: ctx.queryParams.severity as 'high' | 'medium' | 'low' | undefined,
    category: ctx.queryParams.category || undefined,
  };

  const dataResult = await getRedFlagsQueueData(ctx.stateCode, {
    page: ctx.page,
    pageSize: ctx.pageSize,
    sortBy,
    sortOrder: ctx.sortOrder,
    filters,
  });

  if (!dataResult.success) {
    return (
      <ReviewPageError
        title={ctx.pageConfig.title}
        description={ctx.pageConfig.description}
        error={dataResult.error}
        controls={errorControls}
      />
    );
  }

  const { flags, categories } = dataResult.data;
  return (
    <ReviewPageLayout pageConfig={ctx.pageConfig} mode="review" reviewType="flags" tabCounts={tabCounts}>
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
  tabCounts: { flags: number; compliance: number; definitions: number; needs_info: number; jenai: number };
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
