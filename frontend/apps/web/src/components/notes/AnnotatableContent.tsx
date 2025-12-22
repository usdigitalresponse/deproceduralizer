'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquareQuote, X } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { useReviewerName, useTermHighlighting, type TermMatch } from '@/hooks';
import { DefinitionPopover } from '@/components/definitions';
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
}

/** Represents a highlighted region in the content */
interface HighlightRegion {
  type: 'note' | 'term';
  startOffset: number;
  endOffset: number;
  data: DocumentNote | TermMatch;
}

/** State for the selected term popover */
interface SelectedTermState {
  termMatch: TermMatch;
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
}: AnnotatableContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<SelectedTermState | null>(null);

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

  // Handle term click - scroll to local definitions, show popover for external
  const handleTermClick = useCallback((e: React.MouseEvent, termMatch: TermMatch) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if this is a local definition (defined in current document)
    // Use documentId field directly since local definitions may not have regulation object populated
    const isLocalDefinition = termMatch.definition.documentId === documentId;

    if (isLocalDefinition) {
      // Scroll to the definition on this page
      const definitionElement = document.getElementById(`definition-${termMatch.definition.id}`);
      if (definitionElement) {
        definitionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Brief highlight effect
        definitionElement.classList.add('ring-2', 'ring-[var(--color-info)]');
        setTimeout(() => {
          definitionElement.classList.remove('ring-2', 'ring-[var(--color-info)]');
        }, 2000);
        return;
      }
    }

    // For external definitions, show popover
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setSelectedTerm({ termMatch, rect });
  }, [documentId]);

  // Close term popover
  const handleCloseTermPopover = useCallback(() => {
    setSelectedTerm(null);
  }, []);

  // Merge note regions and term regions, with notes taking priority
  const mergeHighlightRegions = useCallback((): HighlightRegion[] => {
    const regions: HighlightRegion[] = [];

    // Add note regions
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

    // Add term regions (filter out those overlapping with notes)
    for (const match of termMatches) {
      const overlapsNote = regions.some(
        (r) =>
          r.type === 'note' &&
          match.startOffset < r.endOffset &&
          match.endOffset > r.startOffset
      );

      if (!overlapsNote) {
        regions.push({
          type: 'term',
          startOffset: match.startOffset,
          endOffset: match.endOffset,
          data: match,
        });
      }
    }

    // Sort by start offset
    return regions.sort((a, b) => a.startOffset - b.startOffset);
  }, [anchoredNotes, termMatches]);

  // Render content with both note and term highlights
  const renderContentWithHighlights = () => {
    const regions = mergeHighlightRegions();

    if (regions.length === 0) {
      return <span>{content}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    regions.forEach((region, idx) => {
      // Add text before this region
      if (region.startOffset > lastIndex) {
        parts.push(
          <span key={`text-${idx}`}>{content.slice(lastIndex, region.startOffset)}</span>
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
            {text}
          </mark>
        );
      } else {
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
                // Simulate click event for keyboard accessibility
                handleTermClick(e as unknown as React.MouseEvent, termMatch);
              }
            }}
            title={`Defined term: ${termMatch.term}`}
          >
            {text}
          </span>
        );
      }

      lastIndex = region.endOffset;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key="text-end">{content.slice(lastIndex)}</span>
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
        />
      )}
    </>
  );
}

export default AnnotatableContent;
