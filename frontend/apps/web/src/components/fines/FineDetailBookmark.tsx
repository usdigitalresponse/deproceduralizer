'use client';

import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react';
import { BookmarkButton } from '@/components/ui';
import { useBookmarkName } from '@/hooks/useBookmarkName';
import { BookmarkNotesCard } from './FineBookmarkButton';
import {
  getFineBookmark,
  toggleFineBookmark,
  updateBookmarkNotes,
} from '@/lib/actions/bookmarks';
import type { Bookmark } from '@deproceduralizer/database';
import { useBookmarkState, type BookmarkState } from '@/hooks/useBookmarkState';

interface FineBookmarkContextValue extends BookmarkState {
  handleSaveNotes: (notes: string, createdBy?: string) => Promise<void>;
  bookmarkName: string;
}

const FineBookmarkContext = createContext<FineBookmarkContextValue | null>(null);

interface FineBookmarkProviderProps {
  fineId: number;
  jurisdiction: string;
  onBookmarkChange?: (fineId: number, bookmarked: boolean) => void;
  children: ReactNode;
}

export function FineBookmarkProvider({ fineId, jurisdiction, onBookmarkChange, children }: FineBookmarkProviderProps) {
  const { bookmarkName, saveBookmarkName } = useBookmarkName();

  const fetchBookmark = useCallback(async () => {
    const result = await getFineBookmark(fineId);
    return result.success ? result.data : null;
  }, [fineId]);

  const toggleBookmarkFn = useCallback(async () => {
    const result = await toggleFineBookmark(fineId, jurisdiction, undefined, bookmarkName || undefined);
    if (!result.success) return undefined as unknown as Bookmark | null;
    return result.data;
  }, [fineId, jurisdiction, bookmarkName]);

  const state = useBookmarkState({ fetchBookmark, toggleBookmark: toggleBookmarkFn, jurisdiction });

  // Notify parent of bookmark changes
  useEffect(() => {
    onBookmarkChange?.(fineId, state.isBookmarked);
  }, [state.isBookmarked]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveNotes = useCallback(async (notes: string, createdBy?: string) => {
    if (createdBy) {
      saveBookmarkName(createdBy);
    }
    if (state.bookmark) {
      const result = await updateBookmarkNotes(state.bookmark.id, notes, createdBy);
      if (result.success) {
        state.setBookmark({ ...state.bookmark, notes, createdBy: createdBy ?? state.bookmark.createdBy });
      }
    }
  }, [state.bookmark, saveBookmarkName, state.setBookmark]);

  return (
    <FineBookmarkContext.Provider value={{ ...state, handleSaveNotes, bookmarkName }}>
      {children}
    </FineBookmarkContext.Provider>
  );
}

/** Star toggle — place in header areas */
export function FineDetailBookmark({ fineId, jurisdiction, size = 'md', showLabel = true }: { fineId: number; jurisdiction: string; size?: 'sm' | 'md'; showLabel?: boolean }) {
  const ctx = useContext(FineBookmarkContext);

  // If used outside provider (e.g. server component slot), render standalone
  if (!ctx) {
    return <StandaloneFineDetailBookmark fineId={fineId} jurisdiction={jurisdiction} />;
  }

  return (
    <BookmarkButton
      isBookmarked={ctx.isBookmarked}
      onToggle={ctx.handleToggle}
      isLoading={ctx.isLoading}
      size={size}
      showLabel={showLabel}
    />
  );
}

/** Amber notes card — place below the header */
export function FineDetailNotesCard() {
  const ctx = useContext(FineBookmarkContext);
  if (!ctx || !ctx.isBookmarked || !ctx.bookmark) return null;

  return (
    <div className="mb-6">
      <BookmarkNotesCard
        bookmark={ctx.bookmark}
        onSave={ctx.handleSaveNotes}
        defaultName={ctx.bookmarkName}
        markers={ctx.markers}
        availableGroups={ctx.availableGroups}
        onMarkerToggle={ctx.handleMarkerToggle}
        onCreateCustom={ctx.handleCreateCustomMarker}
      />
    </div>
  );
}

// Fallback when rendered outside provider
function StandaloneFineDetailBookmark({ fineId, jurisdiction }: { fineId: number; jurisdiction: string }) {
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { bookmarkName } = useBookmarkName();

  useEffect(() => {
    async function fetch() {
      const result = await getFineBookmark(fineId);
      if (result.success && result.data) setBookmark(result.data);
      setIsLoading(false);
    }
    fetch();
  }, [fineId]);

  const handleToggle = useCallback(async () => {
    if (bookmark) setBookmark(null);
    const result = await toggleFineBookmark(fineId, jurisdiction, undefined, bookmarkName || undefined);
    if (result.success && result.data) setBookmark(result.data);
    else if (!result.success) {
      const refetch = await getFineBookmark(fineId);
      if (refetch.success && refetch.data) setBookmark(refetch.data);
    }
  }, [fineId, jurisdiction, bookmark, bookmarkName]);

  return (
    <BookmarkButton
      isBookmarked={bookmark !== null}
      onToggle={handleToggle}
      isLoading={isLoading}
      size="md"
      showLabel
    />
  );
}
