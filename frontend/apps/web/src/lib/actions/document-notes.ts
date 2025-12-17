'use server';

import { revalidatePath } from 'next/cache';
import {
  db,
  DocumentNotesRepository,
  type NoteType,
  type DocumentNote,
} from '@deproceduralizer/database';

const notesRepo = new DocumentNotesRepository(db);

export interface CreateNoteInput {
  documentId: number;
  noteType: NoteType;
  content: string;
  authorName?: string;
  state: string;
  anchorStartOffset?: number;
  anchorEndOffset?: number;
  anchorText?: string;
}

export async function createNote(input: CreateNoteInput): Promise<DocumentNote> {
  const note = await notesRepo.create({
    documentId: input.documentId,
    noteType: input.noteType,
    content: input.content,
    authorName: input.authorName,
    state: input.state,
    anchorStartOffset: input.anchorStartOffset,
    anchorEndOffset: input.anchorEndOffset,
    anchorText: input.anchorText,
  });

  revalidatePath('/');
  return note;
}

export async function updateNote(
  id: number,
  content: string,
  authorName?: string
): Promise<DocumentNote | undefined> {
  const note = await notesRepo.update(id, {
    content,
    authorName,
  });

  if (!note) {
    throw new Error(`Note with id ${id} not found`);
  }

  revalidatePath('/');
  return note;
}

export async function deleteNote(id: number): Promise<boolean> {
  const deleted = await notesRepo.delete(id);

  if (!deleted) {
    throw new Error(`Note with id ${id} not found`);
  }

  revalidatePath('/');
  return deleted;
}

export async function getNotesByDocumentId(documentId: number): Promise<DocumentNote[]> {
  return notesRepo.getByDocumentId(documentId);
}

export async function getNoteById(id: number): Promise<DocumentNote | undefined> {
  return notesRepo.getById(id);
}
