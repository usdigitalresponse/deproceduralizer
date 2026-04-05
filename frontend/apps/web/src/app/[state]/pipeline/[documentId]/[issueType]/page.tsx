import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck, ExternalLink, Printer } from 'lucide-react';
import type { DismissedMatch } from '@deproceduralizer/database';
import { getFullAnalysisRecord, getRegexMatchesForAnalysis } from '@/lib/actions/analysis';
import { getAncestorChain } from '@/lib/actions/hierarchy';
import {
  PipelineTimeline,
  AnalysisBookmarkProvider,
  BookmarkToggle,
  BookmarkNotesCard,
  PrintModeProvider,
  RegexMatchesSection,
  PrintButton,
  PrintModeStyles,
  SeverityProgression,
  ExecutiveSummary,
  RegulatoryContext,
} from '@/components/analysis';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Badge, ScrollToHash, ReviewSummaryText } from '@/components/ui';
import { ClassificationBadge, TierClassificationFlow } from '@/components/issues/TierClassificationFlow';
import { isValidJurisdiction } from '@/types/state';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { PipelineSectionTabs } from './PipelineSectionTabs';
import type { SectionConfig } from '@/hooks/useActiveSection';

interface AnalysisDetailPageProps {
  params: Promise<{
    state: string;
    documentId: string;
    issueType: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AnalysisDetailPage({ params, searchParams }: AnalysisDetailPageProps) {
  const { state, documentId, issueType } = await params;
  const resolvedSearchParams = await searchParams;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const docId = parseInt(documentId, 10);
  if (isNaN(docId)) {
    notFound();
  }

  // Parse print mode from search params (simple string check for server component)
  const printParam = resolvedSearchParams.print;
  const isPrintMode = printParam === 'true' || printParam === '1';

  // Support back navigation from search results or other pages
  const fromParam = typeof resolvedSearchParams.from === 'string' ? resolvedSearchParams.from : null;
  const backUrl = fromParam ? decodeURIComponent(fromParam) : `/${state}/pipeline`;
  const backLabel = fromParam ? 'Back to search results' : 'Back to Research Pipeline';

  const stateCode = state;

  // Fetch full analysis record, regex matches, and ancestor chain in parallel
  const [analysisResult, matchesResult, ancestorResult] = await Promise.all([
    getFullAnalysisRecord(docId, issueType),
    getRegexMatchesForAnalysis(docId, issueType),
    getAncestorChain(docId),
  ]);

  if (!analysisResult.success || !analysisResult.data) {
    notFound();
  }

  const analysis = analysisResult.data;
  const matches = matchesResult?.success ? matchesResult.data : [];
  const ancestors = ancestorResult?.success ? ancestorResult.data : [];
  const issueTypeLabel = ISSUE_TYPE_LABELS[issueType as keyof typeof ISSUE_TYPE_LABELS] || issueType;

  const sections: SectionConfig[] = [
    { id: 'section-overview', label: 'Overview' },
    { id: 'section-summary', label: 'Key Findings' },
    ...(analysis.easyCleanupCandidate ? [{ id: 'section-cleanup', label: 'Easy Cleanup' }] : []),
    { id: 'section-severity', label: 'Severity' },
    ...(matches && matches.length > 0 ? [{ id: 'matches', label: 'Matches', count: matches.length }] : []),
    { id: 'section-pipeline', label: 'Pipeline' },
  ];

  return (
    <PrintModeProvider isPrintMode={isPrintMode}>
    <PrintModeStyles isPrintMode={isPrintMode} />
    <ScrollToHash />
    <AnalysisBookmarkProvider documentId={docId} issueType={issueType} jurisdiction={stateCode}>
      <div className="bg-[var(--color-background)] min-h-screen">
        {/* Print Preview Header - only visible in print mode, hidden when actually printing */}
        {isPrintMode && (
          <div className="print:hidden bg-[var(--color-info-bg)] border-b border-[var(--color-info)] px-4 py-3">
            <Container size="2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--color-info)]">
                  <Printer className="w-5 h-5" />
                  <span className="font-medium">Print Preview Mode</span>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    - All sections expanded
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <PrintButton />
                  <Link
                    href={`/${state}/pipeline/${documentId}/${issueType}`}
                    className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    Exit Preview
                  </Link>
                </div>
              </div>
            </Container>
          </div>
        )}

        {/* PageHeader - hidden in print mode */}
        {!isPrintMode && (
          <PageHeader
            title={`Pipeline: ${issueTypeLabel}`}
            description={analysis.document.title || analysis.document.citation || 'Pipeline Detail'}
          />
        )}

        {/* Sticky Navigation Bar - hidden in print mode */}
        {!isPrintMode && (
          <div className="sticky top-0 z-[calc(var(--z-sticky)+1)] bg-[var(--color-background)] border-b border-[var(--color-neutral-200)] -mx-4 px-4 py-3 mb-6 shadow-sm print:hidden">
            <Container size="2xl">
              <div className="flex items-center justify-between">
                <Link
                  href={backUrl}
                  className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">{backLabel}</span>
                </Link>

                <div className="flex items-center gap-2 sm:gap-4">
                  <BookmarkToggle />
                  <Link
                    href={`?print=true`}
                    target="_blank"
                    className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Print View</span>
                  </Link>
                  <Link
                    href={`/${state}/regulations/${docId}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    <span className="hidden sm:inline">View Regulation</span>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  {matches.length === 1 ? (
                    <Link
                      href={`/${state}/review/compliance/${matches[0].id}`}
                      className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span className="hidden sm:inline">Review Issue</span>
                    </Link>
                  ) : matches.length > 1 ? (
                    <a
                      href="#matches"
                      className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span className="hidden sm:inline">Review Issues ({matches.length})</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </Container>
            <Container size="2xl">
              <PipelineSectionTabs sections={sections} />
            </Container>
          </div>
        )}

        <Container size="2xl" className="py-6">

          {/* Bookmark Notes Card - shown when marked, immediately below sticky nav */}
          {!isPrintMode && <BookmarkNotesCard />}

          {/* Header Card */}
        <div id="section-overview" className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6 mb-6">
          <div className="flex flex-wrap items-start gap-4 mb-4">
            <Badge variant="warning" className="text-base font-semibold">
              {issueTypeLabel}
            </Badge>
            {analysis.isJustified && (
              <Badge variant="success">Justified</Badge>
            )}
            {analysis.requirementFound === true && (
              <Badge variant="success">Requirement Found</Badge>
            )}
            {analysis.requirementFound === false && (
              <Badge variant="default">No Requirement</Badge>
            )}
            {analysis.tier3?.federalMandateFound && (
              <Badge variant="danger">Federal Mandate</Badge>
            )}
          </div>

          <h1 className="text-xl font-bold text-[var(--color-text)] mb-2">
            {analysis.document.title || 'Untitled Document'}
          </h1>

          {analysis.document.citation && (
            <p className="text-sm font-mono text-[var(--color-text-muted)] mb-4">
              {analysis.document.citation}
            </p>
          )}

          {/* Regulatory Context - hierarchy breadcrumb, summary, tags */}
          <RegulatoryContext
            ancestors={ancestors}
            document={analysis.document}
            state={stateCode}
            reviewSummary={analysis.reviewSummary}
          />

          {/* Tier Classification Flow */}
          <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
            <TierClassificationFlow
              highestTierCompleted={analysis.highestTierCompleted}
              tier1Classification={analysis.tier1?.classification || null}
              tier2Classification={analysis.tier2?.classification || null}
              tier3Classification={analysis.tier3?.classification || null}
            />
          </div>

          {/* Final Outcome */}
          <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)] grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-[var(--color-text-muted)]">Final Classification</span>
              <div className="mt-1">
                <ClassificationBadge
                  classification={
                    analysis.tier3?.classification ||
                    analysis.tier2?.classification ||
                    analysis.tier1?.classification
                  }
                />
              </div>
            </div>

            <div>
              <span className="text-xs text-[var(--color-text-muted)]">Final Severity</span>
              <div className="text-2xl font-bold text-[var(--color-warning)]">
                {analysis.finalSeverity ?? '—'}
              </div>
            </div>

            <div>
              <span className="text-xs text-[var(--color-text-muted)]">Classification Tier</span>
              <div className="text-2xl font-bold text-[var(--color-primary)]">
                T{analysis.classificationTier ?? analysis.highestTierCompleted}
              </div>
            </div>

            <div>
              <span className="text-xs text-[var(--color-text-muted)]">Grouped Matches</span>
              <div className="text-2xl font-bold text-[var(--color-text)]">
                {analysis.groupedMatchCount}
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary — web search details for T3, classification fallback for T2/pre-backfill */}
        <div id="section-summary">
          <ExecutiveSummary analysis={analysis} />
        </div>

        {/* Easy Cleanup Card - shown when flagged as easy cleanup opportunity */}
        {analysis.easyCleanupCandidate && (
          <div id="section-cleanup" className="bg-[var(--color-success-bg)] border border-[var(--color-success)] rounded-[var(--radius-md)] p-6 mb-6">
            <div className="flex items-start gap-4">
              <span className="text-2xl" role="img" aria-label="Easy Fix">🎯</span>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-lg font-bold text-[var(--color-success)]">
                    Easy Cleanup Opportunity
                  </h2>
                  <Badge variant="success">
                    {analysis.cleanupEffort === 'trivial' ? 'Trivial Fix' :
                     analysis.cleanupEffort === 'easy' ? 'Easy Fix' :
                     'Medium Fix'}
                  </Badge>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium text-[var(--color-text-muted)]">Type: </span>
                    <span className="text-[var(--color-text)]">
                      {analysis.cleanupType === 'alternative_in_practice'
                        ? 'Alternative Already Accepted in Practice'
                        : analysis.cleanupType === 'alternative_authorized'
                        ? 'State Has Authorized Alternative'
                        : 'Peer State Has Solution'}
                    </span>
                  </div>

                  {analysis.cleanupEvidence && (
                    <div>
                      <span className="font-medium text-[var(--color-text-muted)]">Evidence: </span>
                      <span className="text-[var(--color-text)]">{analysis.cleanupEvidence}</span>
                    </div>
                  )}

                  {analysis.cleanupRecommendation && (
                    <div className="mt-3 p-3 bg-white rounded border border-[var(--color-success)]">
                      <span className="font-medium text-[var(--color-text-muted)] block mb-1">Recommended Fix:</span>
                      <span className="text-[var(--color-text)]">{analysis.cleanupRecommendation}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Severity Progression - moved up from PipelineTimeline */}
        <div id="section-severity" className="mb-6">
          <SeverityProgression
            baseSeverity={analysis.tier2?.severity || null}
            tier3Adjustment={analysis.tier3?.severityAdjustment || null}
            finalSeverity={analysis.finalSeverity}
            tier2Calculation={analysis.tier2?.severityCalculation || null}
            tier3Reasoning={analysis.tier3?.severityAdjustmentReasoning || null}
          />
        </div>

        {/* Regex Matches Section - collapsible in standard view, expanded in print mode */}
        {matches && matches.length > 0 && (
          <div id="matches" className="mb-6 bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6">
            <RegexMatchesSection
              matches={matches}
              relevantMatchIds={analysis.tier1?.relevantMatchIds || []}
              dismissedReasons={(analysis.tier1?.dismissedReasons as DismissedMatch[]) || []}
              collapsible={!isPrintMode}
              defaultExpanded={!!fromParam}
              state={stateCode}
            />
          </div>
        )}

        {/* Pipeline Timeline */}
        <div id="section-pipeline" className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6">
          <PipelineTimeline analysis={analysis} />
        </div>

        {/* Metadata */}
        <div id="section-metadata" className="mt-6 text-xs text-[var(--color-text-muted)] flex flex-wrap gap-4">
          <span>Pipeline Version: {analysis.pipelineVersion}</span>
          {analysis.createdAt && (
            <span>Created: {new Date(analysis.createdAt).toLocaleDateString()}</span>
          )}
          {analysis.updatedAt && (
            <span>Updated: {new Date(analysis.updatedAt).toLocaleDateString()}</span>
          )}
        </div>
      </Container>
      </div>
    </AnalysisBookmarkProvider>
    </PrintModeProvider>
  );
}
