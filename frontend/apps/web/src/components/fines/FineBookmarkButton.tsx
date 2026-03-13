'use client';

import { useState, useCallback, useEffect } from 'react';
import { Bookmark as BookmarkIcon, Pencil, X, Check } from 'lucide-react';
import { BookmarkButton } from '@/components/ui';
import { useBookmarkName } from '@/hooks/useBookmarkName';
import {
  getFineBookmark,
  toggleFineBookmark,
  updateBookmarkNotes,
} from '@/lib/actions/bookmarks';
import type { Bookmark } from '@deproceduralizer/database';

interface FineBookmarkButtonProps {
  fineId: number;
  jurisdiction: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  showNotes?: boolean;
  onBookmarkChange?: (fineId: number, bookmarked: boolean) => void;
}

/**
 * Bookmark toggle button for individual fines/fees/penalties.
 * When showNotes is true, renders an amber notes card below the button when bookmarked.
 */
export function FineBookmarkButton({
  fineId,
  jurisdiction,
  size = 'md',
  showLabel = true,
  showNotes = false,
  onBookmarkChange,
}: FineBookmarkButtonProps) {
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { bookmarkName, saveBookmarkName } = useBookmarkName();

  const isBookmarked = bookmark !== null;

  useEffect(() => {
    async function fetchBookmark() {
      const result = await getFineBookmark(fineId);
      if (result.success && result.data) {
        setBookmark(result.data);
      }
      setIsLoading(false);
    }
    fetchBookmark();
  }, [fineId]);

  const handleToggle = useCallback(async () => {
    const wasBookmarked = isBookmarked;

    // Optimistic update
    if (wasBookmarked) {
      setBookmark(null);
      onBookmarkChange?.(fineId, false);
    } else {
      setBookmark({
        id: -1,
        documentId: null,
        analysisId: null,
        guidanceDocumentId: null,
        fineId,
        issueType: null,
        jurisdiction,
        notes: null,
        createdBy: bookmarkName || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      onBookmarkChange?.(fineId, true);
    }

    const result = await toggleFineBookmark(
      fineId,
      jurisdiction,
      undefined,
      bookmarkName || undefined
    );

    if (!result.success) {
      // Revert — re-fetch actual state
      const refetch = await getFineBookmark(fineId);
      if (refetch.success && refetch.data) {
        setBookmark(refetch.data);
        onBookmarkChange?.(fineId, true);
      } else {
        setBookmark(null);
        onBookmarkChange?.(fineId, false);
      }
      console.error('Failed to toggle fine bookmark:', result.error);
    } else if (result.data) {
      setBookmark(result.data);
      onBookmarkChange?.(fineId, true);
    } else {
      setBookmark(null);
      onBookmarkChange?.(fineId, false);
    }
  }, [fineId, jurisdiction, isBookmarked, bookmarkName, onBookmarkChange]);

  const handleSaveNotes = useCallback(async (notes: string, createdBy?: string) => {
    if (!bookmark) return;
    if (createdBy) {
      saveBookmarkName(createdBy);
    }
    const result = await updateBookmarkNotes(bookmark.id, notes, createdBy);
    if (result.success) {
      setBookmark(prev => prev ? { ...prev, notes, createdBy: createdBy ?? prev.createdBy } : null);
    }
  }, [bookmark, saveBookmarkName]);

  return (
    <div>
      <BookmarkButton
        isBookmarked={isBookmarked}
        onToggle={handleToggle}
        isLoading={isLoading}
        size={size}
        showLabel={showLabel}
      />
      {showNotes && isBookmarked && (
        <div className="mt-3">
          <BookmarkNotesCard
            bookmark={bookmark}
            onSave={handleSaveNotes}
            defaultName={bookmarkName}
          />
        </div>
      )}
    </div>
  );
}

// ── Inline amber notes card (matches pipeline BookmarkNotesCard pattern) ──

interface BookmarkNotesCardProps {
  bookmark: Bookmark;
  onSave: (notes: string, createdBy?: string) => Promise<void>;
  defaultName?: string;
}

export function BookmarkNotesCard({ bookmark, onSave, defaultName }: BookmarkNotesCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditedNotes(bookmark.notes || '');
    setEditedName(bookmark.createdBy || defaultName || '');
    setIsEditing(false);
  }, [bookmark.id, bookmark.notes, bookmark.createdBy, defaultName]);

  const handleStartEdit = useCallback(() => {
    setEditedNotes(bookmark.notes || '');
    setEditedName(bookmark.createdBy || defaultName || '');
    setIsEditing(true);
  }, [bookmark.notes, bookmark.createdBy, defaultName]);

  const handleCancel = useCallback(() => {
    setEditedNotes(bookmark.notes || '');
    setEditedName(bookmark.createdBy || defaultName || '');
    setIsEditing(false);
  }, [bookmark.notes, bookmark.createdBy, defaultName]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    await onSave(editedNotes, editedName || undefined);
    setIsEditing(false);
    setIsSaving(false);
  }, [editedNotes, editedName, onSave]);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-[var(--radius-md)] p-4">
      <div className="flex items-start gap-3">
        <BookmarkIcon className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-amber-800">Bookmarked</h3>
            {!isEditing && (
              <button
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {bookmark.notes ? 'Edit notes' : 'Add notes'}
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Add notes about why this is bookmarked..."
                className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-[var(--radius-sm)] resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-amber-400"
                rows={2}
                autoFocus
              />
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-[var(--radius-sm)] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-amber-400"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 rounded transition-colors disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors disabled:opacity-50"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>
          ) : bookmark.notes ? (
            <p className="text-sm text-amber-900">{bookmark.notes}</p>
          ) : (
            <p className="text-sm text-amber-600 italic">No notes added yet.</p>
          )}

          <div className="mt-2 flex items-center gap-2 text-xs text-amber-500">
            {bookmark.createdBy && <span>— {bookmark.createdBy}</span>}
            {bookmark.createdAt && (
              <span>
                {bookmark.createdBy && '· '}
                {new Date(bookmark.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
