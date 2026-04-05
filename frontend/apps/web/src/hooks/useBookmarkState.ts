'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  getMarkersForBookmark,
  assignMarkerToBookmark,
  removeMarkerFromBookmark,
} from '@/lib/actions/bookmarks';
import { getMarkerGroups, getOrCreateCustomMarkerGroup } from '@/lib/actions/marker-groups';
import type { Bookmark, MarkerGroup } from '@deproceduralizer/database';

export type MarkerInfo = { id: number; name: string; color: string };

export interface UseBookmarkStateOptions {
  /** Fetch the current bookmark (return null if not bookmarked) */
  fetchBookmark: () => Promise<Bookmark | null>;
  /** Toggle the bookmark (return created bookmark or null if removed) */
  toggleBookmark: () => Promise<Bookmark | null>;
  /** Jurisdiction for marker group scoping */
  jurisdiction: string;
}

export interface BookmarkState {
  bookmark: Bookmark | null;
  isLoading: boolean;
  isBookmarked: boolean;
  handleToggle: () => Promise<void>;
  refreshBookmark: () => Promise<void>;
  markers: MarkerInfo[];
  availableGroups: MarkerGroup[];
  handleMarkerToggle: (bookmarkId: number, markerGroupId: number, assign: boolean) => void;
  handleCreateCustomMarker: (name: string) => void;
  setBookmark: (bookmark: Bookmark | null) => void;
}

/**
 * Shared bookmark + marker state management hook.
 * Accepts entity-specific fetch/toggle functions and handles:
 * - Bookmark state lifecycle (fetch, toggle with optimistic update, refresh)
 * - Marker groups fetching
 * - Marker assignment (optimistic toggle, create custom)
 */
export function useBookmarkState({
  fetchBookmark,
  toggleBookmark,
  jurisdiction,
}: UseBookmarkStateOptions): BookmarkState {
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [markers, setMarkers] = useState<MarkerInfo[]>([]);
  const [availableGroups, setAvailableGroups] = useState<MarkerGroup[]>([]);

  const isBookmarked = bookmark !== null;

  // Fetch bookmark on mount / when fetchBookmark changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await fetchBookmark();
      if (!cancelled) {
        setBookmark(result);
        setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [fetchBookmark]);

  // Fetch marker groups once
  useEffect(() => {
    let cancelled = false;
    async function fetchGroups() {
      const result = await getMarkerGroups(jurisdiction);
      if (!cancelled && result.success) {
        setAvailableGroups(result.data);
      }
    }
    fetchGroups();
    return () => { cancelled = true; };
  }, [jurisdiction]);

  // Fetch markers when bookmark changes
  useEffect(() => {
    if (!bookmark || bookmark.id < 0) {
      setMarkers([]);
      return;
    }
    let cancelled = false;
    async function fetchMarkers() {
      const result = await getMarkersForBookmark(bookmark!.id);
      if (!cancelled && result.success) {
        setMarkers(result.data);
      }
    }
    fetchMarkers();
    return () => { cancelled = true; };
  }, [bookmark?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle bookmark with optimistic update
  const handleToggle = useCallback(async () => {
    const wasBookmarked = isBookmarked;
    if (wasBookmarked) {
      setBookmark(null);
    }

    const result = await toggleBookmark();

    if (result === undefined) {
      // Server action failed — refetch actual state
      const refetched = await fetchBookmark();
      setBookmark(refetched);
    } else {
      setBookmark(result);
      if (!result) {
        setMarkers([]);
      }
    }
  }, [isBookmarked, toggleBookmark, fetchBookmark]);

  // Re-fetch bookmark + markers (used after external mutations like triage toggle)
  const refreshBookmark = useCallback(async () => {
    const result = await fetchBookmark();
    setBookmark(result);
    if (result && result.id > 0) {
      const markersResult = await getMarkersForBookmark(result.id);
      if (markersResult.success) {
        setMarkers(markersResult.data);
      }
    } else {
      setMarkers([]);
    }
  }, [fetchBookmark]);

  // Optimistic marker toggle
  const handleMarkerToggle = useCallback((bookmarkId: number, markerGroupId: number, assign: boolean) => {
    if (assign) {
      const group = availableGroups.find(g => g.id === markerGroupId);
      if (group) {
        setMarkers(prev => [...prev, { id: group.id, name: group.name, color: group.color }]);
      }
      assignMarkerToBookmark(bookmarkId, markerGroupId).then(result => {
        if (!result.success) {
          setMarkers(prev => prev.filter(m => m.id !== markerGroupId));
        }
      });
    } else {
      const removed = markers.find(m => m.id === markerGroupId);
      setMarkers(prev => prev.filter(m => m.id !== markerGroupId));
      removeMarkerFromBookmark(bookmarkId, markerGroupId).then(result => {
        if (!result.success && removed) {
          setMarkers(prev => [...prev, removed]);
        }
      });
    }
  }, [availableGroups, markers]);

  // Create custom marker group and assign
  const handleCreateCustomMarker = useCallback(async (name: string) => {
    if (!bookmark || bookmark.id < 0) return;
    const result = await getOrCreateCustomMarkerGroup(name, jurisdiction);
    if (result.success) {
      setAvailableGroups(prev => prev.some(g => g.id === result.data.id) ? prev : [...prev, result.data]);
      await assignMarkerToBookmark(bookmark.id, result.data.id);
      setMarkers(prev => prev.some(m => m.id === result.data.id) ? prev : [...prev, { id: result.data.id, name: result.data.name, color: result.data.color }]);
    }
  }, [bookmark, jurisdiction]);

  return {
    bookmark,
    isLoading,
    isBookmarked,
    handleToggle,
    refreshBookmark,
    markers,
    availableGroups,
    handleMarkerToggle,
    handleCreateCustomMarker,
    setBookmark,
  };
}
