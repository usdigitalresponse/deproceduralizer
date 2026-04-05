'use client';

import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react';
import { Tag as TagIcon, Pencil, X, Check } from 'lucide-react';
import { BookmarkButton } from '@/components/ui';
import { MarkerBadge, MarkerPicker } from '@/components/markers';
import {
  toggleGuidanceBookmark,
  getGuidanceBookmark,
  updateBookmarkNotes,
} from '@/lib/actions/bookmarks';
import type { Bookmark } from '@deproceduralizer/database';
import { useBookmarkState, type BookmarkState } from '@/hooks/useBookmarkState';

const GuidanceBookmarkContext = createContext<BookmarkState | null>(null);

interface GuidanceBookmarkProviderProps {
  guidanceDocumentId: number;
  jurisdiction: string;
  children: ReactNode;
}

export function GuidanceBookmarkProvider({
  guidanceDocumentId,
  jurisdiction,
  children,
}: GuidanceBookmarkProviderProps) {
  const fetchBookmark = useCallback(async () => {
    const result = await getGuidanceBookmark(guidanceDocumentId);
    return result.success ? result.data : null;
  }, [guidanceDocumentId]);

  const toggleBookmarkFn = useCallback(async () => {
    const result = await toggleGuidanceBookmark(guidanceDocumentId, jurisdiction);
    if (!result.success) return undefined as unknown as Bookmark | null;
    return result.data;
  }, [guidanceDocumentId, jurisdiction]);

  const state = useBookmarkState({ fetchBookmark, toggleBookmark: toggleBookmarkFn, jurisdiction });

  return (
    <GuidanceBookmarkContext.Provider value={state}>
      <GuidanceBookmarkUpdateContext.Provider value={state.setBookmark}>
        {children}
      </GuidanceBookmarkUpdateContext.Provider>
    </GuidanceBookmarkContext.Provider>
  );
}

// Separate context for updates to avoid re-renders
const GuidanceBookmarkUpdateContext = createContext<((b: Bookmark) => void) | null>(null);

/** Bookmark toggle button -- place in header actions */
export function GuidanceDetailBookmark() {
  const ctx = useContext(GuidanceBookmarkContext);
  if (!ctx) return null;

  return (
    <BookmarkButton
      isBookmarked={ctx.bookmark !== null}
      onToggle={ctx.handleToggle}
      isLoading={ctx.isLoading}
      size="md"
      showLabel
    />
  );
}

/**
 * Amber "Marked" card with markers + notes -- place below header when bookmarked.
 * Exported as both GuidanceDetailNotesCard (preferred) and GuidanceDetailMarkers (legacy alias).
 */
export function GuidanceDetailNotesCard() {
  const ctx = useContext(GuidanceBookmarkContext);
  const updateBookmarkState = useContext(GuidanceBookmarkUpdateContext);
  if (!ctx || !ctx.bookmark) return null;

  const { bookmark } = ctx;
  const isBookmarked = bookmark !== null;

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Reset edit state when bookmark changes
  useEffect(() => {
    setEditedNotes(bookmark?.notes || '');
    setIsEditingNotes(false);
  }, [bookmark?.id, bookmark?.notes]);

  const handleStartEditNotes = useCallback(() => {
    setEditedNotes(bookmark?.notes || '');
    setIsEditingNotes(true);
  }, [bookmark?.notes]);

  const handleCancelEditNotes = useCallback(() => {
    setEditedNotes(bookmark?.notes || '');
    setIsEditingNotes(false);
  }, [bookmark?.notes]);

  const handleSaveNotes = useCallback(async () => {
    if (!bookmark) return;

    setIsSavingNotes(true);
    const result = await updateBookmarkNotes(bookmark.id, editedNotes);

    if (result.success) {
      updateBookmarkState?.(result.data);
      setIsEditingNotes(false);
    } else {
      console.error('Failed to save notes:', result.error);
    }
    setIsSavingNotes(false);
  }, [bookmark, editedNotes, updateBookmarkState]);

  if (!isBookmarked) return null;

  return (
    <div className="mb-4">
    <div className="bg-amber-50 border border-amber-200 rounded-[var(--radius-md)] p-4">
      <div className="flex items-start gap-3">
        <TagIcon className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-amber-800">
              Marked
            </h3>
            {!isEditingNotes && (
              <button
                onClick={handleStartEditNotes}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {bookmark?.notes ? 'Edit notes' : 'Add notes'}
              </button>
            )}
          </div>

          {/* Marker badges + picker */}
          {bookmark && bookmark.id > 0 && ctx.availableGroups.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {ctx.markers.length > 0 ? (
                ctx.markers.map(m => (
                  <MarkerBadge
                    key={m.id}
                    name={m.name}
                    color={m.color}
                    size="sm"
                    onRemove={() => ctx.handleMarkerToggle(bookmark.id, m.id, false)}
                  />
                ))
              ) : (
                <span className="text-xs text-amber-500 italic">No label chosen</span>
              )}
              <MarkerPicker
                bookmarkId={bookmark.id}
                assignedMarkerIds={ctx.markers.map(m => m.id)}
                availableGroups={ctx.availableGroups}
                onToggle={ctx.handleMarkerToggle}
                onCreateCustom={ctx.handleCreateCustomMarker}
              />
            </div>
          )}

          {isEditingNotes ? (
            <div className="space-y-2">
              <textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Add notes..."
                className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-[var(--radius-sm)] resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-amber-400"
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelEditNotes}
                  disabled={isSavingNotes}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 rounded transition-colors disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors disabled:opacity-50"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>
          ) : bookmark?.notes ? (
            <p className="text-sm text-amber-900">{bookmark.notes}</p>
          ) : (
            <p className="text-sm text-amber-600 italic">
              No notes added yet.
            </p>
          )}

          {bookmark?.createdAt && (
            <p className="mt-2 text-xs text-amber-500">
              Marked {new Date(bookmark.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

/** @deprecated Use GuidanceDetailNotesCard instead */
export const GuidanceDetailMarkers = GuidanceDetailNotesCard;
