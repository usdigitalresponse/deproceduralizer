'use server';

import 'server-only';
import { revalidatePath, updateTag } from 'next/cache';
import {
  db,
  BookmarksRepository,
  bookmarks,
  complianceIssueAnalyses,
  type Bookmark,
  type BookmarkWithDetails,
  eq,
  and,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runAction, runCachedAction } from './types';

const bookmarksRepo = new BookmarksRepository(db);

/**
 * Invalidate bookmark-related caches after mutations.
 * Always invalidates the bookmarks tag and bookmarks page;
 * pass additional page paths to revalidate (e.g. pipeline, regulations).
 */
function refreshBookmarkCache(...additionalPages: string[]) {
  updateTag('bookmarks');
  revalidatePath('/[state]/bookmarks', 'page');
  for (const page of additionalPages) {
    revalidatePath(page, 'page');
  }
}

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
      refreshBookmarkCache('/[state]/pipeline');
      return success(null);
    }

    // Get analysis details to populate bookmark
    const [analysis] = await db
      .select({
        documentId: complianceIssueAnalyses.documentId,
        issueType: complianceIssueAnalyses.issueType,
        jurisdiction: complianceIssueAnalyses.jurisdiction,
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
      jurisdiction: analysis.jurisdiction,
      notes,
      createdBy,
    });

    refreshBookmarkCache('/[state]/pipeline');
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
  jurisdiction: string,
  notes?: string,
  createdBy?: string
): Promise<ActionResult<Bookmark | null>> {
  try {
    // Check if already bookmarked
    const existing = await bookmarksRepo.getDocumentBookmark(documentId);

    if (existing) {
      // Remove bookmark
      await bookmarksRepo.delete(existing.id);
      refreshBookmarkCache('/[state]/regulations');
      return success(null);
    }

    // Create bookmark
    const bookmark = await bookmarksRepo.create({
      documentId,
      jurisdiction,
      notes,
      createdBy,
    });

    refreshBookmarkCache('/[state]/regulations');
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
  jurisdiction: string,
  type?: 'analysis' | 'document'
): Promise<ActionResult<BookmarkWithDetails[]>> {
  return runAction('getBookmarks', () => bookmarksRepo.getAllWithDetails(jurisdiction, type));
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

    refreshBookmarkCache('/[state]/pipeline', '/[state]/regulations');
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
  return runAction('isAnalysisBookmarked', () => bookmarksRepo.isAnalysisBookmarked(analysisId));
}

/**
 * Get all bookmarked analysis IDs for a state.
 * Used for efficient batch checking in tables.
 */
export async function getBookmarkedAnalysisIds(
  jurisdiction: string
): Promise<ActionResult<number[]>> {
  return runAction('getBookmarkedAnalysisIds', () => bookmarksRepo.getBookmarkedAnalysisIds(jurisdiction));
}

/**
 * Get bookmark counts for a state.
 * Cached for 2 minutes with parallel queries for performance.
 */
export async function getBookmarkCounts(
  jurisdiction: string
): Promise<ActionResult<{ analysis: number; document: number; total: number }>> {
  return runCachedAction(
    'getBookmarkCounts',
    async () => {
      // Parallel queries instead of sequential
      const [analysisCount, documentCount] = await Promise.all([
        bookmarksRepo.getCount(jurisdiction, 'analysis'),
        bookmarksRepo.getCount(jurisdiction, 'document'),
      ]);
      return {
        analysis: analysisCount,
        document: documentCount,
        total: analysisCount + documentCount,
      };
    },
    [`bookmark-counts-${jurisdiction}`],
    { revalidate: 120, tags: ['bookmarks'] }
  );
}

/**
 * Toggle bookmark for an analysis by document ID and issue type.
 * Optimized to use a single query to get analysis + bookmark status.
 * @returns The created bookmark, or null if removed, or error if analysis not found
 */
export async function toggleAnalysisBookmarkByDocIssue(
  documentId: number,
  issueType: string,
  jurisdiction: string,
  createdBy?: string
): Promise<ActionResult<Bookmark | null>> {
  try {
    // Single query to get analysis ID and existing bookmark status
    const [result] = await db
      .select({
        analysisId: complianceIssueAnalyses.id,
        analysisJurisdiction: complianceIssueAnalyses.jurisdiction,
        bookmarkId: bookmarks.id,
      })
      .from(complianceIssueAnalyses)
      .leftJoin(bookmarks, eq(bookmarks.analysisId, complianceIssueAnalyses.id))
      .where(
        and(
          eq(complianceIssueAnalyses.documentId, documentId),
          eq(complianceIssueAnalyses.issueType, issueType)
        )
      )
      .limit(1);

    if (!result) {
      return failure(`Analysis for document ${documentId} issue ${issueType} not found`);
    }

    if (result.bookmarkId) {
      // Bookmark exists - remove it
      await bookmarksRepo.delete(result.bookmarkId);
      refreshBookmarkCache('/[state]/pipeline');
      return success(null);
    }

    // Create new bookmark
    const bookmark = await bookmarksRepo.create({
      documentId,
      analysisId: result.analysisId,
      issueType,
      jurisdiction: result.analysisJurisdiction,
      createdBy,
    });

    refreshBookmarkCache('/[state]/pipeline');
    return success(bookmark);
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
  return runAction('isAnalysisBookmarkedByDocIssue', async () => {
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
      return false;
    }

    return bookmarksRepo.isAnalysisBookmarked(analysis.id);
  });
}

/**
 * Get bookmarked document-issue pairs for a state.
 * Returns a Set of "documentId-issueType" keys for efficient lookup.
 */
export async function getBookmarkedDocIssuePairs(
  jurisdiction: string
): Promise<ActionResult<Set<string>>> {
  return runAction('getBookmarkedDocIssuePairs', async () => {
    const allBookmarks = await bookmarksRepo.getAllWithDetails(jurisdiction, 'analysis');
    return new Set(
      allBookmarks
        .filter(b => b.analysisId !== null && b.issueType !== null)
        .map(b => `${b.documentId}-${b.issueType}`)
    );
  });
}

/**
 * Get bookmark by document ID and issue type.
 * Returns the full bookmark object including notes.
 */
export async function getBookmarkByDocIssue(
  documentId: number,
  issueType: string
): Promise<ActionResult<Bookmark | null>> {
  return runAction('getBookmarkByDocIssue', async () => {
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
      return null;
    }

    const bookmark = await bookmarksRepo.getByAnalysisId(analysis.id);
    return bookmark ?? null;
  });
}
