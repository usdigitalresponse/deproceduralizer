'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquareQuote, X } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { useReviewerName } from '@/hooks/useReviewerName';
import { createNote } from '@/lib/actions/document-notes';
import type { DocumentNote } from '@deproceduralizer/database';

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
}

export function AnnotatableContent({
  content,
  documentId,
  state,
  notes,
  activeNoteId,
  onNoteCreated,
  onNoteClick,
}: AnnotatableContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { reviewerName: storedName, saveReviewerName, isLoaded } = useReviewerName();

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

  // Render content with highlights
  const renderContentWithHighlights = () => {
    if (anchoredNotes.length === 0) {
      return <span>{content}</span>;
    }

    // Sort notes by start offset
    const sortedNotes = [...anchoredNotes].sort(
      (a, b) => (a.anchorStartOffset ?? 0) - (b.anchorStartOffset ?? 0)
    );

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedNotes.forEach((note, idx) => {
      const start = note.anchorStartOffset ?? 0;
      const end = note.anchorEndOffset ?? 0;

      // Add text before this highlight
      if (start > lastIndex) {
        parts.push(
          <span key={`text-${idx}`}>{content.slice(lastIndex, start)}</span>
        );
      }

      // Add highlighted text
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
          {content.slice(start, end)}
        </mark>
      );

      lastIndex = end;
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
    </>
  );
}

export default AnnotatableContent;
