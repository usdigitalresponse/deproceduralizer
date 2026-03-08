'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useQueryStates } from 'nuqs';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import type { JurisdictionCode, AnalysisListItem, GuidanceAnalysisListItem } from '@deproceduralizer/database';
import type { PipelineSourceValue } from '@/lib/constants/values';
import { analysisTableParsers } from '@/lib/url/parsers';
import {
  getAnalysisListPaginated,
  getGuidanceAnalysisListPaginated,
  type PaginatedAnalysisResult,
  type PaginatedGuidanceAnalysisResult,
} from '@/lib/actions/analysis';
import {
  getBookmarkedDocIssuePairs,
  getBookmarkedGuidanceDocIssuePairs,
  toggleAnalysisBookmarkByDocIssue,
  toggleGuidanceAnalysisBookmarkByDocIssue,
} from '@/lib/actions/bookmarks';
import { ClassificationBadge } from '@/components/issues/TierClassificationFlow';
import { Badge, BookmarkButton } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';

/** Unified row type used by the table for both regulation and guidance items */
type UnifiedAnalysisRow = {
  issueType: string;
  documentTitle: string | null;
  highestTierCompleted: number;
  tier1Classification: string | null;
  tier2Classification: string | null;
  tier3Classification: string | null;
  finalSeverity: number | null;
  federalMandateFound: boolean;
  isJustified: boolean;
  rerunCount: number;
  createdAt: Date | null;
  easyCleanupCandidate: boolean;
  cleanupType: string | null;
  cleanupEffort: string | null;
  tier3TriggerReason: string | null;
} & (
  | { kind: 'regulation'; documentId: number; citation: string | null }
  | { kind: 'guidance'; guidanceDocumentId: number; agency: string | null; docType: string | null; canonicalRef: string | null }
);

function toUnifiedRows(source: PipelineSourceValue | undefined, data: PaginatedAnalysisResult | PaginatedGuidanceAnalysisResult): UnifiedAnalysisRow[] {
  if (source === 'guidance') {
    return (data as PaginatedGuidanceAnalysisResult).data.map((item) => ({
      ...item,
      kind: 'guidance' as const,
    }));
  }
  return (data as PaginatedAnalysisResult).data.map((item) => ({
    ...item,
    kind: 'regulation' as const,
  }));
}

interface AnalysisTableProps {
  jurisdiction: JurisdictionCode;
  source?: PipelineSourceValue;
}

export function AnalysisTable({ jurisdiction, source }: AnalysisTableProps) {
  const isGuidance = source === 'guidance';
  const [filters] = useQueryStates(analysisTableParsers);
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<UnifiedAnalysisRow[]>([]);
  const [pagination, setPagination] = useState<{ total: number; page: number; pageSize: number; totalPages: number } | null>(null);
  const [, setFilters] = useQueryStates(analysisTableParsers);
  const [bookmarkedPairs, setBookmarkedPairs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Fetch bookmarked items for the active source
  useEffect(() => {
    let cancelled = false;
    async function fetchBookmarks() {
      const result = isGuidance
        ? await getBookmarkedGuidanceDocIssuePairs(jurisdiction)
        : await getBookmarkedDocIssuePairs(jurisdiction);
      if (!cancelled && result.success) {
        setBookmarkedPairs(result.data);
      }
    }
    fetchBookmarks();
    return () => { cancelled = true; };
  }, [jurisdiction, isGuidance]);

  // Handle bookmark toggle with optimistic update
  const handleBookmarkToggle = useCallback(async (docId: number, issueType: string) => {
    const key = `${docId}-${issueType}`;
    const wasBookmarked = bookmarkedPairs.has(key);

    // Optimistic update
    setBookmarkedPairs(prev => {
      const next = new Set(prev);
      if (wasBookmarked) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    // Server update — use the right action based on source
    const result = isGuidance
      ? await toggleGuidanceAnalysisBookmarkByDocIssue(docId, issueType, jurisdiction)
      : await toggleAnalysisBookmarkByDocIssue(docId, issueType, jurisdiction);

    // Revert if failed
    if (!result.success) {
      setBookmarkedPairs(prev => {
        const next = new Set(prev);
        if (wasBookmarked) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
      console.error('Failed to toggle bookmark:', result.error);
    }
  }, [jurisdiction, bookmarkedPairs, isGuidance]);

  // Build shared filter object from URL state
  const buildFilters = useCallback(() => ({
    tierCompleted: filters.tierCompleted !== 'all' ? parseInt(filters.tierCompleted) : undefined,
    classification: filters.classification !== 'all' ? filters.classification : undefined,
    federalMandate: filters.federalMandate !== 'all' ? filters.federalMandate === 'true' : undefined,
    pipelineRun: filters.pipelineRun !== 'all' ? filters.pipelineRun === 'true' : undefined,
    issueType: filters.issueType && filters.issueType !== 'all' ? filters.issueType : undefined,
    severity: filters.severity !== 'all' ? filters.severity : undefined,
    severityChanged: filters.severityChanged !== 'all' ? filters.severityChanged : undefined,
    federalMandateConfirmed: filters.federalMandateConfirmed !== 'all' ? filters.federalMandateConfirmed : undefined,
    stateDiscretion: filters.stateDiscretion !== 'all' ? filters.stateDiscretion : undefined,
    alternativeFound: filters.alternativeFound !== 'all' ? filters.alternativeFound : undefined,
    evidenceGap: filters.evidenceGap !== 'all' ? filters.evidenceGap : undefined,
    supersededByLaw: filters.supersededByLaw !== 'all' ? filters.supersededByLaw : undefined,
    advocacyForChange: filters.advocacyForChange !== 'all' ? filters.advocacyForChange : undefined,
    tier3Trigger: filters.tier3Trigger !== 'all' ? filters.tier3Trigger : undefined,
    easyCleanup: filters.easyCleanup !== 'all' ? filters.easyCleanup : undefined,
    bookmarkedOnly: filters.bookmarkedOnly === 'true' ? true : undefined,
  }), [filters]);

  // Fetch data when filters or source change
  useEffect(() => {
    startTransition(async () => {
      const options = {
        page: filters.page,
        pageSize: filters.pageSize,
        sortBy: filters.sortBy as 'issueType' | 'severity' | 'highestTier' | 'createdAt',
        sortOrder: filters.sortOrder as 'asc' | 'desc',
        filters: buildFilters(),
      };

      if (isGuidance) {
        const result = await getGuidanceAnalysisListPaginated(jurisdiction, options);
        if (result.success) {
          setError(null);
          setRows(toUnifiedRows(source, result.data));
          setPagination({ total: result.data.total, page: result.data.page, pageSize: result.data.pageSize, totalPages: result.data.totalPages });
        } else {
          console.error('[AnalysisTable] Failed to fetch data:', result.error);
          setError(result.error);
        }
      } else {
        const result = await getAnalysisListPaginated(jurisdiction, options);
        if (result.success) {
          setError(null);
          setRows(toUnifiedRows(source, result.data));
          setPagination({ total: result.data.total, page: result.data.page, pageSize: result.data.pageSize, totalPages: result.data.totalPages });
        } else {
          console.error('[AnalysisTable] Failed to fetch data:', result.error);
          setError(result.error);
        }
      }
    });
  }, [jurisdiction, filters, isGuidance, source, buildFilters]);

  const handlePageChange = (newPage: number) => {
    setFilters({ page: newPage });
  };

  if (error) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-background)] p-8 text-center">
        <p className="text-[var(--color-danger)] font-medium">Failed to load pipeline data</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">{error}</p>
      </div>
    );
  }

  if (!pagination && isPending) {
    return (
      <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-8 text-center">
        <div className="animate-pulse text-[var(--color-text-muted)]">Loading pipeline data...</div>
      </div>
    );
  }

  if (!pagination || rows.length === 0) {
    return (
      <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-8 text-center">
        <p className="text-[var(--color-text-muted)]">No pipeline records found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
              <th className="w-10 px-2 py-3"></th>
              <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Issue Type</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Document</th>
              <th className="text-center px-2 py-3 font-medium text-[var(--color-text-muted)]">T1</th>
              <th className="text-center px-2 py-3 font-medium text-[var(--color-text-muted)]">T2</th>
              <th className="text-center px-2 py-3 font-medium text-[var(--color-text-muted)]">T3</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Severity</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Federal</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Easy Fix</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const rowKey = item.kind === 'guidance'
                ? `g-${item.guidanceDocumentId}-${item.issueType}`
                : `r-${item.documentId}-${item.issueType}`;
              const docId = item.kind === 'guidance' ? item.guidanceDocumentId : item.documentId;
              return (
                <AnalysisTableRow
                  key={rowKey}
                  item={item}
                  jurisdiction={jurisdiction}
                  isBookmarked={bookmarkedPairs.has(`${docId}-${item.issueType}`)}
                  onBookmarkToggle={() => handleBookmarkToggle(docId, item.issueType)}
                  isGuidance={isGuidance}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
        <div className="text-xs text-[var(--color-text-muted)]">
          Showing {(pagination.page - 1) * pagination.pageSize + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total.toLocaleString()}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
            className="p-1.5 rounded border border-[var(--color-neutral-300)] hover:bg-[var(--color-neutral-100)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-sm text-[var(--color-text-muted)]">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || isPending}
            className="p-1.5 rounded border border-[var(--color-neutral-300)] hover:bg-[var(--color-neutral-100)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}

interface AnalysisTableRowProps {
  item: UnifiedAnalysisRow;
  jurisdiction: JurisdictionCode;
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  isGuidance: boolean;
}

function AnalysisTableRow({ item, jurisdiction, isBookmarked, onBookmarkToggle, isGuidance }: AnalysisTableRowProps) {
  const issueTypeLabel = ISSUE_TYPE_LABELS[item.issueType as keyof typeof ISSUE_TYPE_LABELS] || item.issueType;

  // Priority left border: red for critical quick wins, amber for high severity only
  const isQuickWin = (item.finalSeverity ?? 0) >= 7 && item.easyCleanupCandidate;
  const isHighSeverity = (item.finalSeverity ?? 0) >= 7;
  const borderClass = isQuickWin
    ? 'border-l-4 border-l-[var(--color-danger)]'
    : isHighSeverity
      ? 'border-l-4 border-l-[var(--color-warning)]'
      : '';

  // Build the detail link based on source type
  const detailHref = item.kind === 'guidance'
    ? `/${jurisdiction.toLowerCase()}/pipeline/guidance/${item.guidanceDocumentId}/${item.issueType}`
    : `/${jurisdiction.toLowerCase()}/pipeline/${item.documentId}/${item.issueType}`;

  return (
    <tr className={`border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] ${borderClass}`}>
      {/* Bookmark */}
      <td className="px-2 py-3 text-center">
        <BookmarkButton
          isBookmarked={isBookmarked}
          onToggle={onBookmarkToggle}
          size="sm"
        />
      </td>

      {/* Issue Type */}
      <td className="px-4 py-3">
        <Badge variant="warning" className="text-xs">
          {issueTypeLabel}
        </Badge>
      </td>

      {/* Document */}
      <td className="px-4 py-3 max-w-xs">
        {item.kind === 'guidance' ? (
          <>
            {item.agency && (
              <div className="truncate text-xs text-[var(--color-text-muted)] font-medium" title={item.agency}>
                {item.agency}
              </div>
            )}
            <div className="truncate text-[var(--color-text)]" title={item.documentTitle || ''}>
              {item.documentTitle || 'Untitled'}
            </div>
          </>
        ) : (
          <>
            <div className="truncate text-[var(--color-text)]" title={item.documentTitle || ''}>
              {item.documentTitle || 'Untitled'}
            </div>
            {item.citation && (
              <div className="truncate text-xs text-[var(--color-text-muted)] font-mono" title={item.citation}>
                {item.citation}
              </div>
            )}
          </>
        )}
      </td>

      {/* Tier Classifications (V5: 3 tiers, T3 = web search) */}
      <td className="px-2 py-3 text-center">
        <ClassificationBadge classification={item.tier1Classification} />
      </td>
      <td className="px-2 py-3 text-center">
        <div className="flex flex-col items-center gap-0.5">
          <ClassificationBadge classification={item.tier2Classification} />
          {item.rerunCount > 0 && (
            <span
              className="text-[10px] px-1 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-medium"
              title={`Tier 2 required ${item.rerunCount} re-run(s) for additional context`}
            >
              {item.rerunCount}x rerun
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-3 text-center">
        <ClassificationBadge classification={item.tier3Classification} />
      </td>

      {/* Severity */}
      <td className="px-3 py-3 text-center">
        {item.finalSeverity !== null ? (
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              item.finalSeverity >= 7
                ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                : item.finalSeverity >= 4
                  ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                  : 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
            }`}
          >
            {item.finalSeverity}
          </span>
        ) : (
          <span className="text-[var(--color-text-muted)]">{'\u2014'}</span>
        )}
      </td>

      {/* Federal Mandate */}
      <td className="px-3 py-3 text-center">
        {item.federalMandateFound ? (
          <Badge variant="danger" className="text-xs">Yes</Badge>
        ) : (
          <span className="text-[var(--color-text-muted)]">{'\u2014'}</span>
        )}
      </td>

      {/* Easy Cleanup */}
      <td className="px-3 py-3 text-center">
        {item.easyCleanupCandidate ? (
          <Badge
            variant="success"
            className="text-xs"
            title={item.cleanupType === 'alternative_in_practice'
              ? 'Alternative already accepted in practice'
              : item.cleanupType === 'alternative_authorized'
                ? 'State has authorized alternative'
                : 'Peer state has solution'}
          >
            {item.cleanupEffort === 'trivial' ? '\uD83C\uDFAF Trivial' :
             item.cleanupEffort === 'easy' ? '\u2728 Easy' :
             '\uD83D\uDCCB Medium'}
          </Badge>
        ) : (
          <span className="text-[var(--color-text-muted)]">{'\u2014'}</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3 text-center">
        <Link
          href={detailHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
        >
          View
          <ExternalLink className="w-3 h-3" />
        </Link>
      </td>
    </tr>
  );
}

export default AnalysisTable;
