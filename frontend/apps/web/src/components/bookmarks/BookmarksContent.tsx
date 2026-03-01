'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Trash2, ExternalLink, FileText, ListChecks, Sparkles, AlertTriangle, Zap } from 'lucide-react';
import type { BookmarkWithDetails, JurisdictionCode } from '@deproceduralizer/database';
import { Badge } from '@/components/ui';
import { removeBookmark, updateBookmarkNotes } from '@/lib/actions/bookmarks';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { BookmarkNotesEditor } from './BookmarkNotesEditor';

interface BookmarksContentProps {
  bookmarks: BookmarkWithDetails[];
  counts: { analysis: number; document: number; total: number };
  jurisdiction: JurisdictionCode;
}

type BookmarkTab = 'analysis' | 'document';

export function BookmarksContent({ bookmarks, counts, jurisdiction }: BookmarksContentProps) {
  const [activeTab, setActiveTab] = useState<BookmarkTab>('analysis');
  const [localBookmarks, setLocalBookmarks] = useState(bookmarks);

  const filteredBookmarks = localBookmarks.filter(b =>
    activeTab === 'analysis' ? b.analysisId !== null : b.analysisId === null
  );

  // Count easy fixes and federal mandates for summary
  const easyFixCount = filteredBookmarks.filter(b => b.easyCleanupCandidate).length;
  const federalCount = filteredBookmarks.filter(b => b.federalMandateFound).length;

  const handleRemove = useCallback(async (bookmarkId: number) => {
    setLocalBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
    const result = await removeBookmark(bookmarkId);
    if (!result.success) {
      setLocalBookmarks(bookmarks);
      console.error('Failed to remove bookmark:', result.error);
    }
  }, [bookmarks]);

  const handleSaveNotes = useCallback(async (bookmarkId: number, notes: string) => {
    const result = await updateBookmarkNotes(bookmarkId, notes);
    if (result.success) {
      setLocalBookmarks(prev =>
        prev.map(b => b.id === bookmarkId ? { ...b, notes } : b)
      );
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Tab Buttons */}
      <div className="flex gap-2 border-b border-[var(--color-neutral-200)]">
        <button
          onClick={() => setActiveTab('analysis')}
          className={`
            flex items-center gap-2 px-4 py-2 -mb-px text-sm font-medium transition-colors
            ${activeTab === 'analysis'
              ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }
          `}
        >
          <ListChecks className="w-4 h-4" />
          Analyses
          <Badge variant="default" className="text-xs ml-1">
            {counts.analysis}
          </Badge>
        </button>
        <button
          onClick={() => setActiveTab('document')}
          className={`
            flex items-center gap-2 px-4 py-2 -mb-px text-sm font-medium transition-colors
            ${activeTab === 'document'
              ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }
          `}
        >
          <FileText className="w-4 h-4" />
          Documents
          <Badge variant="default" className="text-xs ml-1">
            {counts.document}
          </Badge>
        </button>
      </div>

      {/* Summary Stats (Analysis tab only) */}
      {activeTab === 'analysis' && filteredBookmarks.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          {easyFixCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-success-bg)] text-[var(--color-success)] rounded-full">
              <Sparkles className="w-4 h-4" />
              <span className="font-medium">{easyFixCount} Easy Fix{easyFixCount !== 1 ? 'es' : ''}</span>
            </div>
          )}
          {federalCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded-full">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">{federalCount} Federal Mandate{federalCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Bookmarks List */}
      {filteredBookmarks.length === 0 ? (
        <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-8 text-center">
          <p className="text-[var(--color-text-muted)]">
            No {activeTab === 'analysis' ? 'analyses' : 'documents'} bookmarked yet.
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {activeTab === 'analysis'
              ? 'Click the star icon on any pipeline analysis to bookmark it.'
              : 'Click the star icon on any document to bookmark it.'}
          </p>
        </div>
      ) : activeTab === 'analysis' ? (
        // Card-based layout for analyses (more info to show)
        <div className="space-y-4">
          {filteredBookmarks.map((bookmark) => (
            <AnalysisBookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              jurisdiction={jurisdiction}
              onSaveNotes={(notes) => handleSaveNotes(bookmark.id, notes)}
              onRemove={() => handleRemove(bookmark.id)}
            />
          ))}
        </div>
      ) : (
        // Simple table for documents
        <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Document</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Notes</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Bookmarked</th>
                <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookmarks.map((bookmark) => (
                <DocumentBookmarkRow
                  key={bookmark.id}
                  bookmark={bookmark}
                  jurisdiction={jurisdiction}
                  onSaveNotes={(notes) => handleSaveNotes(bookmark.id, notes)}
                  onRemove={() => handleRemove(bookmark.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Analysis bookmark card - shows all the detailed info
interface AnalysisBookmarkCardProps {
  bookmark: BookmarkWithDetails;
  jurisdiction: JurisdictionCode;
  onSaveNotes: (notes: string) => Promise<void>;
  onRemove: () => void;
}

function AnalysisBookmarkCard({
  bookmark,
  jurisdiction,
  onSaveNotes,
  onRemove,
}: AnalysisBookmarkCardProps) {
  const issueTypeLabel = bookmark.issueType
    ? ISSUE_TYPE_LABELS[bookmark.issueType as keyof typeof ISSUE_TYPE_LABELS] || bookmark.issueType
    : null;

  const viewUrl = `/${jurisdiction.toLowerCase()}/pipeline/${bookmark.documentId}/${bookmark.issueType}`;

  // Use final severity if available, fallback to base severity
  const severity = bookmark.analysisFinalSeverity ?? bookmark.analysisSeverity;

  // Use tier3 classification if available, fallback to tier2
  const classification = bookmark.analysisTier3Classification || bookmark.analysisClassification;

  // Format cleanup effort
  const cleanupEffortLabel = bookmark.cleanupEffort === 'trivial' ? 'Trivial'
    : bookmark.cleanupEffort === 'easy' ? 'Easy'
    : bookmark.cleanupEffort === 'medium' ? 'Medium'
    : bookmark.cleanupEffort;

  // Format cleanup type
  const cleanupTypeLabel = bookmark.cleanupType === 'alternative_in_practice'
    ? 'Alternative in Practice'
    : bookmark.cleanupType === 'alternative_authorized'
    ? 'State Authorized Alternative'
    : bookmark.cleanupType === 'peer_state_solution'
    ? 'Peer State Has Solution'
    : bookmark.cleanupType;

  return (
    <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden">
      {/* Easy Fix Banner */}
      {bookmark.easyCleanupCandidate && (
        <div className="bg-[var(--color-success-bg)] px-4 py-2 flex items-center gap-3 border-b border-[var(--color-success)]">
          <Sparkles className="w-5 h-5 text-[var(--color-success)]" />
          <span className="text-sm font-medium text-[var(--color-success)]">
            Easy Cleanup Opportunity
          </span>
          {cleanupEffortLabel && (
            <Badge variant="success" className="text-xs">
              {cleanupEffortLabel} Fix
            </Badge>
          )}
          {cleanupTypeLabel && (
            <span className="text-xs text-[var(--color-success)]">
              {cleanupTypeLabel}
            </span>
          )}
        </div>
      )}

      {/* Federal Mandate Banner */}
      {bookmark.federalMandateFound && !bookmark.easyCleanupCandidate && (
        <div className="bg-[var(--color-danger-bg)] px-4 py-2 flex items-center gap-3 border-b border-[var(--color-danger)]">
          <AlertTriangle className="w-5 h-5 text-[var(--color-danger)]" />
          <span className="text-sm font-medium text-[var(--color-danger)]">
            Federal Mandate Found
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Top row: Badges and Actions */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Issue Type */}
            {issueTypeLabel && (
              <Badge variant="warning" className="text-xs">
                {issueTypeLabel}
              </Badge>
            )}

            {/* Tier Progress */}
            {bookmark.highestTierCompleted !== null && (
              <Badge variant="default" className="text-xs">
                Tier {bookmark.highestTierCompleted}
              </Badge>
            )}

            {/* Classification */}
            {classification && (
              <Badge
                variant={classification === 'burdensome' ? 'danger' : classification === 'justified' ? 'success' : 'default'}
                className="text-xs capitalize"
              >
                {classification}
              </Badge>
            )}

            {/* Federal Mandate (small badge if easy fix banner is showing) */}
            {bookmark.federalMandateFound && bookmark.easyCleanupCandidate && (
              <Badge variant="danger" className="text-xs">
                Federal
              </Badge>
            )}

            {/* Severity */}
            {severity !== null && (
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  severity >= 7
                    ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                    : severity >= 4
                      ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                      : 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                }`}
                title={`Severity: ${severity}/10`}
              >
                {severity}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-weaker)] hover:bg-[var(--color-primary-weak)] rounded transition-colors"
            >
              View Analysis
              <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              onClick={onRemove}
              className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded"
              aria-label="Remove bookmark"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Title and Citation */}
        <div className="mb-3">
          <h3 className="font-medium text-[var(--color-text)]" title={bookmark.documentTitle || ''}>
            {bookmark.documentTitle || 'Untitled Document'}
          </h3>
          {bookmark.documentCitation && (
            <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
              {bookmark.documentCitation}
            </p>
          )}
        </div>

        {/* Tier 3 Trigger Reason (if available) */}
        {bookmark.tier3TriggerReason && (
          <div className="mb-3 text-xs text-[var(--color-text-muted)] flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              <span className="font-medium">Escalated to Tier 3:</span> {bookmark.tier3TriggerReason}
            </span>
          </div>
        )}

        {/* Notes */}
        <div className="pt-3 border-t border-[var(--color-neutral-100)]">
          <div className="flex items-center justify-between gap-2">
            <BookmarkNotesEditor notes={bookmark.notes} onSave={onSaveNotes} />
            <span className="text-xs text-[var(--color-text-muted)] shrink-0">
              {bookmark.createdAt
                ? new Date(bookmark.createdAt).toLocaleDateString()
                : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple document bookmark row
interface DocumentBookmarkRowProps {
  bookmark: BookmarkWithDetails;
  jurisdiction: JurisdictionCode;
  onSaveNotes: (notes: string) => Promise<void>;
  onRemove: () => void;
}

function DocumentBookmarkRow({
  bookmark,
  jurisdiction,
  onSaveNotes,
  onRemove,
}: DocumentBookmarkRowProps) {
  const viewUrl = `/${jurisdiction.toLowerCase()}/regulations/${bookmark.documentId}`;

  return (
    <tr className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
      {/* Document */}
      <td className="px-4 py-3 max-w-xs">
        <div className="truncate text-[var(--color-text)]" title={bookmark.documentTitle || ''}>
          {bookmark.documentTitle || 'Untitled'}
        </div>
        {bookmark.documentCitation && (
          <div className="truncate text-xs text-[var(--color-text-muted)] font-mono" title={bookmark.documentCitation}>
            {bookmark.documentCitation}
          </div>
        )}
      </td>

      {/* Notes */}
      <td className="px-4 py-3">
        <BookmarkNotesEditor notes={bookmark.notes} onSave={onSaveNotes} compact />
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        {bookmark.createdAt
          ? new Date(bookmark.createdAt).toLocaleDateString()
          : '-'}
      </td>

      {/* Actions */}
      <td className="px-3 py-3">
        <div className="flex items-center justify-center gap-2">
          <Link
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
          >
            View
            <ExternalLink className="w-3 h-3" />
          </Link>
          <button
            onClick={onRemove}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded"
            aria-label="Remove bookmark"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default BookmarksContent;
