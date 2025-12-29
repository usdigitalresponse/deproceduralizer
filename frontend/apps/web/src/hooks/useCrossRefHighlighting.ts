'use client';

import { useMemo } from 'react';
import type { HighlightRef } from '@deproceduralizer/database';

/**
 * Represents a cross-reference match for inline highlighting.
 * Unlike term highlighting which uses regex, cross-refs have stored offsets.
 */
export interface CrossRefMatch {
  /** Database ID of the cross-reference */
  id: number;
  /** The raw citation text as it appears in the document */
  rawText: string;
  /** Character offset where the citation starts */
  startOffset: number;
  /** Character offset where the citation ends */
  endOffset: number;
  /** ID of the target document (null if unresolved) */
  targetDocumentId: number | null;
  /** Title of the target document */
  targetTitle: string | null;
  /** Citation of the target document */
  targetCitation: string | null;
  /** Whether the reference was successfully resolved */
  isResolved: boolean;
}

/**
 * Hook for preparing cross-reference data for inline highlighting.
 *
 * Unlike term highlighting which uses regex text matching, cross-references
 * have stored character offsets (start_offset, end_offset) for precise positioning.
 *
 * @param crossRefs - Array of HighlightRef objects from the database
 * @returns Array of CrossRefMatch objects sorted by position, ready for highlighting
 *
 * @example
 * ```tsx
 * const crossRefMatches = useCrossRefHighlighting(crossRefsForHighlighting);
 * // Pass to AnnotatableContent for rendering with click handlers
 * ```
 */
export function useCrossRefHighlighting(
  crossRefs: HighlightRef[] | undefined
): CrossRefMatch[] {
  return useMemo(() => {
    if (!crossRefs?.length) return [];

    // Filter to only refs with valid offsets, map to match format, sort by position
    return crossRefs
      .filter((ref): ref is HighlightRef & { startOffset: number; endOffset: number } =>
        ref.startOffset != null && ref.endOffset != null
      )
      .map((ref) => ({
        id: ref.id,
        rawText: ref.rawText,
        startOffset: ref.startOffset,
        endOffset: ref.endOffset,
        targetDocumentId: ref.targetDocumentId,
        targetTitle: ref.targetTitle,
        targetCitation: ref.targetCitation,
        isResolved: ref.isResolved ?? false,
      }))
      .sort((a, b) => a.startOffset - b.startOffset);
  }, [crossRefs]);
}
