'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, MessageSquare, Quote, Check, X } from 'lucide-react';
import { Button, Textarea } from '@/components/ui';
import { updateNote, deleteNote } from '@/lib/actions/document-notes';
import type { DocumentNote } from '@deproceduralizer/database';

interface NoteCardProps {
  note: DocumentNote;
  isActive?: boolean;
  onUpdate: (updatedNote: DocumentNote) => void;
  onDelete: (noteId: number) => void;
  onActivate?: () => void;
}

export function NoteCard({
  note,
  isActive = false,
  onUpdate,
  onDelete,
  onActivate,
}: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editContent.trim()) {
      setError('Note content is required');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await updateNote(note.id, editContent.trim(), note.authorName || undefined);
        if (!result.success) {
          setError(result.error);
          return;
        }
        if (result.data) {
          onUpdate(result.data);
          setIsEditing(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update note');
      }
    });
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    startTransition(async () => {
      try {
        const result = await deleteNote(note.id);
        if (!result.success) {
          setError(result.error);
          return;
        }
        onDelete(note.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete note');
      }
    });
  };

  const handleCancel = () => {
    setEditContent(note.content);
    setIsEditing(false);
    setError(null);
  };

  const formattedDate = note.createdAt
    ? new Date(note.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      onClick={onActivate}
      className={`
        p-3 rounded-[var(--radius-md)] border transition-all duration-[var(--duration-fast)] cursor-pointer
        ${isActive
          ? 'bg-[var(--color-accent-muted)] border-[var(--color-accent)]'
          : 'bg-[var(--color-neutral-50)] border-[var(--color-neutral-200)] hover:border-[var(--color-neutral-300)]'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {note.noteType === 'anchored' ? (
            <Quote className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          )}
          <span className="text-xs text-[var(--color-text-muted)]">
            {note.noteType === 'anchored' ? 'Text Note' : 'Document Note'}
          </span>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded transition-colors"
              aria-label="Edit note"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] rounded transition-colors"
              aria-label="Delete note"
              disabled={isPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Anchor text preview (for anchored notes) */}
      {note.noteType === 'anchored' && note.anchorText && (
        <div className="mb-2 px-2 py-1.5 bg-[var(--color-accent-muted)] rounded border-l-2 border-[var(--color-accent)]">
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 italic">
            &quot;{note.anchorText}&quot;
          </p>
        </div>
      )}

      {/* Content */}
      {isEditing ? (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            autoFocus
            disabled={isPending}
          />
          {error && (
            <p className="text-xs text-[var(--color-danger)]">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              isLoading={isPending}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text)]">{note.content}</p>
      )}

      {/* Footer */}
      {!isEditing && (
        <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>{note.authorName || 'Anonymous'}</span>
          <span>{formattedDate}</span>
        </div>
      )}
    </div>
  );
}

export default NoteCard;
