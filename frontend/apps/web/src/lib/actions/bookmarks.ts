'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import {
  db,
  BookmarksRepository,
  complianceIssueAnalyses,
  type Bookmark,
  type BookmarkWithDetails,
  eq,
  and,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const bookmarksRepo = new BookmarksRepository(db);

/**
 * Toggle bookmark for an analysis.
 * If bookmarked, removes it. If not, creates one.
 * @returns The created bookmark, or null if removed
 */
export async function toggleAnalysisBookmark(
  analysisId: number,
  notes?: string,
  createdBy?: string
): Promise<ActionResult<Bookmark | null>> {
  try {
    // Check if already bookmarked
    const existing = await bookmarksRepo.getByAnalysisId(analysisId);

    if (existing) {
      // Remove bookmark
      await bookmarksRepo.delete(existing.id);
      revalidatePath('/[state]/pipeline', 'page');
      revalidatePath('/[state]/bookmarks', 'page');
      return success(null);
    }

    // Get analysis details to populate bookmark
    const [analysis] = await db
      .select({
        documentId: complianceIssueAnalyses.documentId,
        issueType: complianceIssueAnalyses.issueType,
        state: complianceIssueAnalyses.state,
      })
      .from(complianceIssueAnalyses)
      .where(eq(complianceIssueAnalyses.id, analysisId))
      .limit(1);

    if (!analysis) {
      return failure(`Analysis with id ${analysisId} not found`);
    }

    // Create bookmark
    const bookmark = await bookmarksRepo.create({
      documentId: analysis.documentId,
      analysisId,
      issueType: analysis.issueType,
      state: analysis.state,
      notes,
      createdBy,
    });

    revalidatePath('/[state]/pipeline', 'page');
    revalidatePath('/[state]/bookmarks', 'page');
    return success(bookmark);
  } catch (error) {
    console.error('[toggleAnalysisBookmark]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Toggle bookmark for a document (document-level, no analysis).
 * If bookmarked, removes it. If not, creates one.
 * @returns The created bookmark, or null if removed
 */
export async function toggleDocumentBookmark(
  documentId: number,
  state: string,
  notes?: string,
  createdBy?: string
): Promise<ActionResult<Bookmark | null>> {
  try {
    // Check if already bookmarked
    const existing = await bookmarksRepo.getDocumentBookmark(documentId);

    if (existing) {
      // Remove bookmark
      await bookmarksRepo.delete(existing.id);
      revalidatePath('/[state]/regulations', 'page');
      revalidatePath('/[state]/bookmarks', 'page');
      return success(null);
    }

    // Create bookmark
    const bookmark = await bookmarksRepo.create({
      documentId,
      state,
      notes,
      createdBy,
    });

    revalidatePath('/[state]/regulations', 'page');
    revalidatePath('/[state]/bookmarks', 'page');
    return success(bookmark);
  } catch (error) {
    console.error('[toggleDocumentBookmark]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get all bookmarks for a state with document/analysis details.
 */
export async function getBookmarks(
  state: string,
  type?: 'analysis' | 'document'
): Promise<ActionResult<BookmarkWithDetails[]>> {
  try {
    const bookmarks = await bookmarksRepo.getAllWithDetails(state, type);
    return success(bookmarks);
  } catch (error) {
    console.error('[getBookmarks]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Update notes for a bookmark.
 */
export async function updateBookmarkNotes(
  bookmarkId: number,
  notes: string
): Promise<ActionResult<Bookmark>> {
  try {
    const bookmark = await bookmarksRepo.update(bookmarkId, { notes });

    if (!bookmark) {
      return failure(`Bookmark with id ${bookmarkId} not found`);
    }

    revalidatePath('/[state]/bookmarks', 'page');
    return success(bookmark);
  } catch (error) {
    console.error('[updateBookmarkNotes]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Remove a bookmark by ID.
 */
export async function removeBookmark(
  bookmarkId: number
): Promise<ActionResult<boolean>> {
  try {
    const deleted = await bookmarksRepo.delete(bookmarkId);

    if (!deleted) {
      return failure(`Bookmark with id ${bookmarkId} not found`);
    }

    revalidatePath('/[state]/pipeline', 'page');
    revalidatePath('/[state]/regulations', 'page');
    revalidatePath('/[state]/bookmarks', 'page');
    return success(true);
  } catch (error) {
    console.error('[removeBookmark]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Check if an analysis is bookmarked.
 */
export async function isAnalysisBookmarked(
  analysisId: number
): Promise<ActionResult<boolean>> {
  try {
    const isBookmarked = await bookmarksRepo.isAnalysisBookmarked(analysisId);
    return success(isBookmarked);
  } catch (error) {
    console.error('[isAnalysisBookmarked]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get all bookmarked analysis IDs for a state.
 * Used for efficient batch checking in tables.
 */
export async function getBookmarkedAnalysisIds(
  state: string
): Promise<ActionResult<number[]>> {
  try {
    const ids = await bookmarksRepo.getBookmarkedAnalysisIds(state);
    return success(ids);
  } catch (error) {
    console.error('[getBookmarkedAnalysisIds]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get bookmark counts for a state.
 */
export async function getBookmarkCounts(
  state: string
): Promise<ActionResult<{ analysis: number; document: number; total: number }>> {
  try {
    const analysisCount = await bookmarksRepo.getCount(state, 'analysis');
    const documentCount = await bookmarksRepo.getCount(state, 'document');
    return success({
      analysis: analysisCount,
      document: documentCount,
      total: analysisCount + documentCount,
    });
  } catch (error) {
    console.error('[getBookmarkCounts]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Toggle bookmark for an analysis by document ID and issue type.
 * This is a convenience function for use in tables that don't have the analysis ID.
 * @returns The created bookmark, or null if removed, or error if analysis not found
 */
export async function toggleAnalysisBookmarkByDocIssue(
  documentId: number,
  issueType: string,
  state: string,
  createdBy?: string
): Promise<ActionResult<Bookmark | null>> {
  try {
    // Find the analysis ID
    const [analysis] = await db
      .select({ id: complianceIssueAnalyses.id })
      .from(complianceIssueAnalyses)
      .where(
        and(
          eq(complianceIssueAnalyses.documentId, documentId),
          eq(complianceIssueAnalyses.issueType, issueType)
        )
      )
      .limit(1);

    if (!analysis) {
      return failure(`Analysis for document ${documentId} issue ${issueType} not found`);
    }

    // Use the main toggle function
    return toggleAnalysisBookmark(analysis.id, undefined, createdBy);
  } catch (error) {
    console.error('[toggleAnalysisBookmarkByDocIssue]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Check if an analysis is bookmarked by document ID and issue type.
 */
export async function isAnalysisBookmarkedByDocIssue(
  documentId: number,
  issueType: string
): Promise<ActionResult<boolean>> {
  try {
    // Find the analysis ID
    const [analysis] = await db
      .select({ id: complianceIssueAnalyses.id })
      .from(complianceIssueAnalyses)
      .where(
        and(
          eq(complianceIssueAnalyses.documentId, documentId),
          eq(complianceIssueAnalyses.issueType, issueType)
        )
      )
      .limit(1);

    if (!analysis) {
      return success(false);
    }

    const isBookmarked = await bookmarksRepo.isAnalysisBookmarked(analysis.id);
    return success(isBookmarked);
  } catch (error) {
    console.error('[isAnalysisBookmarkedByDocIssue]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get bookmarked document-issue pairs for a state.
 * Returns a Set of "documentId-issueType" keys for efficient lookup.
 */
export async function getBookmarkedDocIssuePairs(
  state: string
): Promise<ActionResult<Set<string>>> {
  try {
    const bookmarks = await bookmarksRepo.getAllWithDetails(state, 'analysis');
    const pairs = new Set(
      bookmarks
        .filter(b => b.analysisId !== null && b.issueType !== null)
        .map(b => `${b.documentId}-${b.issueType}`)
    );
    return success(pairs);
  } catch (error) {
    console.error('[getBookmarkedDocIssuePairs]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get bookmark by document ID and issue type.
 * Returns the full bookmark object including notes.
 */
export async function getBookmarkByDocIssue(
  documentId: number,
  issueType: string
): Promise<ActionResult<Bookmark | null>> {
  try {
    // Find the analysis ID
    const [analysis] = await db
      .select({ id: complianceIssueAnalyses.id })
      .from(complianceIssueAnalyses)
      .where(
        and(
          eq(complianceIssueAnalyses.documentId, documentId),
          eq(complianceIssueAnalyses.issueType, issueType)
        )
      )
      .limit(1);

    if (!analysis) {
      return success(null);
    }

    const bookmark = await bookmarksRepo.getByAnalysisId(analysis.id);
    return success(bookmark ?? null);
  } catch (error) {
    console.error('[getBookmarkByDocIssue]', error);
    return failure(getErrorMessage(error));
  }
}
