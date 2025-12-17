'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { AnnotatableContent, NotesSidePanel } from '@/components/notes';
import type { DocumentNote } from '@deproceduralizer/database';

interface RegulationDetailClientProps {
  content: string;
  documentId: number;
  state: string;
  initialNotes: DocumentNote[];
}

export function RegulationDetailClient({
  content,
  documentId,
  state,
  initialNotes,
}: RegulationDetailClientProps) {
  const [notes, setNotes] = useState<DocumentNote[]>(initialNotes);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);

  const handleNoteCreated = (note: DocumentNote) => {
    setNotes((prev) => [...prev, note]);
    setActiveNoteId(note.id);
  };

  const handleNotesChange = (updatedNotes: DocumentNote[]) => {
    setNotes(updatedNotes);
  };

  const handleNoteActivate = (noteId: number | null) => {
    setActiveNoteId(noteId);
  };

  const handleNoteClick = (noteId: number) => {
    setActiveNoteId(noteId);
    // Could scroll to note in sidebar here if needed
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content area */}
      <div className="lg:col-span-2">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[var(--color-text)]">Full Regulation Text</h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              Select text to add annotations
            </span>
          </div>
          <div className="bg-[var(--color-neutral-50)] border-l-4 border-[var(--color-neutral-400)] p-4 rounded-[var(--radius-md)] text-sm font-mono max-h-[600px] overflow-y-auto">
            {content ? (
              <AnnotatableContent
                content={content}
                documentId={documentId}
                state={state}
                notes={notes}
                activeNoteId={activeNoteId}
                onNoteCreated={handleNoteCreated}
                onNoteClick={handleNoteClick}
              />
            ) : (
              <span className="text-[var(--color-text-muted)]">No content available</span>
            )}
          </div>
        </Card>
      </div>

      {/* Notes sidebar */}
      <div className="lg:col-span-1">
        <div className="sticky top-6">
          <NotesSidePanel
            documentId={documentId}
            state={state}
            notes={notes}
            activeNoteId={activeNoteId}
            onNotesChange={handleNotesChange}
            onNoteActivate={handleNoteActivate}
          />
        </div>
      </div>
    </div>
  );
}

export default RegulationDetailClient;
