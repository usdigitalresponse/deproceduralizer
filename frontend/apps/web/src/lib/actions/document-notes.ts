'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import {
  db,
  DocumentNotesRepository,
  type NoteType,
  type DocumentNote,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runAction } from './types';

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

/**
 * Creates a new note for a regulatory document.
 * @param input - The note data including document ID, type, content, and optional anchor info
 * @returns The created note
 */
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

    // Targeted invalidation: only regulation detail pages need updating after note changes
    revalidatePath(`/${input.state}/regulations`, 'page');
    return success(note);
  } catch (error) {
    console.error('[createNote]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Updates an existing note's content.
 * @param id - The note ID
 * @param content - The new note content
 * @param authorName - Optional author name to update
 * @returns The updated note or an error if not found
 */
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

    // Targeted invalidation: only regulation detail pages need updating after note changes
    revalidatePath('/[state]/regulations', 'page');
    return success(note);
  } catch (error) {
    console.error('[updateNote]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Deletes a note by its ID.
 * @param id - The note ID to delete
 * @returns True if deleted, or an error if not found
 */
export async function deleteNote(id: number): Promise<ActionResult<boolean>> {
  try {
    const deleted = await notesRepo.delete(id);

    if (!deleted) {
      return failure(`Note with id ${id} not found`);
    }

    // Targeted invalidation: only regulation detail pages need updating after note changes
    revalidatePath('/[state]/regulations', 'page');
    return success(deleted);
  } catch (error) {
    console.error('[deleteNote]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets all notes for a specific document.
 * @param documentId - The regulatory document ID
 * @returns Array of notes for the document
 */
export async function getNotesByDocumentId(
  documentId: number
): Promise<ActionResult<DocumentNote[]>> {
  return runAction('getNotesByDocumentId', () => notesRepo.getByDocumentId(documentId));
}

/**
 * Gets a single note by its ID.
 * @param id - The note ID
 * @returns The note or undefined if not found
 */
export async function getNoteById(
  id: number
): Promise<ActionResult<DocumentNote | undefined>> {
  return runAction('getNoteById', () => notesRepo.getById(id));
}
