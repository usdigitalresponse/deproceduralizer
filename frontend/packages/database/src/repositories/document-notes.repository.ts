import { eq, asc } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { documentNotes, DocumentNote, NewDocumentNote, NoteType } from '../schema/document-notes';
import { normalizeState } from '../schema/constants';

export interface CreateDocumentNoteInput {
  documentId: number;
  noteType: NoteType;
  content: string;
  authorName?: string;
  state: string;
  anchorStartOffset?: number;
  anchorEndOffset?: number;
  anchorText?: string;
}

export interface UpdateDocumentNoteInput {
  content?: string;
  authorName?: string;
}

export class DocumentNotesRepository extends BaseRepository {
  async create(input: CreateDocumentNoteInput): Promise<DocumentNote> {
    const [note] = await this.db
      .insert(documentNotes)
      .values({
        documentId: input.documentId,
        noteType: input.noteType,
        content: input.content,
        authorName: input.authorName ?? null,
        state: normalizeState(input.state),
        anchorStartOffset: input.anchorStartOffset ?? null,
        anchorEndOffset: input.anchorEndOffset ?? null,
        anchorText: input.anchorText ?? null,
      })
      .returning();

    return note;
  }

  async getById(id: number): Promise<DocumentNote | undefined> {
    const [note] = await this.db
      .select()
      .from(documentNotes)
      .where(eq(documentNotes.id, id))
      .limit(1);

    return note;
  }

  async getByDocumentId(documentId: number): Promise<DocumentNote[]> {
    return this.db
      .select()
      .from(documentNotes)
      .where(eq(documentNotes.documentId, documentId))
      .orderBy(
        // Sort anchored notes by offset, document notes by creation time
        asc(documentNotes.anchorStartOffset),
        asc(documentNotes.createdAt)
      );
  }

  async update(id: number, data: UpdateDocumentNoteInput): Promise<DocumentNote | undefined> {
    const updateData: Partial<NewDocumentNote> = {
      updatedAt: new Date(),
    };

    if (data.content !== undefined) {
      updateData.content = data.content;
    }
    if (data.authorName !== undefined) {
      updateData.authorName = data.authorName;
    }

    const [note] = await this.db
      .update(documentNotes)
      .set(updateData)
      .where(eq(documentNotes.id, id))
      .returning();

    return note;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(documentNotes)
      .where(eq(documentNotes.id, id))
      .returning({ id: documentNotes.id });

    return result.length > 0;
  }

  async getCountByDocumentId(documentId: number): Promise<number> {
    const notes = await this.db
      .select({ id: documentNotes.id })
      .from(documentNotes)
      .where(eq(documentNotes.documentId, documentId));

    return notes.length;
  }
}
