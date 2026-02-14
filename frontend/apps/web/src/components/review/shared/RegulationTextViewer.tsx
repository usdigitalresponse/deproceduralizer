'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { getDefinitionsWithContext } from '@/lib/actions/definitions';
import { getCrossReferencesForHighlighting } from '@/lib/actions/cross-references';
import { useTermHighlighting, useCrossRefHighlighting, type TermMatch, type CrossRefMatch } from '@/hooks';
import { DefinitionPopover } from '@/components/definitions';
import { CrossRefPopover } from '@/components/cross-references';
import type { ApplicableDefinition, HighlightRef } from '@deproceduralizer/database';

interface RegulationTextViewerProps {
  /** Full regulation content */
  content: string;
  /** Document ID for fetching definitions and cross-references */
  documentId: number;
  /** State code for links (e.g., 'nj', 'ny') */
  state: string;
  /** Text to auto-scroll to on open (e.g., matched requirement text) */
  scrollToText?: string | null;
  /** Regex pattern to highlight (only the match, not context) */
  highlightPattern?: string | null;
  /** Whether the scrollToText is a verbatim quote (enables auto-scroll) */
  isVerbatim?: boolean;
  /** Label for the expandable section */
  label?: string;
  /** Max height of scrollable container */
  maxHeight?: string;
  /** Placeholder text for search input */
  placeholder?: string;
  /** Whether expanded by default */
  defaultExpanded?: boolean;
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

/**
 * Displays full regulation text in a collapsible, searchable container.
 * Highlights regex match patterns, definitions, cross-references,
 * and auto-scrolls to verbatim quotes.
 */
export function RegulationTextViewer({
  content,
  documentId,
  state,
  scrollToText,
  highlightPattern,
  isVerbatim = false,
  label = 'Show Regulation Text',
  maxHeight = '400px',
  placeholder = 'Search in text...',
  defaultExpanded = false,
}: RegulationTextViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [hasScrolledToTarget, setHasScrolledToTarget] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const matchRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const targetTextRef = useRef<HTMLSpanElement | null>(null);

  // Lazy loading state for definitions and cross-references
  const [definitions, setDefinitions] = useState<ApplicableDefinition[] | null>(null);
  const [crossRefs, setCrossRefs] = useState<HighlightRef[] | null>(null);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);
  const [highlightsLoaded, setHighlightsLoaded] = useState(false);

  // Popover states
  const [selectedTerm, setSelectedTerm] = useState<SelectedTermState | null>(null);
  const [selectedCrossRef, setSelectedCrossRef] = useState<SelectedCrossRefState | null>(null);

  // Lazy load definitions and cross-references when expanded
  useEffect(() => {
    if (isExpanded && !highlightsLoaded && !isLoadingHighlights) {
      setIsLoadingHighlights(true);
      Promise.all([
        getDefinitionsWithContext(documentId),
        getCrossReferencesForHighlighting(documentId),
      ]).then(([defResult, crossRefResult]) => {
        if (defResult.success && defResult.data) {
          // Combine definedHere and inherited definitions
          const usedInText = defResult.data.usedInText ?? { definedHere: [], inherited: [] };
          const combined = [...(usedInText.definedHere ?? []), ...(usedInText.inherited ?? [])];
          setDefinitions(combined);
        }
        if (crossRefResult.success) {
          setCrossRefs(crossRefResult.data);
        }
        setIsLoadingHighlights(false);
        setHighlightsLoaded(true);
      }).catch(() => {
        setIsLoadingHighlights(false);
        setHighlightsLoaded(true);
      });
    }
  }, [isExpanded, documentId, highlightsLoaded, isLoadingHighlights]);

  // Use highlighting hooks
  const termMatches = useTermHighlighting(content, definitions ?? undefined);
  const crossRefMatches = useCrossRefHighlighting(crossRefs ?? undefined);

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

  // Find all search matches
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !content) return [];

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

  // Find pattern matches for highlighting using matchAll
  const patternMatches = useMemo(() => {
    if (!highlightPattern || !content) return [];

    try {
      const regex = new RegExp(highlightPattern, 'gi');
      const matches: { start: number; end: number }[] = [];

      // Use matchAll instead of exec loop
      const allMatches = [...content.matchAll(regex)];
      for (const match of allMatches) {
        if (match.index !== undefined) {
          matches.push({ start: match.index, end: match.index + match[0].length });
        }
      }

      return matches;
    } catch {
      // Invalid regex, ignore
      return [];
    }
  }, [content, highlightPattern]);

  // Find position of scrollToText for auto-scroll
  const scrollToPosition = useMemo(() => {
    if (!scrollToText || !content) return null;

    const idx = content.indexOf(scrollToText);
    if (idx === -1) return null;

    return { start: idx, end: idx + scrollToText.length };
  }, [content, scrollToText]);

  // Reset match refs when matches change
  useEffect(() => {
    matchRefs.current = new Array(searchMatches.length).fill(null);
  }, [searchMatches.length]);

  // Auto-scroll to verbatim text on expand
  useEffect(() => {
    if (isExpanded && isVerbatim && scrollToPosition && !hasScrolledToTarget && targetTextRef.current) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(() => {
        targetTextRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        setHasScrolledToTarget(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, isVerbatim, scrollToPosition, hasScrolledToTarget]);

  // Scroll to current search match
  useEffect(() => {
    if (searchMatches.length > 0 && matchRefs.current[currentMatchIndex]) {
      matchRefs.current[currentMatchIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentMatchIndex, searchMatches.length]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentMatchIndex(0);
  }, []);

  const goToNextMatch = useCallback(() => {
    if (searchMatches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % searchMatches.length);
    }
  }, [searchMatches.length]);

  const goToPrevMatch = useCallback(() => {
    if (searchMatches.length > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
    }
  }, [searchMatches.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      setCurrentMatchIndex(0);
    }
  }, [goToNextMatch, goToPrevMatch]);

  // Render content with highlights
  // Priority: search > crossref > term > pattern > scrollTo
  const highlightedContent = useMemo(() => {
    if (!content) return null;

    // Collect all highlight regions
    type HighlightRegion = {
      start: number;
      end: number;
      type: 'search' | 'crossref' | 'term' | 'pattern' | 'scrollTo';
      isCurrentSearch?: boolean;
      data?: TermMatch | CrossRefMatch;
    };

    const regions: HighlightRegion[] = [];

    // Add search matches (highest priority when active)
    if (searchQuery.trim()) {
      searchMatches.forEach((match, idx) => {
        regions.push({
          ...match,
          type: 'search',
          isCurrentSearch: idx === currentMatchIndex,
        });
      });
    } else {
      // Only show other highlights when not searching
      // Add cross-ref matches (high priority)
      crossRefMatches.forEach((crossRef) => {
        regions.push({
          start: crossRef.startOffset,
          end: crossRef.endOffset,
          type: 'crossref',
          data: crossRef,
        });
      });

      // Add term matches (filtered to avoid overlap with cross-refs)
      termMatches.forEach((term) => {
        const overlapsWithCrossRef = crossRefMatches.some(
          (cr) => !(term.endOffset <= cr.startOffset || term.startOffset >= cr.endOffset)
        );
        if (!overlapsWithCrossRef) {
          regions.push({
            start: term.startOffset,
            end: term.endOffset,
            type: 'term',
            data: term,
          });
        }
      });

      // Add pattern matches
      patternMatches.forEach((match) => {
        regions.push({ ...match, type: 'pattern' });
      });

      // Add scrollTo text highlight (only if isVerbatim)
      if (isVerbatim && scrollToPosition) {
        // Check if this overlaps with other highlights
        const overlapsOther = [...crossRefMatches, ...termMatches].some(
          (m) => {
            const mStart = 'startOffset' in m ? m.startOffset : 0;
            const mEnd = 'endOffset' in m ? m.endOffset : 0;
            return !(scrollToPosition.end <= mStart || scrollToPosition.start >= mEnd);
          }
        ) || patternMatches.some(
          (p) => !(scrollToPosition.end <= p.start || scrollToPosition.start >= p.end)
        );
        if (!overlapsOther) {
          regions.push({ ...scrollToPosition, type: 'scrollTo' });
        }
      }
    }

    // Sort regions by start position
    regions.sort((a, b) => a.start - b.start);

    // Build highlighted content
    const parts: React.ReactNode[] = [];
    let lastEnd = 0;
    let searchMatchIdx = 0;

    regions.forEach((region, idx) => {
      // Skip if this region overlaps with previous (simple overlap handling)
      if (region.start < lastEnd) return;

      // Add text before this region
      if (region.start > lastEnd) {
        parts.push(content.substring(lastEnd, region.start));
      }

      // Determine styling and handlers based on type
      let className = '';
      let refCallback: ((el: HTMLSpanElement | null) => void) | undefined;
      let onClick: ((e: React.SyntheticEvent) => void) | undefined;

      if (region.type === 'search') {
        className = region.isCurrentSearch
          ? 'bg-[var(--color-warning)] text-[var(--color-text)] rounded px-0.5'
          : 'bg-yellow-200 text-[var(--color-text)] rounded px-0.5';
        const currentIdx = searchMatchIdx++;
        refCallback = (el) => { matchRefs.current[currentIdx] = el; };
      } else if (region.type === 'crossref') {
        className = 'crossref-highlight cursor-pointer';
        onClick = (e) => handleCrossRefClick(e, region.data as CrossRefMatch);
      } else if (region.type === 'term') {
        className = 'term-highlight cursor-pointer';
        onClick = (e) => handleTermClick(e, region.data as TermMatch);
      } else if (region.type === 'pattern') {
        className = 'bg-[var(--color-warning-bg)] text-[var(--color-text)] font-medium rounded px-0.5';
      } else if (region.type === 'scrollTo') {
        className = 'bg-[var(--color-primary-weaker)] text-[var(--color-text)] rounded px-0.5 border-l-2 border-[var(--color-primary)]';
        refCallback = (el) => { targetTextRef.current = el; };
      }

      parts.push(
        <span
          key={`region-${idx}`}
          ref={refCallback}
          className={className}
          onClick={onClick}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          onKeyDown={onClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick?.(e);
            }
          } : undefined}
        >
          {content.substring(region.start, region.end)}
        </span>
      );

      lastEnd = region.end;
    });

    // Add remaining text
    if (lastEnd < content.length) {
      parts.push(content.substring(lastEnd));
    }

    return parts;
  }, [
    content, searchQuery, searchMatches, currentMatchIndex,
    crossRefMatches, termMatches, patternMatches,
    scrollToPosition, isVerbatim,
    handleCrossRefClick, handleTermClick,
  ]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      // Reset scroll flag when opening
      setHasScrolledToTarget(false);
    }
  };

  if (!content) return null;

  return (
    <div className="mb-4 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
      {/* Expandable Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        {label}
        {isLoadingHighlights && (
          <Loader2 className="w-3 h-3 ml-1 animate-spin text-[var(--color-text-muted)]" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3">
          {/* Search Controls */}
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <div className="flex-1 max-w-xs">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="text-xs py-1 h-7"
                autoFocus={false}
              />
            </div>

            {searchQuery && (
              <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                <span>
                  {searchMatches.length > 0
                    ? `${currentMatchIndex + 1}/${searchMatches.length}`
                    : 'No matches'}
                </span>

                {searchMatches.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevMatch}
                      className="p-1 hover:bg-[var(--color-neutral-100)] rounded"
                      title="Previous match (Shift+Enter)"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={goToNextMatch}
                      className="p-1 hover:bg-[var(--color-neutral-100)] rounded"
                      title="Next match (Enter)"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentMatchIndex(0);
                  }}
                  className="p-1 hover:bg-[var(--color-neutral-100)] rounded"
                  title="Clear search"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Content Area */}
          <div
            ref={contentRef}
            className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-3 text-sm font-mono whitespace-pre-wrap overflow-y-auto"
            style={{ maxHeight }}
          >
            {highlightedContent}
          </div>
        </div>
      )}

      {/* Definition Popover */}
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

      {/* Cross-Reference Popover */}
      {selectedCrossRef && (
        <CrossRefPopover
          crossRef={selectedCrossRef.crossRef}
          anchorRect={selectedCrossRef.rect}
          onClose={handleCloseCrossRefPopover}
          state={state}
        />
      )}
    </div>
  );
}

export default RegulationTextViewer;
