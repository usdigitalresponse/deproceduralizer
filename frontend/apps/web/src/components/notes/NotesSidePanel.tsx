'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, X } from 'lucide-react';
import { Button, Card, Input, Textarea } from '@/components/ui';
import { useReviewerName } from '@/hooks/useReviewerName';
import { createNote } from '@/lib/actions/document-notes';
import { NoteCard } from './NoteCard';
import type { DocumentNote } from '@deproceduralizer/database';

interface NotesSidePanelProps {
  documentId: number;
  state: string;
  notes: DocumentNote[];
  onNotesChange: (notes: DocumentNote[]) => void;
}

export function NotesSidePanel({
  documentId,
  state,
  notes,
  onNotesChange,
}: NotesSidePanelProps) {
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
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

  // Only show document-level notes
  const documentNotes = notes.filter((n) => n.noteType === 'document');

  const handleAddDocumentNote = async () => {
    if (!newNoteContent.trim()) {
      setError('Note content is required');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await createNote({
        documentId,
        noteType: 'document',
        content: newNoteContent.trim(),
        authorName: authorName.trim() || undefined,
        jurisdiction: state,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Save author name for next time
      if (authorName.trim()) {
        saveReviewerName(authorName.trim());
      }

      onNotesChange([...notes, result.data]);
      setNewNoteContent('');
      setIsAddingNote(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNote = (updatedNote: DocumentNote) => {
    onNotesChange(notes.map((n) => (n.id === updatedNote.id ? updatedNote : n)));
  };

  const handleDeleteNote = (noteId: number) => {
    onNotesChange(notes.filter((n) => n.id !== noteId));
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden" padding="none">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-neutral-200)] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[var(--color-text-secondary)]" />
            <h3 className="font-semibold text-[var(--color-text)]">
              Notes ({documentNotes.length})
            </h3>
          </div>
          {!isAddingNote && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingNote(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Note
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Add note form */}
        {isAddingNote && (
          <div className="p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                New Note
              </span>
              <button
                onClick={() => {
                  setIsAddingNote(false);
                  setNewNoteContent('');
                  setError(null);
                }}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write your note..."
              rows={3}
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
            <div className="mt-3 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddDocumentNote}
                isLoading={isSubmitting}
              >
                {isSubmitting ? 'Adding...' : 'Add Note'}
              </Button>
            </div>
          </div>
        )}

        {/* Notes list */}
        {documentNotes.length > 0 && (
          <div className="space-y-2">
            {documentNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {documentNotes.length === 0 && !isAddingNote && (
          <div className="text-center py-8">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-[var(--color-neutral-300)]" />
            <p className="text-sm text-[var(--color-text-muted)]">
              No notes yet
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Click &quot;Add Note&quot; to add notes about this section
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default NotesSidePanel;
