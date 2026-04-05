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
  sql,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runAction, runCachedAction } from './types';

const bookmarksRepo = new BookmarksRepository(db);

/**
 * Invalidate bookmark/marker-related caches after mutations.
 * Always invalidates the bookmarks tag and markers page;
 * pass additional page paths to revalidate (e.g. pipeline, regulations).
 */
function refreshBookmarkCache(...additionalPages: string[]) {
  updateTag('bookmarks');
  updateTag('marker-groups');
  revalidatePath('/[state]/markers', 'page');
  revalidatePath('/[state]/fines', 'page');
  revalidatePath('/[state]/guidance', 'page');
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

    if (analysis.documentId === null) {
      return failure(`Analysis ${analysisId} has no associated document`);
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
 * Toggle bookmark for a guidance document.
 * If bookmarked, removes it. If not, creates one.
 * @returns The created bookmark, or null if removed
 */
export async function toggleGuidanceBookmark(
  guidanceDocId: number,
  jurisdiction: string,
  notes?: string,
  createdBy?: string
): Promise<ActionResult<Bookmark | null>> {
  try {
    const existing = await bookmarksRepo.getGuidanceDocumentBookmark(guidanceDocId);

    if (existing) {
      await bookmarksRepo.delete(existing.id);
      refreshBookmarkCache('/[state]/guidance');
      return success(null);
    }

    const bookmark = await bookmarksRepo.create({
      guidanceDocumentId: guidanceDocId,
      jurisdiction,
      notes,
      createdBy,
    });

    refreshBookmarkCache('/[state]/guidance');
    return success(bookmark);
  } catch (error) {
    console.error('[toggleGuidanceBookmark]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Check if a guidance document is bookmarked.
 */
export async function isGuidanceBookmarked(
  guidanceDocId: number
): Promise<ActionResult<boolean>> {
  return runAction('isGuidanceBookmarked', () => bookmarksRepo.isGuidanceDocumentBookmarked(guidanceDocId));
}

/**
 * Get the full guidance document bookmark (or null if not bookmarked).
 */
export async function getGuidanceBookmark(
  guidanceDocId: number
): Promise<ActionResult<Bookmark | null>> {
  return runAction('getGuidanceBookmark', async () => {
    const bookmark = await bookmarksRepo.getGuidanceDocumentBookmark(guidanceDocId);
    return bookmark ?? null;
  });
}

/**
 * Get all bookmarks for a state with document/analysis details.
 */
export async function getBookmarks(
  jurisdiction: string,
  type?: 'analysis' | 'document' | 'guidance'
): Promise<ActionResult<BookmarkWithDetails[]>> {
  return runAction('getBookmarks', () => bookmarksRepo.getAllWithDetails(jurisdiction, type));
}

/**
 * Update notes for a bookmark.
 */
export async function updateBookmarkNotes(
  bookmarkId: number,
  notes: string,
  createdBy?: string
): Promise<ActionResult<Bookmark>> {
  try {
    const bookmark = await bookmarksRepo.update(bookmarkId, {
      notes,
      ...(createdBy !== undefined && { createdBy }),
    });

    if (!bookmark) {
      return failure(`Bookmark with id ${bookmarkId} not found`);
    }

    revalidatePath('/[state]/markers', 'page');
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
 * Toggle bookmark for a fine/fee/penalty.
 * If bookmarked, removes it. If not, creates one.
 * @returns The created bookmark, or null if removed
 */
export async function toggleFineBookmark(
  fineId: number,
  jurisdiction: string,
  notes?: string,
  createdBy?: string
): Promise<ActionResult<Bookmark | null>> {
  try {
    const existing = await bookmarksRepo.getFineBookmark(fineId);

    if (existing) {
      await bookmarksRepo.delete(existing.id);
      refreshBookmarkCache();
      return success(null);
    }

    const bookmark = await bookmarksRepo.create({
      fineId,
      jurisdiction,
      notes,
      createdBy,
    });

    refreshBookmarkCache();
    return success(bookmark);
  } catch (error) {
    console.error('[toggleFineBookmark]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Check if a fine is bookmarked.
 */
export async function isFineBookmarked(
  fineId: number
): Promise<ActionResult<boolean>> {
  return runAction('isFineBookmarked', () => bookmarksRepo.isFineBookmarked(fineId));
}

/**
 * Get the full bookmark object for a fine (for notes editing).
 */
export async function getFineBookmark(
  fineId: number
): Promise<ActionResult<Bookmark | null>> {
  return runAction('getFineBookmark', async () => {
    const bookmark = await bookmarksRepo.getFineBookmark(fineId);
    return bookmark ?? null;
  });
}

/**
 * Get all bookmarked fine IDs for a state.
 * Used for efficient batch checking in tables.
 */
export async function getBookmarkedFineIds(
  jurisdiction: string
): Promise<ActionResult<number[]>> {
  return runAction('getBookmarkedFineIds', () => bookmarksRepo.getBookmarkedFineIds(jurisdiction));
}

export type FineBookmarkInfo = { fineId: number; id: number; notes: string | null; createdBy: string | null };

/**
 * Get all fine bookmarks with notes for a state.
 * Used for inline notes display in the fines table.
 */
export async function getFineBookmarksWithNotes(
  jurisdiction: string
): Promise<ActionResult<FineBookmarkInfo[]>> {
  return runAction('getFineBookmarksWithNotes', () => bookmarksRepo.getFineBookmarksWithNotes(jurisdiction));
}

/**
 * Get bookmark counts for a state.
 * Cached for 2 minutes with parallel queries for performance.
 */
export async function getBookmarkCounts(
  jurisdiction: string
): Promise<ActionResult<{ analysis: number; document: number; guidance: number; fine: number; total: number }>> {
  return runCachedAction(
    'getBookmarkCounts',
    async () => {
      const [analysisCount, documentCount, guidanceCount, fineCount] = await Promise.all([
        bookmarksRepo.getCount(jurisdiction, 'analysis'),
        bookmarksRepo.getCount(jurisdiction, 'document'),
        bookmarksRepo.getCount(jurisdiction, 'guidance'),
        bookmarksRepo.getCount(jurisdiction, 'fine'),
      ]);
      return {
        analysis: analysisCount,
        document: documentCount,
        guidance: guidanceCount,
        fine: fineCount,
        total: analysisCount + documentCount + guidanceCount + fineCount,
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
        .map(b => `r-${b.documentId}-${b.issueType}`)
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

/**
 * Toggle bookmark for a guidance analysis by guidance document ID and issue type.
 */
export async function toggleGuidanceAnalysisBookmarkByDocIssue(
  guidanceDocumentId: number,
  issueType: string,
  jurisdiction: string,
  createdBy?: string
): Promise<ActionResult<Bookmark | null>> {
  try {
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
          eq(complianceIssueAnalyses.guidanceDocumentId, guidanceDocumentId),
          eq(complianceIssueAnalyses.issueType, issueType)
        )
      )
      .limit(1);

    if (!result) {
      return failure(`Analysis for guidance document ${guidanceDocumentId} issue ${issueType} not found`);
    }

    if (result.bookmarkId) {
      await bookmarksRepo.delete(result.bookmarkId);
      refreshBookmarkCache('/[state]/pipeline');
      return success(null);
    }

    const bookmark = await bookmarksRepo.create({
      guidanceDocumentId,
      analysisId: result.analysisId,
      issueType,
      jurisdiction: result.analysisJurisdiction,
      createdBy,
    });

    refreshBookmarkCache('/[state]/pipeline');
    return success(bookmark);
  } catch (error) {
    console.error('[toggleGuidanceAnalysisBookmarkByDocIssue]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get bookmark by guidance document ID and issue type.
 */
export async function getBookmarkByGuidanceDocIssue(
  guidanceDocumentId: number,
  issueType: string
): Promise<ActionResult<Bookmark | null>> {
  return runAction('getBookmarkByGuidanceDocIssue', async () => {
    const [analysis] = await db
      .select({ id: complianceIssueAnalyses.id })
      .from(complianceIssueAnalyses)
      .where(
        and(
          eq(complianceIssueAnalyses.guidanceDocumentId, guidanceDocumentId),
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

/**
 * Get bookmarked guidance document-issue pairs for a state.
 * Returns a Set of "guidanceDocumentId-issueType" keys for efficient lookup.
 */
export async function getBookmarkedGuidanceDocIssuePairs(
  jurisdiction: string
): Promise<ActionResult<Set<string>>> {
  return runAction('getBookmarkedGuidanceDocIssuePairs', async () => {
    const results = await db
      .select({
        guidanceDocumentId: complianceIssueAnalyses.guidanceDocumentId,
        issueType: bookmarks.issueType,
      })
      .from(bookmarks)
      .innerJoin(complianceIssueAnalyses, eq(bookmarks.analysisId, complianceIssueAnalyses.id))
      .where(
        and(
          eq(bookmarks.jurisdiction, jurisdiction.toUpperCase()),
          sql`${complianceIssueAnalyses.guidanceDocumentId} IS NOT NULL`
        )
      );

    return new Set(
      results
        .filter(r => r.guidanceDocumentId !== null && r.issueType !== null)
        .map(r => `g-${r.guidanceDocumentId}-${r.issueType}`)
    );
  });
}

// ── Marker assignment actions ──────────────────────────────────────

/**
 * Assign a marker group to a bookmark.
 */
export async function assignMarkerToBookmark(
  bookmarkId: number,
  markerGroupId: number
): Promise<ActionResult<boolean>> {
  try {
    await bookmarksRepo.assignMarker(bookmarkId, markerGroupId);
    refreshBookmarkCache();
    return success(true);
  } catch (error) {
    console.error('[assignMarkerToBookmark]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Remove a marker group from a bookmark.
 */
export async function removeMarkerFromBookmark(
  bookmarkId: number,
  markerGroupId: number
): Promise<ActionResult<boolean>> {
  try {
    await bookmarksRepo.removeMarker(bookmarkId, markerGroupId);
    refreshBookmarkCache();
    return success(true);
  } catch (error) {
    console.error('[removeMarkerFromBookmark]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Replace all markers for a bookmark with the given set.
 */
export async function setBookmarkMarkers(
  bookmarkId: number,
  markerGroupIds: number[]
): Promise<ActionResult<boolean>> {
  try {
    await bookmarksRepo.setMarkers(bookmarkId, markerGroupIds);
    refreshBookmarkCache();
    return success(true);
  } catch (error) {
    console.error('[setBookmarkMarkers]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get markers assigned to a bookmark.
 */
export async function getMarkersForBookmark(
  bookmarkId: number
): Promise<ActionResult<{ id: number; name: string; color: string }[]>> {
  return runAction('getMarkersForBookmark', () => bookmarksRepo.getMarkersForBookmark(bookmarkId));
}

// ── Bulk marker maps for inline display ──────────────────────────────

export type MarkerInfo = { id: number; name: string; color: string };
export type BookmarkMarkerEntry = { bookmarkId: number; markers: MarkerInfo[]; notes: string | null; createdBy: string | null };
export type BookmarkMarkersMap = Map<string, BookmarkMarkerEntry>;

/**
 * Get analysis bookmark markers map for inline display on pipeline rows.
 * Key: "documentId-issueType"
 */
export async function getAnalysisBookmarkMarkersMap(
  jurisdiction: string
): Promise<ActionResult<BookmarkMarkersMap>> {
  // Note: uses runAction (not runCachedAction) because Map objects aren't JSON-serializable for unstable_cache
  return runAction('getAnalysisBookmarkMarkersMap', () =>
    bookmarksRepo.getAnalysisBookmarkMarkersMap(jurisdiction)
  );
}

/**
 * Get fine bookmark markers map for inline display on fines table rows.
 * Key: fineId as string
 */
export async function getFineBookmarkMarkersMap(
  jurisdiction: string
): Promise<ActionResult<BookmarkMarkersMap>> {
  return runAction('getFineBookmarkMarkersMap', () =>
    bookmarksRepo.getFineBookmarkMarkersMap(jurisdiction)
  );
}

/**
 * Get guidance document bookmark markers map for inline display.
 * Key: guidanceDocumentId as string
 */
export async function getGuidanceDocBookmarkMarkersMap(
  jurisdiction: string
): Promise<ActionResult<BookmarkMarkersMap>> {
  return runAction('getGuidanceDocBookmarkMarkersMap', () =>
    bookmarksRepo.getGuidanceDocBookmarkMarkersMap(jurisdiction)
  );
}

// ── Triage tag helpers ─────────────────────────────────────────────────

/**
 * Toggle a triage tag on an analysis.
 * Auto-bookmarks the item if it isn't already bookmarked.
 * Multi-select: toggling one tag doesn't remove others.
 *
 * @param kind - 'regulation' or 'guidance'
 * @param docId - documentId (regulation) or guidanceDocumentId (guidance)
 * @param issueType - the issue type key
 * @param markerGroupId - the triage marker group to toggle
 * @param jurisdiction - jurisdiction code
 * @returns The updated list of marker IDs on the bookmark
 */
export async function toggleTriageTag(
  kind: 'regulation' | 'guidance',
  docId: number,
  issueType: string,
  markerGroupId: number,
  jurisdiction: string
): Promise<ActionResult<{ bookmarkId: number; markerIds: number[] }>> {
  try {
    // 1. Find the analysis
    const analysisFilter = kind === 'guidance'
      ? eq(complianceIssueAnalyses.guidanceDocumentId, docId)
      : eq(complianceIssueAnalyses.documentId, docId);

    const [analysis] = await db
      .select({
        analysisId: complianceIssueAnalyses.id,
        jurisdiction: complianceIssueAnalyses.jurisdiction,
      })
      .from(complianceIssueAnalyses)
      .where(and(analysisFilter, eq(complianceIssueAnalyses.issueType, issueType)))
      .limit(1);

    if (!analysis) {
      return failure(`Analysis not found for ${kind} ${docId} / ${issueType}`);
    }

    // 2. Ensure bookmark exists (find or create)
    let bookmark = await bookmarksRepo.getByAnalysisId(analysis.analysisId);
    const createdNewBookmark = !bookmark;
    if (!bookmark) {
      const createInput = kind === 'guidance'
        ? { guidanceDocumentId: docId, analysisId: analysis.analysisId, issueType, jurisdiction: analysis.jurisdiction }
        : { documentId: docId, analysisId: analysis.analysisId, issueType, jurisdiction: analysis.jurisdiction };
      bookmark = await bookmarksRepo.create(createInput);
    }

    // 3. Check if marker is already assigned
    const currentMarkers = await bookmarksRepo.getMarkersForBookmark(bookmark.id);
    const isAssigned = currentMarkers.some(m => m.id === markerGroupId);

    if (isAssigned) {
      await bookmarksRepo.removeMarker(bookmark.id, markerGroupId);
    } else {
      await bookmarksRepo.assignMarker(bookmark.id, markerGroupId);
    }

    // 4. Return updated marker list
    const updatedMarkers = await bookmarksRepo.getMarkersForBookmark(bookmark.id);
    // Only invalidate cache when a new bookmark was created — this refreshes
    // cached counts on Labels/Fines pages without re-rendering the pipeline page.
    if (createdNewBookmark) {
      updateTag('bookmarks');
    }

    return success({
      bookmarkId: bookmark.id,
      markerIds: updatedMarkers.map(m => m.id),
    });
  } catch (error) {
    console.error('[toggleTriageTag]', error);
    return failure(getErrorMessage(error));
  }
}
