'use client';

import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react';
import { BookmarkButton } from '@/components/ui';
import { useBookmarkName } from '@/hooks/useBookmarkName';
import { BookmarkNotesCard } from './FineBookmarkButton';
import { getFineBookmark, toggleFineBookmark, updateBookmarkNotes } from '@/lib/actions/bookmarks';
import type { Bookmark } from '@deproceduralizer/database';

// Context so the header star and notes card share state
interface FineBookmarkContextValue {
  bookmark: Bookmark | null;
  isLoading: boolean;
  isBookmarked: boolean;
  handleToggle: () => Promise<void>;
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
    if (wasBookmarked) {
      setBookmark(null);
      onBookmarkChange?.(fineId, false);
    } else {
      // Optimistic: show bookmarked immediately with a placeholder
      setBookmark({
        id: -1,
        documentId: null,
        analysisId: null,
        guidanceDocumentId: null,
        fineId: fineId,
        issueType: null,
        jurisdiction,
        notes: null,
        createdBy: bookmarkName || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      onBookmarkChange?.(fineId, true);
    }

    const result = await toggleFineBookmark(fineId, jurisdiction, undefined, bookmarkName || undefined);

    if (!result.success) {
      const refetch = await getFineBookmark(fineId);
      if (refetch.success && refetch.data) {
        setBookmark(refetch.data);
        onBookmarkChange?.(fineId, true);
      } else {
        setBookmark(null);
        onBookmarkChange?.(fineId, false);
      }
    } else if (result.data) {
      setBookmark(result.data);
      onBookmarkChange?.(fineId, true);
    } else {
      setBookmark(null);
      onBookmarkChange?.(fineId, false);
    }
  }, [fineId, jurisdiction, isBookmarked, bookmarkName, onBookmarkChange]);

  const handleSaveNotes = useCallback(async (notes: string, createdBy?: string) => {
    if (createdBy) {
      saveBookmarkName(createdBy);
    }
    if (bookmark) {
      const result = await updateBookmarkNotes(bookmark.id, notes, createdBy);
      if (result.success) {
        setBookmark(prev => prev ? { ...prev, notes, createdBy: createdBy ?? prev.createdBy } : null);
      }
    }
  }, [bookmark, saveBookmarkName]);

  return (
    <FineBookmarkContext.Provider value={{ bookmark, isLoading, isBookmarked, handleToggle, handleSaveNotes, bookmarkName }}>
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
