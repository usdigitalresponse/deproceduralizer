'use server';

import { revalidatePath } from 'next/cache';
import {
  db,
  DocumentNotesRepository,
  type NoteType,
  type DocumentNote,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

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

export async function createNote(
  input: CreateNoteInput
): Promise<ActionResult<DocumentNote>> {
  try {
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
    return success(note);
  } catch (error) {
    console.error('[createNote]', error);
    return failure(getErrorMessage(error));
  }
}

export async function updateNote(
  id: number,
  content: string,
  authorName?: string
): Promise<ActionResult<DocumentNote>> {
  try {
    const note = await notesRepo.update(id, {
      content,
      authorName,
    });

    if (!note) {
      return failure(`Note with id ${id} not found`);
    }

    revalidatePath('/');
    return success(note);
  } catch (error) {
    console.error('[updateNote]', error);
    return failure(getErrorMessage(error));
  }
}

export async function deleteNote(id: number): Promise<ActionResult<boolean>> {
  try {
    const deleted = await notesRepo.delete(id);

    if (!deleted) {
      return failure(`Note with id ${id} not found`);
    }

    revalidatePath('/');
    return success(deleted);
  } catch (error) {
    console.error('[deleteNote]', error);
    return failure(getErrorMessage(error));
  }
}

export async function getNotesByDocumentId(
  documentId: number
): Promise<ActionResult<DocumentNote[]>> {
  try {
    const result = await notesRepo.getByDocumentId(documentId);
    return success(result);
  } catch (error) {
    console.error('[getNotesByDocumentId]', error);
    return failure(getErrorMessage(error));
  }
}

export async function getNoteById(
  id: number
): Promise<ActionResult<DocumentNote | undefined>> {
  try {
    const result = await notesRepo.getById(id);
    return success(result);
  } catch (error) {
    console.error('[getNoteById]', error);
    return failure(getErrorMessage(error));
  }
}
