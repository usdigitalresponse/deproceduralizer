'use client';

import { useState, useCallback, useEffect } from 'react';
import { BookmarkButton } from '@/components/ui';
import {
  toggleGuidanceBookmark,
  isGuidanceBookmarked,
} from '@/lib/actions/bookmarks';

interface GuidanceBookmarkButtonProps {
  guidanceDocumentId: number;
  jurisdiction: string;
}

/**
 * Bookmark toggle button for guidance document detail pages.
 */
export function GuidanceBookmarkButton({
  guidanceDocumentId,
  jurisdiction,
}: GuidanceBookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      const result = await isGuidanceBookmarked(guidanceDocumentId);
      if (result.success) {
        setBookmarked(result.data);
      }
      setIsLoading(false);
    }
    fetchStatus();
  }, [guidanceDocumentId]);

  const handleToggle = useCallback(async () => {
    const wasBookmarked = bookmarked;

    // Optimistic update
    setBookmarked(!wasBookmarked);

    const result = await toggleGuidanceBookmark(guidanceDocumentId, jurisdiction);

    if (!result.success) {
      // Revert on failure
      setBookmarked(wasBookmarked);
      console.error('Failed to toggle guidance bookmark:', result.error);
    } else {
      // result.data is null when removed, Bookmark when created
      setBookmarked(result.data !== null);
    }
  }, [guidanceDocumentId, jurisdiction, bookmarked]);

  return (
    <BookmarkButton
      isBookmarked={bookmarked}
      onToggle={handleToggle}
      isLoading={isLoading}
      size="md"
      showLabel
    />
  );
}

export default GuidanceBookmarkButton;
