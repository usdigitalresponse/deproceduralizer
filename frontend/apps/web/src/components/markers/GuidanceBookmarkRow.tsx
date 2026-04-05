'use client';

import Link from 'next/link';
import { Trash2, ExternalLink } from 'lucide-react';
import type { BookmarkWithDetails, MarkerGroup, JurisdictionCode } from '@deproceduralizer/database';
import { tableRowClass } from '@/components/ui/table-styles';
import { MarkerBadge } from './MarkerBadge';
import { MarkerPicker } from './MarkerPicker';
import { MarkerNotesEditor } from './MarkerNotesEditor';

// Guidance document bookmark row
interface GuidanceBookmarkRowProps {
  bookmark: BookmarkWithDetails;
  jurisdiction: JurisdictionCode;
  onSaveNotes: (notes: string) => Promise<void>;
  onRemove: () => void;
  availableGroups: MarkerGroup[];
  onMarkerToggle: (bookmarkId: number, markerGroupId: number, assign: boolean) => void;
  onCreateCustomMarker?: (name: string) => Promise<MarkerGroup | null> | void;
}

export function GuidanceBookmarkRow({
  bookmark,
  jurisdiction,
  onSaveNotes,
  onRemove,
  availableGroups,
  onMarkerToggle,
  onCreateCustomMarker,
}: GuidanceBookmarkRowProps) {
  const viewUrl = `/${jurisdiction.toLowerCase()}/guidance/${bookmark.guidanceDocumentId}`;

  return (
    <tr className={tableRowClass}>
      {/* Title & Ref */}
      <td className="px-4 py-3 max-w-xs">
        <div className="truncate text-[var(--color-text)]" title={bookmark.guidanceTitle || ''}>
          {bookmark.guidanceTitle || 'Untitled'}
        </div>
        {bookmark.guidanceCanonicalRef && (
          <div className="truncate text-xs text-[var(--color-text-muted)] font-mono" title={bookmark.guidanceCanonicalRef}>
            {bookmark.guidanceCanonicalRef}
          </div>
        )}
      </td>

      {/* Agency */}
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        {bookmark.guidanceAgency || '-'}
      </td>

      {/* Labels */}
      <td className="px-4 py-3">
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

      {/* Notes */}
      <td className="px-4 py-3">
        <MarkerNotesEditor notes={bookmark.notes} onSave={onSaveNotes} compact />
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
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-2">
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
            aria-label="Unsave"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
