'use client';

import { useState, useCallback, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import { ExternalLink, Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { CrossRefPopover } from '@/components/cross-references/CrossRefPopover';
import { useCrossRefHighlighting, type CrossRefMatch } from '@/hooks/useCrossRefHighlighting';
import type { HighlightRef } from '@deproceduralizer/database';
import type { GuidanceDocumentDetail } from '@/lib/actions/guidance-documents';

interface GuidanceDetailContentProps {
  doc: GuidanceDocumentDetail;
  state?: string;
  crossRefHighlights?: HighlightRef[];
}

export function GuidanceDetailContent({ doc, state, crossRefHighlights }: GuidanceDetailContentProps) {
  const crossRefMatches = useCrossRefHighlighting(crossRefHighlights);
  const [selectedCrossRef, setSelectedCrossRef] = useState<{
    crossRef: CrossRefMatch;
    rect: DOMRect;
  } | null>(null);

  const handleCrossRefClick = useCallback((crossRef: CrossRefMatch, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSelectedCrossRef({ crossRef, rect });
  }, []);

  const handleClosePopover = useCallback(() => {
    setSelectedCrossRef(null);
  }, []);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const lowerContent = useMemo(() => doc.content?.toLowerCase() ?? '', [doc.content]);

  const { searchMatches, matchIndexMap } = useMemo(() => {
    if (!deferredSearchQuery.trim() || !lowerContent) return { searchMatches: [] as number[], matchIndexMap: new Map<number, number>() };
    const query = deferredSearchQuery.toLowerCase();
    const positions: number[] = [];
    const indexMap = new Map<number, number>();
    let pos = 0;
    while (pos < lowerContent.length) {
      const idx = lowerContent.indexOf(query, pos);
      if (idx === -1) break;
      indexMap.set(idx, positions.length);
      positions.push(idx);
      pos = idx + 1;
    }
    return { searchMatches: positions, matchIndexMap: indexMap };
  }, [lowerContent, deferredSearchQuery]);

  useEffect(() => {
    if (searchMatches.length === 0 || !contentRef.current) return;
    const timer = setTimeout(() => {
      const highlights = contentRef.current?.querySelectorAll('.search-highlight');
      if (highlights && highlights[currentMatchIndex]) {
        highlights[currentMatchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentMatchIndex, searchMatches.length, deferredSearchQuery]);

  const goToNextMatch = useCallback(() => {
    if (searchMatches.length > 0) setCurrentMatchIndex((prev) => (prev + 1) % searchMatches.length);
  }, [searchMatches.length]);

  const goToPrevMatch = useCallback(() => {
    if (searchMatches.length > 0) setCurrentMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
  }, [searchMatches.length]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) goToPrevMatch(); else goToNextMatch();
    } else if (e.key === 'Escape') {
      setSearchQuery('');
    }
  }, [goToNextMatch, goToPrevMatch]);

  // Wrap plain text with search highlights
  function renderSearchHighlightedText(text: string, globalOffset: number, keyPrefix: string): React.ReactNode {
    if (!deferredSearchQuery.trim() || searchMatches.length === 0) return text;

    const query = deferredSearchQuery.toLowerCase();
    const queryLen = query.length;
    const textEnd = globalOffset + text.length;

    // Binary search for first match that could overlap this text range
    let lo = 0, hi = searchMatches.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (searchMatches[mid] + queryLen <= globalOffset) lo = mid + 1;
      else hi = mid;
    }
    const relevant: number[] = [];
    for (let i = lo; i < searchMatches.length && searchMatches[i] < textEnd; i++) {
      relevant.push(searchMatches[i]);
    }
    if (relevant.length === 0) return text;

    const parts: React.ReactNode[] = [];
    let pos = 0;

    for (const matchPos of relevant) {
      const relStart = Math.max(0, matchPos - globalOffset);
      const relEnd = Math.min(text.length, matchPos + queryLen - globalOffset);
      const matchIndex = matchIndexMap.get(matchPos) ?? 0;

      if (relStart > pos) parts.push(<span key={`${keyPrefix}-gap-${pos}`}>{text.slice(pos, relStart)}</span>);

      parts.push(
        <span
          key={`${keyPrefix}-search-${matchIndex}`}
          className={`search-highlight ${matchIndex === currentMatchIndex ? 'bg-[var(--color-warning)] text-[var(--color-text)]' : 'bg-yellow-200 text-[var(--color-text)]'} rounded px-0.5`}
        >
          {text.slice(relStart, relEnd)}
        </span>
      );
      pos = relEnd;
    }

    if (pos < text.length) parts.push(<span key={`${keyPrefix}-tail`}>{text.slice(pos)}</span>);
    return <>{parts}</>;
  }

  function renderHighlightedContent(content: string, matches: CrossRefMatch[]) {
    if (matches.length === 0) {
      return renderSearchHighlightedText(content, 0, 'root');
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const match of matches) {
      if (match.startOffset > content.length || match.endOffset > content.length) continue;
      if (match.startOffset < lastIndex) continue;

      if (match.startOffset > lastIndex) {
        parts.push(<span key={`gap-${lastIndex}`}>{renderSearchHighlightedText(content.slice(lastIndex, match.startOffset), lastIndex, `gap-${lastIndex}`)}</span>);
      }

      parts.push(
        <span
          key={match.id}
          className={`crossref-highlight ${match.isResolved ? 'crossref-highlight--resolved' : 'crossref-highlight--unresolved'}`}
          role="button"
          tabIndex={0}
          aria-label={`Cross-reference: ${match.rawText}`}
          onClick={(e) => handleCrossRefClick(match, e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCrossRefClick(match, e as unknown as React.MouseEvent);
            }
          }}
        >
          {renderSearchHighlightedText(content.slice(match.startOffset, match.endOffset), match.startOffset, `xref-${match.id}`)}
        </span>
      );

      lastIndex = match.endOffset;
    }

    if (lastIndex < content.length) {
      parts.push(<span key={`tail-${lastIndex}`}>{renderSearchHighlightedText(content.slice(lastIndex), lastIndex, 'tail')}</span>);
    }

    return parts;
  }

  return (
    <Card padding="lg">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <CardTitle>Document Content</CardTitle>
          {doc.url && (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-strong)]"
            >
              View Original
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </CardHeader>
      <div className="pt-4">
        {/* Search Bar */}
        {doc.content && (
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <div className="flex-1 max-w-xs">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentMatchIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search in document..."
                className="text-sm py-1.5"
              />
            </div>

            {searchQuery && (
              <div className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
                <span>
                  {searchMatches.length > 0
                    ? `${currentMatchIndex + 1}/${searchMatches.length}`
                    : 'No matches'}
                </span>

                {searchMatches.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevMatch}
                      className="p-1.5 hover:bg-[var(--color-neutral-100)] rounded"
                      title="Previous match (Shift+Enter)"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={goToNextMatch}
                      className="p-1.5 hover:bg-[var(--color-neutral-100)] rounded"
                      title="Next match (Enter)"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentMatchIndex(0);
                  }}
                  className="p-1.5 hover:bg-[var(--color-neutral-100)] rounded"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {doc.content ? (
          <div
            ref={contentRef}
            className="bg-[var(--color-neutral-50)] border-l-4 border-[var(--color-neutral-400)] p-4 rounded-[var(--radius-md)] text-sm leading-relaxed whitespace-pre-wrap break-words max-h-[600px] overflow-y-auto"
          >
            {renderHighlightedContent(doc.content, crossRefMatches)}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] italic">
            No content available for this document.
            {doc.url && ' Use the "View Original" link above to access the source document.'}
          </p>
        )}
      </div>

      {selectedCrossRef && state && (
        <CrossRefPopover
          crossRef={selectedCrossRef.crossRef}
          anchorRect={selectedCrossRef.rect}
          onClose={handleClosePopover}
          state={state}
        />
      )}
    </Card>
  );
}
