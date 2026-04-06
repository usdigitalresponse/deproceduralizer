import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { BookmarkWithDetails, MarkerGroup, JurisdictionCode } from '@deproceduralizer/database';
import { removeBookmark, updateBookmarkNotes, assignMarkerToBookmark, removeMarkerFromBookmark } from '@/lib/actions/bookmarks';
import { createMarkerGroup, updateMarkerGroup, deleteMarkerGroup, deleteMarkerGroupAndUnmarkAll, reorderMarkerGroups, getOrCreateCustomMarkerGroup } from '@/lib/actions/marker-groups';

interface UseMarkerMutationsProps {
  bookmarks: BookmarkWithDetails[];
  markerGroups: MarkerGroup[];
  jurisdiction: JurisdictionCode;
}

export function useMarkerMutations({ bookmarks, markerGroups, jurisdiction }: UseMarkerMutationsProps) {
  const [localBookmarks, setLocalBookmarks] = useState(bookmarks);
  const [localGroups, setLocalGroups] = useState(markerGroups);

  const handleRemove = useCallback(async (bookmarkId: number) => {
    setLocalBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
    const result = await removeBookmark(bookmarkId);
    if (!result.success) {
      setLocalBookmarks(bookmarks);
      toast.error('Could not unsave item');
    }
  }, [bookmarks]);

  const handleSaveNotes = useCallback(async (bookmarkId: number, notes: string) => {
    const result = await updateBookmarkNotes(bookmarkId, notes);
    if (result.success) {
      setLocalBookmarks(prev =>
        prev.map(b => b.id === bookmarkId ? { ...b, notes } : b)
      );
    }
  }, []);

  const handleMarkerToggle = useCallback(async (bookmarkId: number, markerGroupId: number, assign: boolean) => {
    // Optimistic update
    setLocalBookmarks(prev => prev.map(b => {
      if (b.id !== bookmarkId) return b;
      const markers = assign
        ? [...b.markers, localGroups.find(g => g.id === markerGroupId)!].filter(Boolean).map(g => ({ id: g.id, name: g.name, color: g.color }))
        : b.markers.filter(m => m.id !== markerGroupId);
      return { ...b, markers };
    }));

    const result = assign
      ? await assignMarkerToBookmark(bookmarkId, markerGroupId)
      : await removeMarkerFromBookmark(bookmarkId, markerGroupId);

    if (!result.success) {
      setLocalBookmarks(bookmarks); // Revert
      toast.error('Could not update label');
    }
  }, [bookmarks, localGroups]);

  const handleCreateCustomMarker = useCallback(async (name: string) => {
    const result = await getOrCreateCustomMarkerGroup(name, jurisdiction);
    if (result.success) {
      setLocalGroups(prev => {
        if (prev.some(g => g.id === result.data.id)) return prev;
        return [...prev, result.data];
      });
      toast.success(`Label "${name}" created`);
      return result.data;
    }
    toast.error('Could not create label');
    return null;
  }, [jurisdiction]);

  const handleCreateGroup = useCallback(async (name: string, color: string) => {
    const result = await createMarkerGroup({ name, color, jurisdiction });
    if (result.success) setLocalGroups(prev =>
      prev.some(g => g.id === result.data.id) ? prev : [...prev, result.data]
    );
  }, [jurisdiction]);

  const handleUpdateGroup = useCallback(async (id: number, updates: { name?: string; color?: string }) => {
    const result = await updateMarkerGroup(id, updates);
    if (result.success) setLocalGroups(prev => prev.map(g => g.id === id ? result.data : g));
  }, []);

  const handleDeleteGroup = useCallback(async (id: number) => {
    const result = await deleteMarkerGroup(id);
    if (result.success) {
      setLocalGroups(prev => prev.filter(g => g.id !== id));
      setLocalBookmarks(prev => prev.map(b => ({
        ...b,
        markers: b.markers.filter(m => m.id !== id),
      })));
    }
  }, []);

  const handleDeleteGroupAndUnmarkAll = useCallback(async (id: number) => {
    const result = await deleteMarkerGroupAndUnmarkAll(id);
    if (result.success) {
      setLocalGroups(prev => prev.filter(g => g.id !== id));
      setLocalBookmarks(prev => prev.filter(b => !b.markers.some(m => m.id === id)));
    }
  }, []);

  const handleReorderGroups = useCallback(async (ids: number[]) => {
    // Optimistic reorder
    const reordered = ids.map(id => localGroups.find(g => g.id === id)!).filter(Boolean);
    setLocalGroups(reordered);
    await reorderMarkerGroups(ids);
  }, [localGroups]);

  return {
    localBookmarks,
    setLocalBookmarks,  // needed for drawer sync
    localGroups,
    setLocalGroups,     // needed for manager
    handleRemove,
    handleSaveNotes,
    handleMarkerToggle,
    handleCreateCustomMarker,
    handleCreateGroup,
    handleUpdateGroup,
    handleDeleteGroup,
    handleDeleteGroupAndUnmarkAll,
    handleReorderGroups,
  };
}
