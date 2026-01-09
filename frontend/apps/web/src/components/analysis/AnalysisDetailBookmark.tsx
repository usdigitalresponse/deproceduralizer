'use client';

import { useState, useCallback, useEffect } from 'react';
import type { StateCode, Bookmark } from '@deproceduralizer/database';
import { BookmarkButton } from '@/components/ui';
import {
  toggleAnalysisBookmarkByDocIssue,
  getBookmarkByDocIssue,
} from '@/lib/actions/bookmarks';

interface AnalysisDetailBookmarkProps {
  documentId: number;
  issueType: string;
  state: StateCode;
  onBookmarkChange?: (bookmark: Bookmark | null) => void;
}

/**
 * Bookmark toggle button for the analysis detail page navigation.
 * Just the button - notes are shown separately in BookmarkNotesCard.
 */
export function AnalysisDetailBookmark({
  documentId,
  issueType,
  state,
  onBookmarkChange,
}: AnalysisDetailBookmarkProps) {
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isBookmarked = bookmark !== null;

  // Fetch bookmark status
  useEffect(() => {
    async function fetchBookmark() {
      const result = await getBookmarkByDocIssue(documentId, issueType);
      if (result.success) {
        setBookmark(result.data);
        onBookmarkChange?.(result.data);
      }
      setIsLoading(false);
    }
    fetchBookmark();
  }, [documentId, issueType, onBookmarkChange]);

  const handleToggle = useCallback(async () => {
    const wasBookmarked = isBookmarked;

    // Optimistic update
    if (wasBookmarked) {
      setBookmark(null);
      onBookmarkChange?.(null);
    }

    const result = await toggleAnalysisBookmarkByDocIssue(documentId, issueType, state);

    if (!result.success) {
      // Revert on failure - refetch to get current state
      const refetchResult = await getBookmarkByDocIssue(documentId, issueType);
      if (refetchResult.success) {
        setBookmark(refetchResult.data);
        onBookmarkChange?.(refetchResult.data);
      }
      console.error('Failed to toggle bookmark:', result.error);
    } else if (result.data) {
      // New bookmark created
      setBookmark(result.data);
      onBookmarkChange?.(result.data);
    }
  }, [documentId, issueType, state, isBookmarked, onBookmarkChange]);

  return (
    <BookmarkButton
      isBookmarked={isBookmarked}
      onToggle={handleToggle}
      isLoading={isLoading}
      size="md"
      showLabel
    />
  );
}

export default AnalysisDetailBookmark;
