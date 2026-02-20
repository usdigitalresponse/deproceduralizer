'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { useTermHighlighting, type TermMatch, type CrossRefMatch } from '@/hooks';
import { DefinitionPopover } from '@/components/definitions';
import { CrossRefPopover } from '@/components/cross-references';
import { MarkdownTable } from '@/components/ui/MarkdownTable';
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

  // Split content into table and non-table segments (line-based for robustness)
  const contentSegments = useMemo(() => {
    const segments: { type: 'text' | 'table'; value: string; startOffset: number }[] = [];
    const lines = content.split('\n');

    // Find separator rows and build table blocks around them
    const isTableRow = (line: string) => line.trimStart().startsWith('|') && line.trimEnd().endsWith('|');
    const isSeparator = (line: string) => /^\|[\s:-]+(\|[\s:-]+)+\|$/.test(line.trim());

    // Mark which lines belong to tables
    const lineInTable = new Array(lines.length).fill(false);
    for (let i = 0; i < lines.length; i++) {
      if (isSeparator(lines[i])) {
        // Walk backward to find header rows
        let start = i - 1;
        while (start >= 0 && isTableRow(lines[start])) start--;
        start++;
        // Walk forward to find data rows
        let end = i + 1;
        while (end < lines.length && isTableRow(lines[end])) end++;
        for (let j = start; j < end; j++) lineInTable[j] = true;
      }
    }

    // Build segments from marked lines
    let offset = 0;
    let currentType: 'text' | 'table' | null = null;
    let currentStart = 0;
    let currentLines: string[] = [];

    const flush = () => {
      if (currentLines.length > 0 && currentType) {
        segments.push({ type: currentType, value: currentLines.join('\n'), startOffset: currentStart });
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const type = lineInTable[i] ? 'table' : 'text';
      if (type !== currentType) {
        flush();
        currentType = type;
        currentStart = offset;
        currentLines = [lines[i]];
      } else {
        currentLines.push(lines[i]);
      }
      offset += lines[i].length + 1; // +1 for \n
    }
    flush();

    return segments;
  }, [content]);

  // Get term matches from applicable definitions
  const termMatches = useTermHighlighting(content, applicableDefinitions);

  // Handle term click - show definition popover
  const handleTermClick = useCallback((e: React.SyntheticEvent, termMatch: TermMatch) => {
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
  const handleCrossRefClick = useCallback((e: React.SyntheticEvent, crossRef: CrossRefMatch) => {
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

  // Render a text segment with term, cross-ref, and search highlights
  const renderTextWithHighlights = (text: string, segmentOffset: number, segmentKey: string) => {
    // Get regions but separate search from others
    const allRegions = mergeHighlightRegions();

    // Filter to regions that overlap with this text segment
    const segmentEnd = segmentOffset + text.length;
    const termCrossRefRegions = allRegions.filter(
      r => r.type !== 'search' && r.startOffset < segmentEnd && r.endOffset > segmentOffset
    );
    const searchRegions = allRegions.filter(
      r => r.type === 'search' && r.startOffset < segmentEnd && r.endOffset > segmentOffset
    );

    // Helper to wrap text in search highlight if it falls within a search match
    const wrapWithSearchHighlight = (txt: string, startOffset: number, key: string): React.ReactNode => {
      if (searchRegions.length === 0) return txt;

      const relevantSearches = searchRegions.filter(
        sr => sr.startOffset < startOffset + txt.length && sr.endOffset > startOffset
      );

      if (relevantSearches.length === 0) return txt;

      const parts: React.ReactNode[] = [];
      let pos = 0;

      for (const sr of relevantSearches) {
        const matchData = sr.data as { matchIndex: number };
        const relStart = Math.max(0, sr.startOffset - startOffset);
        const relEnd = Math.min(txt.length, sr.endOffset - startOffset);

        if (relStart > pos) {
          parts.push(txt.slice(pos, relStart));
        }

        const isCurrent = matchData.matchIndex === currentMatchIndex;
        parts.push(
          <span
            key={`${key}-search-${matchData.matchIndex}`}
            className={`search-highlight ${
              isCurrent
                ? 'bg-[var(--color-warning)] text-[var(--color-text)]'
                : 'bg-yellow-200 text-[var(--color-text)]'
            } rounded px-0.5`}
          >
            {txt.slice(relStart, relEnd)}
          </span>
        );

        pos = relEnd;
      }

      if (pos < txt.length) {
        parts.push(txt.slice(pos));
      }

      return <>{parts}</>;
    };

    if (termCrossRefRegions.length === 0) {
      return <span key={segmentKey}>{wrapWithSearchHighlight(text, segmentOffset, segmentKey)}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = segmentOffset;

    termCrossRefRegions.forEach((region, idx) => {
      if (region.startOffset > lastIndex) {
        const beforeText = content.slice(lastIndex, region.startOffset);
        parts.push(
          <span key={`${segmentKey}-text-${idx}`}>{wrapWithSearchHighlight(beforeText, lastIndex, `${segmentKey}-text-${idx}`)}</span>
        );
      }

      const regionText = content.slice(region.startOffset, region.endOffset);

      if (region.type === 'crossref') {
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
                handleCrossRefClick(e, crossRef);
              }
            }}
            title={`Cross-reference: ${crossRef.rawText}`}
          >
            {wrapWithSearchHighlight(regionText, region.startOffset, `crossref-${crossRef.id}`)}
          </span>
        );
      } else if (region.type === 'term') {
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
                handleTermClick(e, termMatch);
              }
            }}
            title={`Defined term: ${termMatch.term}`}
          >
            {wrapWithSearchHighlight(regionText, region.startOffset, `term-${region.startOffset}`)}
          </span>
        );
      }

      lastIndex = region.endOffset;
    });

    if (lastIndex < segmentEnd) {
      const remainingText = content.slice(lastIndex, segmentEnd);
      parts.push(
        <span key={`${segmentKey}-text-end`}>{wrapWithSearchHighlight(remainingText, lastIndex, `${segmentKey}-text-end`)}</span>
      );
    }

    return <>{parts}</>;
  };

  // Render content: tables as HTML tables, text with highlights
  const renderContentWithHighlights = () => {
    // If no table segments, render everything as text (fast path)
    if (contentSegments.length === 1 && contentSegments[0].type === 'text') {
      return renderTextWithHighlights(content, 0, 'root');
    }

    return (
      <>
        {contentSegments.map((segment, idx) => {
          if (segment.type === 'table') {
            return <MarkdownTable key={`table-${idx}`} markdown={segment.value} />;
          }
          return renderTextWithHighlights(segment.value, segment.startOffset, `seg-${idx}`);
        })}
      </>
    );
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
