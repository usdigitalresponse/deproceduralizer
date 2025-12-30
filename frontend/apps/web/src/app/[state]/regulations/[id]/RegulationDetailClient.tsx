'use client';

import { useState, useRef, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AnnotatableContent, NotesSidePanel } from '@/components/notes';
import { useCrossRefHighlighting } from '@/hooks';
import type { DocumentNote, ApplicableDefinition, HighlightRef } from '@deproceduralizer/database';

interface RegulationDetailClientProps {
  content: string;
  documentId: number;
  state: string;
  initialNotes: DocumentNote[];
  /** Applicable definitions for term highlighting */
  applicableDefinitions?: ApplicableDefinition[];
  /** Cross-references for inline highlighting */
  crossRefHighlights?: HighlightRef[];
}

export function RegulationDetailClient({
  content,
  documentId,
  state,
  initialNotes,
  applicableDefinitions,
  crossRefHighlights,
}: RegulationDetailClientProps) {
  const [notes, setNotes] = useState<DocumentNote[]>(initialNotes);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Debounce search query using useDeferredValue for smoother typing
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Process cross-reference data for highlighting
  const crossRefMatches = useCrossRefHighlighting(crossRefHighlights);

  // Cache lowercase content (only recalculates when content changes, not on every query change)
  const lowerContent = useMemo(() => content?.toLowerCase() ?? '', [content]);

  // Find all matches in content using cached lowercase and deferred query
  const matches = useMemo(() => {
    if (!deferredSearchQuery.trim() || !lowerContent) return [];

    const query = deferredSearchQuery.toLowerCase();
    const matchPositions: number[] = [];
    let pos = 0;

    while (pos < lowerContent.length) {
      const idx = lowerContent.indexOf(query, pos);
      if (idx === -1) break;
      matchPositions.push(idx);
      pos = idx + 1;
    }

    return matchPositions;
  }, [lowerContent, deferredSearchQuery]);

  // Scroll to current match using CSS Highlight API or fallback
  useEffect(() => {
    if (matches.length === 0 || !contentRef.current) return;

    // Use a small delay to let the DOM settle after content renders
    const timer = setTimeout(() => {
      const highlights = contentRef.current?.querySelectorAll('.search-highlight');
      if (highlights && highlights[currentMatchIndex]) {
        highlights[currentMatchIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentMatchIndex, matches.length, deferredSearchQuery]);

  const goToNextMatch = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    }
  }, [matches.length]);

  const goToPrevMatch = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  }, [matches.length]);

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
    }
  }, [goToNextMatch, goToPrevMatch]);

  const handleNotesChange = (updatedNotes: DocumentNote[]) => {
    setNotes(updatedNotes);
  };

  return (
    <div className="space-y-4">
      {/* Notes panel - stacked above regulation text */}
      <NotesSidePanel
        documentId={documentId}
        state={state}
        notes={notes}
        onNotesChange={handleNotesChange}
      />

      {/* Regulation text area */}
      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-[var(--color-text)]">Full Regulation Text</h2>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex-1 max-w-xs">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentMatchIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search in regulation text..."
              className="text-sm py-1.5"
            />
          </div>

          {searchQuery && (
            <div className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
              <span>
                {matches.length > 0
                  ? `${currentMatchIndex + 1}/${matches.length}`
                  : 'No matches'}
              </span>

              {matches.length > 1 && (
                <>
                  <button
                    onClick={goToPrevMatch}
                    className="p-1.5 hover:bg-[var(--color-neutral-100)] rounded"
                    title="Previous match (Shift+Enter)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={goToNextMatch}
                    className="p-1.5 hover:bg-[var(--color-neutral-100)] rounded"
                    title="Next match (Enter)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="p-1.5 hover:bg-[var(--color-neutral-100)] rounded"
                title="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div
          ref={contentRef}
          className="bg-[var(--color-neutral-50)] border-l-4 border-[var(--color-neutral-400)] p-4 rounded-[var(--radius-md)] text-sm font-mono max-h-[600px] overflow-y-auto"
        >
          {content ? (
            <AnnotatableContent
              content={content}
              documentId={documentId}
              state={state}
              applicableDefinitions={applicableDefinitions}
              crossRefHighlights={crossRefMatches}
              searchQuery={searchQuery}
              currentMatchIndex={currentMatchIndex}
            />
          ) : (
            <span className="text-[var(--color-text-muted)]">No content available</span>
          )}
        </div>
      </Card>
    </div>
  );
}

export default RegulationDetailClient;
