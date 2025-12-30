'use client';

import { useRef, useState, useCallback } from 'react';
import { useTermHighlighting, type TermMatch, type CrossRefMatch } from '@/hooks';
import { DefinitionPopover } from '@/components/definitions';
import { CrossRefPopover } from '@/components/cross-references';
import type { ApplicableDefinition } from '@deproceduralizer/database';

interface AnnotatableContentProps {
  content: string;
  documentId: number;
  state: string;
  /** Applicable definitions for term highlighting */
  applicableDefinitions?: ApplicableDefinition[];
  /** Cross-reference matches for inline highlighting */
  crossRefHighlights?: CrossRefMatch[];
  /** Search query for highlighting */
  searchQuery?: string;
  /** Current match index for navigation */
  currentMatchIndex?: number;
}

/** Represents a highlighted region in the content */
interface HighlightRegion {
  type: 'crossref' | 'term' | 'search';
  startOffset: number;
  endOffset: number;
  data: CrossRefMatch | TermMatch | { matchIndex: number };
}

/** State for the selected term popover */
interface SelectedTermState {
  termMatch: TermMatch;
  rect: DOMRect;
}

/** State for the selected cross-ref popover */
interface SelectedCrossRefState {
  crossRef: CrossRefMatch;
  rect: DOMRect;
}

export function AnnotatableContent({
  content,
  documentId,
  state,
  applicableDefinitions,
  crossRefHighlights,
  searchQuery = '',
  currentMatchIndex = 0,
}: AnnotatableContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTerm, setSelectedTerm] = useState<SelectedTermState | null>(null);
  const [selectedCrossRef, setSelectedCrossRef] = useState<SelectedCrossRefState | null>(null);

  // Get term matches from applicable definitions
  const termMatches = useTermHighlighting(content, applicableDefinitions);

  // Handle term click - show definition popover
  const handleTermClick = useCallback((e: React.MouseEvent, termMatch: TermMatch) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setSelectedTerm({ termMatch, rect });
  }, []);

  // Close term popover
  const handleCloseTermPopover = useCallback(() => {
    setSelectedTerm(null);
  }, []);

  // Handle cross-ref click - show cross-ref popover
  const handleCrossRefClick = useCallback((e: React.MouseEvent, crossRef: CrossRefMatch) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setSelectedCrossRef({ crossRef, rect });
  }, []);

  // Close cross-ref popover
  const handleCloseCrossRefPopover = useCallback(() => {
    setSelectedCrossRef(null);
  }, []);

  // Find search matches in content
  const searchMatches = useCallback((): { start: number; end: number }[] => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const matches: { start: number; end: number }[] = [];
    let pos = 0;
    const lowerContent = content.toLowerCase();

    while (pos < content.length) {
      const idx = lowerContent.indexOf(query, pos);
      if (idx === -1) break;
      matches.push({ start: idx, end: idx + query.length });
      pos = idx + 1;
    }

    return matches;
  }, [content, searchQuery]);

  // Merge cross-ref regions, term regions, and search matches
  // Priority: cross-refs > terms
  const mergeHighlightRegions = useCallback((): HighlightRegion[] => {
    const regions: HighlightRegion[] = [];

    // Add cross-ref regions (highest priority)
    if (crossRefHighlights) {
      for (const crossRef of crossRefHighlights) {
        regions.push({
          type: 'crossref',
          startOffset: crossRef.startOffset,
          endOffset: crossRef.endOffset,
          data: crossRef,
        });
      }
    }

    // Add term regions (filter out those overlapping with cross-refs)
    for (const match of termMatches) {
      const overlapsCrossRef = regions.some(
        (r) =>
          r.type === 'crossref' &&
          match.startOffset < r.endOffset &&
          match.endOffset > r.startOffset
      );

      if (!overlapsCrossRef) {
        regions.push({
          type: 'term',
          startOffset: match.startOffset,
          endOffset: match.endOffset,
          data: match,
        });
      }
    }

    // Add search matches (don't filter - they should highlight through other regions)
    const matches = searchMatches();
    matches.forEach((match, idx) => {
      regions.push({
        type: 'search',
        startOffset: match.start,
        endOffset: match.end,
        data: { matchIndex: idx },
      });
    });

    // Sort by start offset
    return regions.sort((a, b) => a.startOffset - b.startOffset);
  }, [crossRefHighlights, termMatches, searchMatches]);

  // Render content with term and search highlights
  const renderContentWithHighlights = () => {
    // Get regions but separate search from others
    const termCrossRefRegions: HighlightRegion[] = [];
    const searchRegions: HighlightRegion[] = [];

    for (const region of mergeHighlightRegions()) {
      if (region.type === 'search') {
        searchRegions.push(region);
      } else {
        termCrossRefRegions.push(region);
      }
    }

    // Helper to wrap text in search highlight if it falls within a search match
    const wrapWithSearchHighlight = (text: string, startOffset: number, key: string): React.ReactNode => {
      if (searchRegions.length === 0) return text;

      // Find search matches that overlap with this text segment
      const relevantSearches = searchRegions.filter(
        sr => sr.startOffset < startOffset + text.length && sr.endOffset > startOffset
      );

      if (relevantSearches.length === 0) return text;

      // Build segments with search highlighting
      const segments: React.ReactNode[] = [];
      let pos = 0;

      for (const sr of relevantSearches) {
        const matchData = sr.data as { matchIndex: number };
        const relStart = Math.max(0, sr.startOffset - startOffset);
        const relEnd = Math.min(text.length, sr.endOffset - startOffset);

        if (relStart > pos) {
          segments.push(text.slice(pos, relStart));
        }

        const isCurrent = matchData.matchIndex === currentMatchIndex;
        segments.push(
          <span
            key={`${key}-search-${matchData.matchIndex}`}
            className={`search-highlight ${
              isCurrent
                ? 'bg-[var(--color-warning)] text-[var(--color-text)]'
                : 'bg-yellow-200 text-[var(--color-text)]'
            } rounded px-0.5`}
          >
            {text.slice(relStart, relEnd)}
          </span>
        );

        pos = relEnd;
      }

      if (pos < text.length) {
        segments.push(text.slice(pos));
      }

      return <>{segments}</>;
    };

    if (termCrossRefRegions.length === 0) {
      // Only search highlights (or no highlights at all)
      return <span>{wrapWithSearchHighlight(content, 0, 'root')}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    termCrossRefRegions.forEach((region, idx) => {
      // Add text before this region
      if (region.startOffset > lastIndex) {
        const beforeText = content.slice(lastIndex, region.startOffset);
        parts.push(
          <span key={`text-${idx}`}>{wrapWithSearchHighlight(beforeText, lastIndex, `text-${idx}`)}</span>
        );
      }

      const text = content.slice(region.startOffset, region.endOffset);

      if (region.type === 'crossref') {
        // Cross-reference highlight (green dotted underline)
        const crossRef = region.data as CrossRefMatch;
        parts.push(
          <span
            key={`crossref-${crossRef.id}`}
            className="crossref-highlight"
            onClick={(e) => handleCrossRefClick(e, crossRef)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCrossRefClick(e as unknown as React.MouseEvent, crossRef);
              }
            }}
            title={`Cross-reference: ${crossRef.rawText}`}
          >
            {wrapWithSearchHighlight(text, region.startOffset, `crossref-${crossRef.id}`)}
          </span>
        );
      } else if (region.type === 'term') {
        // Term highlight (dotted underline)
        const termMatch = region.data as TermMatch;
        parts.push(
          <span
            key={`term-${region.startOffset}`}
            className="term-highlight"
            onClick={(e) => handleTermClick(e, termMatch)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTermClick(e as unknown as React.MouseEvent, termMatch);
              }
            }}
            title={`Defined term: ${termMatch.term}`}
          >
            {wrapWithSearchHighlight(text, region.startOffset, `term-${region.startOffset}`)}
          </span>
        );
      }

      lastIndex = region.endOffset;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex);
      parts.push(
        <span key="text-end">{wrapWithSearchHighlight(remainingText, lastIndex, 'text-end')}</span>
      );
    }

    return <>{parts}</>;
  };

  return (
    <>
      <div
        ref={containerRef}
        className="whitespace-pre-wrap text-[var(--color-text)]"
      >
        {renderContentWithHighlights()}
      </div>

      {/* Definition popover for highlighted terms */}
      {selectedTerm && (
        <DefinitionPopover
          definition={selectedTerm.termMatch.definition}
          term={selectedTerm.termMatch.term}
          anchorRect={selectedTerm.rect}
          onClose={handleCloseTermPopover}
          state={state}
          currentDocumentId={documentId}
        />
      )}

      {/* Cross-reference popover for highlighted citations */}
      {selectedCrossRef && (
        <CrossRefPopover
          crossRef={selectedCrossRef.crossRef}
          anchorRect={selectedCrossRef.rect}
          onClose={handleCloseCrossRefPopover}
          state={state}
        />
      )}
    </>
  );
}

export default AnnotatableContent;
