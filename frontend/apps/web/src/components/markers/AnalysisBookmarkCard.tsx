'use client';

import Link from 'next/link';
import { Trash2, ExternalLink, Sparkles, AlertTriangle, Zap } from 'lucide-react';
import type { BookmarkWithDetails, MarkerGroup, JurisdictionCode } from '@deproceduralizer/database';
import { Badge } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { MarkerBadge } from './MarkerBadge';
import { MarkerPicker } from './MarkerPicker';
import { MarkerNotesEditor } from './MarkerNotesEditor';

// Analysis bookmark card - shows all the detailed info
interface AnalysisBookmarkCardProps {
  bookmark: BookmarkWithDetails;
  jurisdiction: JurisdictionCode;
  onSaveNotes: (notes: string) => Promise<void>;
  onRemove: () => void;
  availableGroups: MarkerGroup[];
  onMarkerToggle: (bookmarkId: number, markerGroupId: number, assign: boolean) => void;
  onCreateCustomMarker?: (name: string) => Promise<MarkerGroup | null> | void;
}

export function AnalysisBookmarkCard({
  bookmark,
  jurisdiction,
  onSaveNotes,
  onRemove,
  availableGroups,
  onMarkerToggle,
  onCreateCustomMarker,
}: AnalysisBookmarkCardProps) {
  const issueTypeLabel = bookmark.issueType
    ? ISSUE_TYPE_LABELS[bookmark.issueType as keyof typeof ISSUE_TYPE_LABELS] || bookmark.issueType
    : null;

  const isGuidanceAnalysis = bookmark.guidanceDocumentId !== null && bookmark.documentId === null;
  const viewUrl = isGuidanceAnalysis
    ? `/${jurisdiction.toLowerCase()}/pipeline/guidance/${bookmark.guidanceDocumentId}/${bookmark.issueType}`
    : `/${jurisdiction.toLowerCase()}/pipeline/${bookmark.documentId}/${bookmark.issueType}`;

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

          {/* Labels + Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {bookmark.markers.length > 0 ? (
                bookmark.markers.map(m => (
                  <MarkerBadge key={m.id} name={m.name} color={m.color} size="sm"
                    onRemove={() => onMarkerToggle(bookmark.id, m.id, false)} />
                ))
              ) : (
                <span className="text-xs text-[var(--color-text-muted)] italic">No label</span>
              )}
              <MarkerPicker
                bookmarkId={bookmark.id}
                assignedMarkerIds={bookmark.markers.map(m => m.id)}
                availableGroups={availableGroups}
                onToggle={onMarkerToggle}
                onCreateCustom={onCreateCustomMarker}
              />
            </div>
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
              aria-label="Unsave"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Title and Citation */}
        <div className="mb-3">
          {isGuidanceAnalysis ? (
            <>
              {bookmark.guidanceAgency && (
                <p className="text-xs text-[var(--color-text-muted)] font-medium">{bookmark.guidanceAgency}</p>
              )}
              <h3 className="font-medium text-[var(--color-text)]" title={bookmark.guidanceTitle || ''}>
                {bookmark.guidanceTitle || 'Untitled Document'}
              </h3>
              {bookmark.guidanceCanonicalRef && (
                <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
                  {bookmark.guidanceCanonicalRef}
                </p>
              )}
            </>
          ) : (
            <>
              <h3 className="font-medium text-[var(--color-text)]" title={bookmark.documentTitle || ''}>
                {bookmark.documentTitle || 'Untitled Document'}
              </h3>
              {bookmark.documentCitation && (
                <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
                  {bookmark.documentCitation}
                </p>
              )}
            </>
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
            <MarkerNotesEditor notes={bookmark.notes} onSave={onSaveNotes} />
            <div className="flex items-center gap-2 shrink-0">
              {bookmark.createdBy && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {bookmark.createdBy}
                </span>
              )}
              <span className="text-xs text-[var(--color-text-muted)]">
                {bookmark.createdAt
                  ? new Date(bookmark.createdAt).toLocaleDateString()
                  : ''}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
