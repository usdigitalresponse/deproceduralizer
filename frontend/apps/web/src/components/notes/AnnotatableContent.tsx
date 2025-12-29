'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquareQuote, X } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { useReviewerName, useTermHighlighting, type TermMatch, type CrossRefMatch } from '@/hooks';
import { DefinitionPopover } from '@/components/definitions';
import { CrossRefPopover } from '@/components/cross-references';
import { createNote } from '@/lib/actions/document-notes';
import type { DocumentNote, ApplicableDefinition } from '@deproceduralizer/database';

interface SelectionInfo {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: DOMRect;
}

interface AnnotatableContentProps {
  content: string;
  documentId: number;
  state: string;
  notes: DocumentNote[];
  activeNoteId?: number | null;
  onNoteCreated: (note: DocumentNote) => void;
  onNoteClick: (noteId: number) => void;
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
  type: 'note' | 'crossref' | 'term' | 'search';
  startOffset: number;
  endOffset: number;
  data: DocumentNote | CrossRefMatch | TermMatch | { matchIndex: number };
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
  notes,
  activeNoteId,
  onNoteCreated,
  onNoteClick,
  applicableDefinitions,
  crossRefHighlights,
  searchQuery = '',
  currentMatchIndex = 0,
}: AnnotatableContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<SelectedTermState | null>(null);
  const [selectedCrossRef, setSelectedCrossRef] = useState<SelectedCrossRefState | null>(null);

  const { reviewerName: storedName, saveReviewerName, isLoaded } = useReviewerName();

  // Get term matches from applicable definitions
  const termMatches = useTermHighlighting(content, applicableDefinitions);

  // Pre-fill author name from localStorage
  useEffect(() => {
    if (isLoaded && storedName && !authorName) {
      setAuthorName(storedName);
    }
  }, [isLoaded, storedName, authorName]);

  // Filter to only anchored notes with valid offsets
  const anchoredNotes = notes.filter(
    (n) =>
      n.noteType === 'anchored' &&
      n.anchorStartOffset !== null &&
      n.anchorEndOffset !== null
  );

  const handleMouseUp = useCallback(() => {
    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed || !containerRef.current) {
      return;
    }

    const range = windowSelection.getRangeAt(0);

    // Check if selection is within our container
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    const selectedText = windowSelection.toString().trim();
    if (!selectedText) {
      return;
    }

    // Calculate character offsets relative to the content
    try {
      const preSelectionRange = document.createRange();
      preSelectionRange.selectNodeContents(containerRef.current);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
      const startOffset = preSelectionRange.toString().length;
      const endOffset = startOffset + selectedText.length;

      // Get position for popover
      const rect = range.getBoundingClientRect();

      setSelection({
        text: selectedText,
        startOffset,
        endOffset,
        rect,
      });
      setShowPopover(true);
    } catch {
      // Selection calculation failed, ignore
    }
  }, []);

  const handleClosePopover = useCallback(() => {
    setShowPopover(false);
    setSelection(null);
    setNoteContent('');
    setError(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleCreateNote = async () => {
    if (!selection) return;
    if (!noteContent.trim()) {
      setError('Note content is required');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await createNote({
        documentId,
        noteType: 'anchored',
        content: noteContent.trim(),
        authorName: authorName.trim() || undefined,
        state,
        anchorStartOffset: selection.startOffset,
        anchorEndOffset: selection.endOffset,
        anchorText: selection.text,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Save author name for next time
      if (authorName.trim()) {
        saveReviewerName(authorName.trim());
      }

      onNoteCreated(result.data);
      handleClosePopover();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (showPopover && !target.closest('.annotation-popover')) {
        handleClosePopover();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover, handleClosePopover]);

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

  // Merge note regions, cross-ref regions, term regions, and search matches
  // Priority: notes > cross-refs > terms
  const mergeHighlightRegions = useCallback((): HighlightRegion[] => {
    const regions: HighlightRegion[] = [];

    // Add note regions (highest priority)
    for (const note of anchoredNotes) {
      if (note.anchorStartOffset !== null && note.anchorEndOffset !== null) {
        regions.push({
          type: 'note',
          startOffset: note.anchorStartOffset,
          endOffset: note.anchorEndOffset,
          data: note,
        });
      }
    }

    // Add cross-ref regions (filter out those overlapping with notes)
    if (crossRefHighlights) {
      for (const crossRef of crossRefHighlights) {
        const overlapsNote = regions.some(
          (r) =>
            r.type === 'note' &&
            crossRef.startOffset < r.endOffset &&
            crossRef.endOffset > r.startOffset
        );

        if (!overlapsNote) {
          regions.push({
            type: 'crossref',
            startOffset: crossRef.startOffset,
            endOffset: crossRef.endOffset,
            data: crossRef,
          });
        }
      }
    }

    // Add term regions (filter out those overlapping with notes or cross-refs)
    for (const match of termMatches) {
      const overlapsHigherPriority = regions.some(
        (r) =>
          (r.type === 'note' || r.type === 'crossref') &&
          match.startOffset < r.endOffset &&
          match.endOffset > r.startOffset
      );

      if (!overlapsHigherPriority) {
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
  }, [anchoredNotes, crossRefHighlights, termMatches, searchMatches]);

  // Render content with note, term, and search highlights
  const renderContentWithHighlights = () => {
    // Get regions but separate search from others
    const noteTermRegions: HighlightRegion[] = [];
    const searchRegions: HighlightRegion[] = [];

    for (const region of mergeHighlightRegions()) {
      if (region.type === 'search') {
        searchRegions.push(region);
      } else {
        noteTermRegions.push(region);
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

    if (noteTermRegions.length === 0) {
      // Only search highlights (or no highlights at all)
      return <span>{wrapWithSearchHighlight(content, 0, 'root')}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    noteTermRegions.forEach((region, idx) => {
      // Add text before this region
      if (region.startOffset > lastIndex) {
        const beforeText = content.slice(lastIndex, region.startOffset);
        parts.push(
          <span key={`text-${idx}`}>{wrapWithSearchHighlight(beforeText, lastIndex, `text-${idx}`)}</span>
        );
      }

      const text = content.slice(region.startOffset, region.endOffset);

      if (region.type === 'note') {
        // Note highlight (yellow background)
        const note = region.data as DocumentNote;
        const isActive = activeNoteId === note.id;
        parts.push(
          <mark
            key={`mark-${note.id}`}
            onClick={(e) => {
              e.preventDefault();
              onNoteClick(note.id);
            }}
            className={`
              cursor-pointer transition-colors
              ${isActive
                ? 'bg-[var(--color-accent)] text-[var(--color-text)]'
                : 'bg-[var(--color-accent-muted)] hover:bg-[var(--color-accent)]'
              }
            `}
            title={`Note: ${note.content.substring(0, 50)}...`}
          >
            {wrapWithSearchHighlight(text, region.startOffset, `mark-${note.id}`)}
          </mark>
        );
      } else if (region.type === 'crossref') {
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
        onMouseUp={handleMouseUp}
        className="whitespace-pre-wrap text-[var(--color-text)]"
      >
        {renderContentWithHighlights()}
      </div>

      {/* Selection popover */}
      {showPopover && selection && typeof window !== 'undefined' &&
        createPortal(
          <div
            className="annotation-popover fixed z-50 bg-white rounded-[var(--radius-md)] shadow-lg border border-[var(--color-neutral-200)] p-3 w-72"
            style={{
              top: selection.rect.bottom + 8,
              left: Math.min(selection.rect.left, window.innerWidth - 300),
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span className="text-sm font-medium text-[var(--color-text)]">
                  Add Annotation
                </span>
              </div>
              <button
                onClick={handleClosePopover}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected text preview */}
            <div className="mb-3 px-2 py-1.5 bg-[var(--color-accent-muted)] rounded border-l-2 border-[var(--color-accent)]">
              <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 italic">
                &quot;{selection.text}&quot;
              </p>
            </div>

            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write your note..."
              rows={2}
              autoFocus
              disabled={isSubmitting}
            />
            <div className="mt-2">
              <Input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name (optional)"
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClosePopover}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateNote}
                isLoading={isSubmitting}
              >
                Add
              </Button>
            </div>
          </div>,
          document.body
        )}

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
