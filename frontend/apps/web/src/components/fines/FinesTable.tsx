'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { DollarSign } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookmarkButton } from '@/components/ui';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { BookmarkNotesEditor } from '@/components/bookmarks/BookmarkNotesEditor';
import { MarkerDots, MarkerPicker, MarkerBadge } from '@/components/markers';
import { ClickableTag } from '@/components/tags/ClickableTag';
import { tableRowClass, tableHeaderClass } from '@/components/ui/table-styles';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import type { FineBookmarkInfo } from '@/lib/actions/bookmarks';
import type { BookmarkMarkersMap } from '@/lib/actions/bookmarks';
import type { MarkerGroup } from '@deproceduralizer/database';
import {
  PENALTY_TYPE_LABELS,
  PENALTY_TYPE_COLORS,
  AGENCY_LEVEL_LABELS,
  AGENCY_LEVEL_COLORS,
  SOURCE_TYPE_COLORS,
  SOURCE_TYPE_BADGE_LABELS,
  ESTIMATED_PAYERS_LABELS,
} from '@/lib/constants/fines';
import { ClassificationBadge } from '@/components/issues';
import { SeverityBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import type { FineWithContext } from '@/lib/actions/fines';

interface FinesTableProps {
  data: FineWithContext[];
  state: string;
  onRowClick: (fine: FineWithContext) => void;
  bookmarkedFineIds?: Set<number>;
  onToggleBookmark?: (fineId: number) => void;
  fineBookmarks?: Map<number, FineBookmarkInfo>;
  onSaveBookmarkNotes?: (bookmarkId: number, fineId: number, notes: string, createdBy?: string) => Promise<void>;
  bookmarkName?: string;
  bookmarkMarkersMap?: BookmarkMarkersMap;
  availableGroups?: MarkerGroup[];
  onMarkerToggle?: (bookmarkId: number, markerGroupId: number, assign: boolean) => void;
  onCreateCustomMarker?: (bookmarkId: number, fineId: number, name: string) => void;
  /** Callback to bulk-assign a marker to a specific bookmark */
  onBulkAssignMarker?: (bookmarkId: number, markerGroupId: number) => void;
  /** Callback to create a new marker group and assign to all selected bookmarked items */
  onCreateAndAssignMarker?: (name: string, selectedFineIds: Set<number>) => void;
  isLoading?: boolean;
}

export function FinesTable({ data, state, onRowClick, bookmarkedFineIds, onToggleBookmark, fineBookmarks, onSaveBookmarkNotes, bookmarkName, bookmarkMarkersMap, availableGroups, onMarkerToggle, onCreateCustomMarker, onBulkAssignMarker, onCreateAndAssignMarker, isLoading }: FinesTableProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const visibleIds = useMemo(() => data.map(f => f.id), [data]);
  const {
    selectedKeys,
    toggle,
    toggleAll,
    clear,
    isAllSelected,
    isSomeSelected,
    count: selectedCount,
  } = useBulkSelection(visibleIds);

  const handleToggleBookmark = (fineId: number) => {
    onToggleBookmark?.(fineId);
  };

  // Bulk mark all: create bookmarks for unbookmarked selected items
  const handleBulkMarkAll = useCallback(async () => {
    if (!onToggleBookmark || !bookmarkedFineIds) return;
    setIsProcessing(true);
    try {
      const unbookmarked = Array.from(selectedKeys).filter(id => !bookmarkedFineIds.has(id));
      await Promise.allSettled(unbookmarked.map(id => onToggleBookmark(id)));
    } finally {
      setIsProcessing(false);
    }
  }, [selectedKeys, bookmarkedFineIds, onToggleBookmark]);

  // Bulk assign marker: assign to all selected items that already have bookmarks
  const handleBulkAssignMarker = useCallback(async (markerGroupId: number) => {
    if (!bookmarkMarkersMap || !onMarkerToggle) return;
    setIsProcessing(true);
    try {
      const assignments: Promise<void>[] = [];
      for (const fineId of selectedKeys) {
        const entry = bookmarkMarkersMap.get(String(fineId));
        if (entry) {
          const alreadyAssigned = entry.markers.some(m => m.id === markerGroupId);
          if (!alreadyAssigned) {
            if (onBulkAssignMarker) {
              assignments.push(Promise.resolve(onBulkAssignMarker(entry.bookmarkId, markerGroupId)));
            } else {
              assignments.push(Promise.resolve(onMarkerToggle(entry.bookmarkId, markerGroupId, true)));
            }
          }
        }
      }
      await Promise.allSettled(assignments);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedKeys, bookmarkMarkersMap, onMarkerToggle, onBulkAssignMarker]);

  // Bulk unmark all: remove bookmarks from all selected items that are bookmarked
  const handleBulkUnmarkAll = useCallback(async () => {
    if (!onToggleBookmark || !bookmarkedFineIds) return;
    setIsProcessing(true);
    try {
      const bookmarked = Array.from(selectedKeys).filter(id => bookmarkedFineIds.has(id));
      await Promise.allSettled(bookmarked.map(id => onToggleBookmark(id)));
    } finally {
      setIsProcessing(false);
    }
  }, [selectedKeys, bookmarkedFineIds, onToggleBookmark]);

  // Bulk create new category and assign to all selected bookmarked items
  const handleBulkCreateAndAssign = useCallback((name: string) => {
    onCreateAndAssignMarker?.(name, selectedKeys);
  }, [selectedKeys, onCreateAndAssignMarker]);

  if (isLoading && data.length === 0) {
    return <FinesTableSkeleton hasBookmarks={!!onToggleBookmark} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="No fines or fees found"
        description="Try adjusting your filters"
      />
    );
  }

  const showCheckboxes = Boolean(bookmarkedFineIds);

  return (
    <div className="overflow-x-auto relative">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-neutral-200)]">
            {showCheckboxes && (
              <th className="w-8 py-3 pl-2 pr-1">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isSomeSelected && !isAllSelected;
                  }}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] cursor-pointer"
                  aria-label="Select all visible rows"
                />
              </th>
            )}
            {bookmarkedFineIds && <th className="w-8 py-3 pr-1" />}
            {bookmarkMarkersMap && <th className="w-16 py-3 px-1" />}
            <th className={tableHeaderClass}>Type</th>
            <th className={tableHeaderClass}>Amount</th>
            <th className={tableHeaderClass}>Agency</th>
            <th className={tableHeaderClass}>Level</th>
            <th className={tableHeaderClass}>Who Pays</th>
            <th className={tableHeaderClass} title="Intended to show order of magnitude. May contain significant discrepancies — use for broad filtering only, not as authoritative fact.">Est. Impact</th>
            <th className={tableHeaderClass}>Analysis</th>
            <th className={tableHeaderClass}>Sev.</th>
            <th className={tableHeaderClass}>Description</th>
            <th className={tableHeaderClass}>Source</th>
          </tr>
        </thead>
        <tbody>
          {data.map((fine) => {
            const sourceLink = fine.sourceDocument.type === 'regulation'
              ? `/${state}/regulations/${fine.documentId}`
              : `/${state}/guidance/${fine.guidanceDocumentId}`;

            const displayAgency = fine.agencyCanonicalName ?? fine.responsibleAgency ?? '\u2014';
            const rawAgency = fine.responsibleAgency;
            const isNormalized = fine.agencyCanonicalName && rawAgency && fine.agencyCanonicalName !== rawAgency;
            const sourceType = fine.sourceDocument.type;
            const bookmark = fineBookmarks?.get(fine.id);
            const isBookmarked = bookmarkedFineIds?.has(fine.id);
            const markerEntry = bookmarkMarkersMap?.get(String(fine.id));
            const colCount = 11
              + (showCheckboxes ? 1 : 0)
              + (bookmarkedFineIds ? 1 : 0)
              + (bookmarkMarkersMap ? 1 : 0);
            const isSelected = selectedKeys.has(fine.id);

            return (
              <FineRow key={fine.id}>
              <tr
                onClick={() => onRowClick(fine)}
                className={`${tableRowClass} cursor-pointer${isBookmarked && bookmark ? ' !border-b-0' : ''}${isSelected ? ' bg-[var(--color-primary-weaker)]' : ''}`}
              >
                {showCheckboxes && (
                  <td className="py-3 pl-2 pr-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(fine.id)}
                      className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] cursor-pointer"
                      aria-label={`Select fine ${fine.id}`}
                    />
                  </td>
                )}
                {bookmarkedFineIds && (
                  <td className="py-3 pr-1" onClick={(e) => e.stopPropagation()}>
                    <BookmarkButton
                      isBookmarked={bookmarkedFineIds.has(fine.id)}
                      onToggle={() => handleToggleBookmark(fine.id)}
                      size="sm"
                      className=""
                    />
                  </td>
                )}
                {bookmarkMarkersMap && (
                  <td className="py-3 px-1" onClick={(e) => e.stopPropagation()}>
                    {markerEntry && (
                      <div className="flex items-center gap-0.5">
                        <MarkerDots markers={markerEntry.markers} />
                        {availableGroups && onMarkerToggle && (
                          <MarkerPicker
                            bookmarkId={markerEntry.bookmarkId}
                            assignedMarkerIds={markerEntry.markers.map(m => m.id)}
                            availableGroups={availableGroups}
                            onToggle={onMarkerToggle}
                            onCreateCustom={onCreateCustomMarker ? (name) => onCreateCustomMarker(markerEntry.bookmarkId, fine.id, name) : undefined}
                          />
                        )}
                      </div>
                    )}
                  </td>
                )}
                <td className="py-3 pr-3">
                  <ClickableTag field="penalty_type" value={fine.penaltyType}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PENALTY_TYPE_COLORS[fine.penaltyType] || PENALTY_TYPE_COLORS.other}`}>
                      {PENALTY_TYPE_LABELS[fine.penaltyType] || fine.penaltyType}
                    </span>
                  </ClickableTag>
                </td>
                <td className="py-3 pr-3 text-[var(--color-text)] font-medium">
                  {fine.amount ?? '\u2014'}
                  {fine.perUnit && (
                    <span className="text-xs text-[var(--color-text-muted)] ml-1">
                      {fine.perUnit}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-3 max-w-[200px] truncate text-[var(--color-text-secondary)]" title={displayAgency}>
                  {displayAgency}
                </td>
                <td className="py-3 pr-3">
                  {fine.agencyLevel && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${AGENCY_LEVEL_COLORS[fine.agencyLevel] || AGENCY_LEVEL_COLORS.generic}`}>
                      {AGENCY_LEVEL_LABELS[fine.agencyLevel] || fine.agencyLevel}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-3 max-w-[150px] truncate text-[var(--color-text-secondary)]" title={fine.whoPays ?? ''}>
                  {fine.whoPaysNormalized ? (
                    <ClickableTag field="who_pays_normalized" value={fine.whoPaysNormalized}>
                      <span>{fine.whoPays ?? '\u2014'}</span>
                    </ClickableTag>
                  ) : (
                    fine.whoPays ?? '\u2014'
                  )}
                </td>
                <td className="py-3 pr-3 text-xs text-[var(--color-text-muted)]">
                  {fine.estimatedAnnualPayers
                    ? (ESTIMATED_PAYERS_LABELS[fine.estimatedAnnualPayers] || fine.estimatedAnnualPayers)
                    : '\u2014'}
                </td>
                <td className="py-3 pr-3">
                  {fine.analysis ? (
                    <ClassificationBadge
                      classification={fine.analysis.tier3Classification ?? fine.analysis.tier2Classification ?? fine.analysis.tier1Classification}
                    />
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">{'\u2014'}</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  {fine.analysis?.finalSeverity != null ? (
                    <SeverityBadge severity={fine.analysis.finalSeverity} />
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">—</span>
                  )}
                </td>
                <td className="py-3 pr-3 text-[var(--color-text-secondary)] max-w-[250px] truncate" title={fine.violationDescription ?? ''}>
                  {fine.violationDescription ?? '\u2014'}
                </td>
                <td className="py-3 max-w-[200px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${SOURCE_TYPE_COLORS[sourceType]}`}>
                      {SOURCE_TYPE_BADGE_LABELS[sourceType]}
                    </span>
                    <Link
                      href={sourceLink}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[var(--color-primary)] hover:underline truncate"
                      title={fine.sourceDocument.title ?? ''}
                    >
                      {fine.sourceDocument.title ?? '\u2014'}
                    </Link>
                  </div>
                </td>
              </tr>
              {isBookmarked && bookmark && onSaveBookmarkNotes && (
                <tr className="border-b border-[var(--color-neutral-100)]">
                  <td colSpan={colCount} className="px-4 pb-3 pt-0" onClick={(e) => e.stopPropagation()}>
                    {/* Inline marker assignment */}
                    {markerEntry && availableGroups && availableGroups.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {markerEntry.markers.length > 0 ? (
                          markerEntry.markers.map(m => (
                            <MarkerBadge
                              key={m.id}
                              name={m.name}
                              color={m.color}
                              size="sm"
                              onRemove={onMarkerToggle ? () => onMarkerToggle(markerEntry.bookmarkId, m.id, false) : undefined}
                            />
                          ))
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)] italic">No label chosen</span>
                        )}
                        {onMarkerToggle && (
                          <MarkerPicker
                            bookmarkId={markerEntry.bookmarkId}
                            assignedMarkerIds={markerEntry.markers.map(m => m.id)}
                            availableGroups={availableGroups}
                            onToggle={onMarkerToggle}
                            onCreateCustom={onCreateCustomMarker ? (name) => onCreateCustomMarker(markerEntry.bookmarkId, fine.id, name) : undefined}
                          />
                        )}
                      </div>
                    )}
                    <BookmarkNotesEditor
                      notes={bookmark.notes}
                      onSave={(notes, createdBy) => onSaveBookmarkNotes(bookmark.id, fine.id, notes, createdBy)}
                      createdBy={bookmark.createdBy}
                      showName
                      defaultName={bookmarkName}
                    />
                  </td>
                </tr>
              )}
              </FineRow>
            );
          })}
        </tbody>
      </table>

      {/* Bulk action bar */}
      {showCheckboxes && selectedCount > 0 && availableGroups && (
        <BulkActionBar
          selectedCount={selectedCount}
          onMarkAll={handleBulkMarkAll}
          onAssignMarker={handleBulkAssignMarker}
          onCreateAndAssign={onCreateAndAssignMarker ? handleBulkCreateAndAssign : undefined}
          onUnmarkAll={onToggleBookmark ? handleBulkUnmarkAll : undefined}
          onClear={clear}
          availableGroups={availableGroups}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}

function FineRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function FinesTableSkeleton({ hasBookmarks }: { hasBookmarks: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-neutral-200)]">
            {hasBookmarks && <th className="py-2 pl-4 pr-1 w-8" />}
            {['Type', 'Amount', 'Agency', 'Level', 'Who Pays', 'Est. Impact', 'Analysis', 'Sev.', 'Description', 'Source'].map(h => (
              <th key={h} className={`py-2 ${h === 'Type' && !hasBookmarks ? 'pl-4' : ''} pr-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }, (_, i) => (
            <tr key={i} className="border-b border-[var(--color-neutral-100)]">
              {hasBookmarks && <td className="py-3 pl-4 pr-1"><Skeleton className="h-5 w-5 rounded" /></td>}
              <td className="py-3 pr-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
              <td className="py-3 pr-3"><Skeleton className="h-4 w-24" /></td>
              <td className="py-3 pr-3"><Skeleton className="h-4 w-32" /></td>
              <td className="py-3 pr-3"><Skeleton className="h-5 w-14 rounded" /></td>
              <td className="py-3 pr-3"><Skeleton className="h-4 w-20" /></td>
              <td className="py-3 pr-3"><Skeleton className="h-4 w-16" /></td>
              <td className="py-3 pr-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
              <td className="py-3 pr-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
              <td className="py-3 pr-3"><Skeleton className="h-4 w-40" /></td>
              <td className="py-3 pr-3"><Skeleton className="h-4 w-28" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
