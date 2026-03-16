'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DollarSign } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookmarkButton } from '@/components/ui';
import { BookmarkNotesEditor } from '@/components/bookmarks/BookmarkNotesEditor';
import { ClickableTag } from '@/components/tags/ClickableTag';
import { tableRowClass, tableHeaderClass } from '@/components/ui/table-styles';
import type { FineBookmarkInfo } from '@/lib/actions/bookmarks';
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
}

export function FinesTable({ data, state, onRowClick, bookmarkedFineIds, onToggleBookmark, fineBookmarks, onSaveBookmarkNotes, bookmarkName }: FinesTableProps) {
  const handleToggleBookmark = (fineId: number) => {
    onToggleBookmark?.(fineId);
  };

  if (data.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="No fines or fees found"
        description="Try adjusting your filters"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-neutral-200)]">
            {bookmarkedFineIds && <th className="w-8 py-3 pr-1" />}
            <th className={tableHeaderClass}>Type</th>
            <th className={tableHeaderClass}>Amount</th>
            <th className={tableHeaderClass}>Agency</th>
            <th className={tableHeaderClass}>Level</th>
            <th className={tableHeaderClass}>Who Pays</th>
            <th className={tableHeaderClass}>Est. Impact</th>
            <th className={tableHeaderClass}>Analysis</th>
            <th className={tableHeaderClass}>Description</th>
            <th className={tableHeaderClass}>Source</th>
          </tr>
        </thead>
        <tbody>
          {data.map((fine) => {
            const sourceLink = fine.sourceDocument.type === 'regulation'
              ? `/${state}/regulations/${fine.documentId}`
              : `/${state}/guidance/${fine.guidanceDocumentId}`;

            const displayAgency = fine.agencyCanonicalName ?? fine.responsibleAgency ?? '—';
            const rawAgency = fine.responsibleAgency;
            const isNormalized = fine.agencyCanonicalName && rawAgency && fine.agencyCanonicalName !== rawAgency;
            const sourceType = fine.sourceDocument.type;
            const bookmark = fineBookmarks?.get(fine.id);
            const isBookmarked = bookmarkedFineIds?.has(fine.id);
            const colCount = bookmarkedFineIds ? 11 : 10;

            return (
              <FineRow key={fine.id}>
              <tr
                onClick={() => onRowClick(fine)}
                className={`${tableRowClass} cursor-pointer${isBookmarked && bookmark ? ' !border-b-0' : ''}`}
              >
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
                <td className="py-3 pr-3">
                  <ClickableTag field="penalty_type" value={fine.penaltyType}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PENALTY_TYPE_COLORS[fine.penaltyType] || PENALTY_TYPE_COLORS.other}`}>
                      {PENALTY_TYPE_LABELS[fine.penaltyType] || fine.penaltyType}
                    </span>
                  </ClickableTag>
                </td>
                <td className="py-3 pr-3 text-[var(--color-text)] font-medium">
                  {fine.amount ?? '—'}
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
                      <span>{fine.whoPays ?? '—'}</span>
                    </ClickableTag>
                  ) : (
                    fine.whoPays ?? '—'
                  )}
                </td>
                <td className="py-3 pr-3 text-xs text-[var(--color-text-muted)]">
                  {fine.estimatedAnnualPayers
                    ? (ESTIMATED_PAYERS_LABELS[fine.estimatedAnnualPayers] || fine.estimatedAnnualPayers)
                    : '—'}
                </td>
                <td className="py-3 pr-3">
                  {fine.analysis ? (
                    <ClassificationBadge
                      classification={fine.analysis.tier3Classification ?? fine.analysis.tier2Classification ?? fine.analysis.tier1Classification}
                    />
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">—</span>
                  )}
                </td>
                <td className="py-3 pr-3 text-[var(--color-text-secondary)] max-w-[250px] truncate" title={fine.violationDescription ?? ''}>
                  {fine.violationDescription ?? '—'}
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
                      {fine.sourceDocument.title ?? '—'}
                    </Link>
                  </div>
                </td>
              </tr>
              {isBookmarked && bookmark && onSaveBookmarkNotes && (
                <tr className="border-b border-[var(--color-neutral-100)]">
                  <td colSpan={colCount} className="px-4 pb-3 pt-0" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}

function FineRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
