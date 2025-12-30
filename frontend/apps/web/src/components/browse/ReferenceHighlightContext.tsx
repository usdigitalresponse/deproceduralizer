'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { getDocumentReferenceContext } from '@/lib/actions/cross-references';

/**
 * Highlight type for tree nodes
 */
export type HighlightType = 'selected' | 'references' | 'referencedBy' | null;

/**
 * State for reference highlighting in the tree view
 */
interface ReferenceHighlightState {
  selectedDocId: number | null;
  referencedByIds: Set<number>; // Documents that reference the selected document
  referencesIds: Set<number>; // Documents that the selected document references
  isLoading: boolean;
}

/**
 * Context value including state and actions
 */
interface ReferenceHighlightContextValue extends ReferenceHighlightState {
  setSelectedDocument: (docId: number | null) => Promise<void>;
  clearHighlights: () => void;
  getHighlightType: (docId: number) => HighlightType;
}

const ReferenceHighlightContext = createContext<ReferenceHighlightContextValue | null>(null);

interface ReferenceHighlightProviderProps {
  children: ReactNode;
}

export function ReferenceHighlightProvider({ children }: ReferenceHighlightProviderProps) {
  const [state, setState] = useState<ReferenceHighlightState>({
    selectedDocId: null,
    referencedByIds: new Set(),
    referencesIds: new Set(),
    isLoading: false,
  });

  const setSelectedDocument = useCallback(async (docId: number | null) => {
    if (!docId) {
      setState((prev) => ({
        ...prev,
        selectedDocId: null,
        referencedByIds: new Set(),
        referencesIds: new Set(),
        isLoading: false,
      }));
      return;
    }

    // If same document, just toggle off
    if (docId === state.selectedDocId) {
      setState((prev) => ({
        ...prev,
        selectedDocId: null,
        referencedByIds: new Set(),
        referencesIds: new Set(),
        isLoading: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, selectedDocId: docId }));

    try {
      const result = await getDocumentReferenceContext(docId);

      if (result.success) {
        setState({
          selectedDocId: docId,
          referencedByIds: new Set(result.data.incomingRefs.map((r) => r.sourceId)),
          referencesIds: new Set(result.data.outgoingRefs.map((r) => r.targetId)),
          isLoading: false,
        });
      } else {
        // On failure, still show as selected but no highlights
        setState((prev) => ({
          ...prev,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error('[ReferenceHighlightContext] Error fetching context:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [state.selectedDocId]);

  const clearHighlights = useCallback(() => {
    setState({
      selectedDocId: null,
      referencedByIds: new Set(),
      referencesIds: new Set(),
      isLoading: false,
    });
  }, []);

  const getHighlightType = useCallback(
    (docId: number): HighlightType => {
      if (docId === state.selectedDocId) return 'selected';
      if (state.referencesIds.has(docId)) return 'references';
      if (state.referencedByIds.has(docId)) return 'referencedBy';
      return null;
    },
    [state.selectedDocId, state.referencesIds, state.referencedByIds]
  );

  const value = useMemo(
    () => ({
      ...state,
      setSelectedDocument,
      clearHighlights,
      getHighlightType,
    }),
    [state, setSelectedDocument, clearHighlights, getHighlightType]
  );

  return (
    <ReferenceHighlightContext.Provider value={value}>{children}</ReferenceHighlightContext.Provider>
  );
}

/**
 * Hook to access reference highlight context
 */
export function useReferenceHighlight() {
  const context = useContext(ReferenceHighlightContext);
  if (!context) {
    throw new Error('useReferenceHighlight must be used within a ReferenceHighlightProvider');
  }
  return context;
}

/**
 * Optional hook that returns null if used outside provider (for optional usage)
 */
export function useReferenceHighlightOptional() {
  return useContext(ReferenceHighlightContext);
}
