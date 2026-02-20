'use client';

import { useState, useCallback } from 'react';
import { Edit2, Check, X } from 'lucide-react';

interface BookmarkNotesEditorProps {
  notes: string | null;
  onSave: (notes: string) => Promise<void>;
  compact?: boolean;
}

export function BookmarkNotesEditor({ notes, onSave, compact = false }: BookmarkNotesEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');

  const handleEdit = useCallback(() => {
    setEditingText(notes || '');
    setIsEditing(true);
  }, [notes]);

  const handleSave = useCallback(async () => {
    await onSave(editingText);
    setIsEditing(false);
    setEditingText('');
  }, [editingText, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditingText('');
  }, []);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          className={`flex-1 text-sm border border-[var(--color-neutral-300)] ${
            compact ? 'px-2 py-1 rounded' : 'px-3 py-2 rounded-[var(--radius-sm)]'
          }`}
          placeholder={compact ? 'Add notes...' : 'Add notes about this bookmark...'}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <button
          onClick={handleSave}
          className={`${compact ? 'p-1' : 'p-2'} text-[var(--color-success)] hover:bg-[var(--color-success-bg)] rounded`}
          aria-label="Save notes"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className={`${compact ? 'p-1' : 'p-2'} text-[var(--color-text-muted)] hover:bg-[var(--color-neutral-100)] rounded`}
          aria-label="Cancel edit"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? 'group' : ''}`}>
      <span className={`text-sm text-[var(--color-text-muted)] ${compact ? 'truncate max-w-[200px]' : ''}`}>
        {notes ? notes : (compact ? '-' : <span className="italic">No notes</span>)}
      </span>
      <button
        onClick={handleEdit}
        className={`p-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-neutral-100)] rounded ${
          compact ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''
        }`}
        aria-label="Edit notes"
      >
        <Edit2 className="w-3 h-3" />
      </button>
    </div>
  );
}
