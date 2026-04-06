'use client';

import { Trash2 } from 'lucide-react';
import type { BookmarkWithDetails, MarkerGroup } from '@deproceduralizer/database';
import { PENALTY_TYPE_LABELS } from '@/lib/constants/fines';
import { MarkerBadge } from './MarkerBadge';
import { MarkerPicker } from './MarkerPicker';
import { MarkerNotesEditor } from './MarkerNotesEditor';

// Fine bookmark row
interface FineBookmarkRowProps {
  bookmark: BookmarkWithDetails;
  onRowClick: () => void;
  onSaveNotes: (notes: string, createdBy?: string) => Promise<void>;
  onRemove: () => void;
  bookmarkName: string;
  availableGroups: MarkerGroup[];
  onMarkerToggle: (bookmarkId: number, markerGroupId: number, assign: boolean) => void;
  onCreateCustomMarker?: (name: string) => Promise<MarkerGroup | null> | void;
}

export function FineBookmarkRow({
  bookmark,
  onRowClick,
  onSaveNotes,
  onRemove,
  bookmarkName,
  availableGroups,
  onMarkerToggle,
  onCreateCustomMarker,
}: FineBookmarkRowProps) {
  if (!bookmark.fineId) return null;

  return (
    <>
      <tr
        onClick={onRowClick}
        className="cursor-pointer hover:bg-[var(--color-neutral-50)] transition-colors"
      >
        {/* Type */}
        <td className="px-4 py-3">
          <span className="text-xs font-medium">
            {bookmark.finePenaltyType
              ? (PENALTY_TYPE_LABELS[bookmark.finePenaltyType] || bookmark.finePenaltyType)
              : '-'}
          </span>
        </td>

        {/* Amount */}
        <td className="px-4 py-3 text-sm font-medium text-[var(--color-text)]">
          {bookmark.fineAmount || '-'}
        </td>

        {/* Agency */}
        <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] max-w-[150px] truncate">
          {bookmark.fineAgencyCanonicalName || '-'}
        </td>

        {/* Description */}
        <td className="px-4 py-3 max-w-[200px]">
          <div className="truncate text-xs text-[var(--color-text-secondary)]" title={bookmark.fineViolationDescription || ''}>
            {bookmark.fineViolationDescription || '-'}
          </div>
        </td>

        {/* Labels */}
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
        </td>

        {/* By */}
        <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
          {bookmark.createdBy || '-'}
        </td>

        {/* Date */}
        <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
          {bookmark.createdAt
            ? new Date(bookmark.createdAt).toLocaleDateString()
            : '-'}
        </td>

        {/* Actions */}
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onRemove}
              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded"
              aria-label="Unsave"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
      <tr className="border-b border-[var(--color-neutral-100)]">
        <td colSpan={8} className="px-4 pb-3 pt-0" onClick={(e) => e.stopPropagation()}>
          <MarkerNotesEditor
            notes={bookmark.notes}
            onSave={onSaveNotes}
            createdBy={bookmark.createdBy}
            showName
            defaultName={bookmarkName}
          />
        </td>
      </tr>
    </>
  );
}
