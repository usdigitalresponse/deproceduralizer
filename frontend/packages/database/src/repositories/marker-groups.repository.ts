import { eq, and, sql, isNull, asc, inArray } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { markerGroups, MarkerGroup, NewMarkerGroup, bookmarkMarkers } from '../schema/marker-groups';
import { bookmarks } from '../schema/bookmarks';

export interface CreateMarkerGroupInput {
  name: string;
  color: string;
  icon?: string;
  jurisdiction?: string;
  isCustom?: boolean;
  createdBy?: string;
}

export interface UpdateMarkerGroupInput {
  name?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export class MarkerGroupsRepository extends BaseRepository {
  /**
   * Get all marker groups, optionally filtered by jurisdiction.
   * Returns groups that are global (no jurisdiction) OR match the given jurisdiction.
   */
  async getAll(jurisdiction?: string): Promise<MarkerGroup[]> {
    if (jurisdiction) {
      return this.db
        .select()
        .from(markerGroups)
        .where(
          sql`${markerGroups.jurisdiction} IS NULL OR ${markerGroups.jurisdiction} = ${jurisdiction.toUpperCase()}`
        )
        .orderBy(asc(markerGroups.sortOrder), asc(markerGroups.name));
    }

    return this.db
      .select()
      .from(markerGroups)
      .orderBy(asc(markerGroups.sortOrder), asc(markerGroups.name));
  }

  /**
   * Get triage marker groups (category = 'triage'), ordered by sortOrder.
   */
  async getTriageGroups(jurisdiction?: string): Promise<MarkerGroup[]> {
    const conditions = jurisdiction
      ? sql`${markerGroups.category} = 'triage' AND (${markerGroups.jurisdiction} IS NULL OR ${markerGroups.jurisdiction} = ${jurisdiction.toUpperCase()})`
      : eq(markerGroups.category, 'triage');

    return this.db
      .select()
      .from(markerGroups)
      .where(conditions)
      .orderBy(asc(markerGroups.sortOrder));
  }

  /**
   * Get a marker group by ID
   */
  async getById(id: number): Promise<MarkerGroup | undefined> {
    const [group] = await this.db
      .select()
      .from(markerGroups)
      .where(eq(markerGroups.id, id))
      .limit(1);

    return group;
  }

  /**
   * Create a new marker group
   */
  async create(input: CreateMarkerGroupInput): Promise<MarkerGroup> {
    // Get the next sort order
    const [maxSort] = await this.db
      .select({ max: sql<number>`COALESCE(MAX(${markerGroups.sortOrder}), -1)` })
      .from(markerGroups);

    const jurisdictionUpper = input.jurisdiction?.toUpperCase() ?? null;

    const [group] = await this.db
      .insert(markerGroups)
      .values({
        name: input.name,
        color: input.color,
        icon: input.icon ?? null,
        jurisdiction: jurisdictionUpper,
        sortOrder: (maxSort?.max ?? -1) + 1,
        isCustom: input.isCustom ?? false,
        createdBy: input.createdBy ?? null,
      })
      .onConflictDoNothing()
      .returning();

    // If conflict occurred (case-insensitive duplicate), fetch the existing row
    if (!group) {
      const conditions = jurisdictionUpper
        ? and(
            sql`LOWER(${markerGroups.name}) = LOWER(${input.name})`,
            eq(markerGroups.jurisdiction, jurisdictionUpper)
          )
        : and(
            sql`LOWER(${markerGroups.name}) = LOWER(${input.name})`,
            isNull(markerGroups.jurisdiction)
          );

      const [existing] = await this.db
        .select()
        .from(markerGroups)
        .where(conditions)
        .limit(1);

      return existing;
    }

    return group;
  }

  /**
   * Update a marker group
   */
  async update(id: number, input: UpdateMarkerGroupInput): Promise<MarkerGroup | undefined> {
    const sets: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) sets.name = input.name;
    if (input.color !== undefined) sets.color = input.color;
    if (input.icon !== undefined) sets.icon = input.icon;
    if (input.sortOrder !== undefined) sets.sortOrder = input.sortOrder;

    const [group] = await this.db
      .update(markerGroups)
      .set(sets)
      .where(eq(markerGroups.id, id))
      .returning();

    return group;
  }

  /**
   * Delete a marker group
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(markerGroups)
      .where(eq(markerGroups.id, id))
      .returning({ id: markerGroups.id });

    return result.length > 0;
  }

  /**
   * Reorder marker groups by IDs (index in array = new sort_order)
   */
  async reorder(ids: number[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx
          .update(markerGroups)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(eq(markerGroups.id, ids[i]));
      }
    });
  }

  /**
   * Get the count of distinct bookmarks associated with a marker group.
   */
  async getBookmarkCount(groupId: number): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`COUNT(DISTINCT ${bookmarkMarkers.bookmarkId})` })
      .from(bookmarkMarkers)
      .where(eq(bookmarkMarkers.markerGroupId, groupId));

    return result?.count ?? 0;
  }

  /**
   * Delete all bookmarks that are associated with a marker group.
   * This removes the bookmarks themselves (from the bookmarks table),
   * not just the bookmark_markers junction rows.
   */
  async deleteBookmarksForGroup(groupId: number): Promise<void> {
    // Get all bookmark IDs linked to this group
    const rows = await this.db
      .select({ bookmarkId: bookmarkMarkers.bookmarkId })
      .from(bookmarkMarkers)
      .where(eq(bookmarkMarkers.markerGroupId, groupId));

    const bookmarkIds = rows.map(r => r.bookmarkId);
    if (bookmarkIds.length === 0) return;

    // Delete the bookmarks (cascade will clean up bookmark_markers)
    await this.db
      .delete(bookmarks)
      .where(inArray(bookmarks.id, bookmarkIds));
  }

  /**
   * Atomically delete a marker group and all its associated bookmarks
   * within a single transaction to avoid partial state.
   */
  async deleteGroupWithBookmarks(groupId: number): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      // Find all bookmark IDs linked to this group
      const rows = await tx
        .select({ id: bookmarkMarkers.bookmarkId })
        .from(bookmarkMarkers)
        .where(eq(bookmarkMarkers.markerGroupId, groupId));

      if (rows.length > 0) {
        // Delete the bookmarks (cascade handles bookmark_markers rows)
        await tx.delete(bookmarks).where(
          inArray(bookmarks.id, rows.map(r => r.id))
        );
      }

      // Delete the group itself (cascade handles any remaining bookmark_markers)
      const [deleted] = await tx
        .delete(markerGroups)
        .where(eq(markerGroups.id, groupId))
        .returning({ id: markerGroups.id });

      return !!deleted;
    });
  }

  /**
   * Find-or-create a custom (freeform) marker group by name.
   */
  async getOrCreateCustom(name: string, jurisdiction?: string): Promise<MarkerGroup> {
    const jurisdictionUpper = jurisdiction?.toUpperCase() ?? null;

    // Try to find existing (case-insensitive to match the DB unique index)
    const conditions = jurisdictionUpper
      ? and(
          sql`LOWER(${markerGroups.name}) = LOWER(${name})`,
          eq(markerGroups.jurisdiction, jurisdictionUpper)
        )
      : and(
          sql`LOWER(${markerGroups.name}) = LOWER(${name})`,
          isNull(markerGroups.jurisdiction)
        );

    const [existing] = await this.db
      .select()
      .from(markerGroups)
      .where(conditions)
      .limit(1);

    if (existing) return existing;

    // Create new custom group (onConflictDoNothing for race conditions with the case-insensitive unique index)
    const [maxSort] = await this.db
      .select({ max: sql<number>`COALESCE(MAX(${markerGroups.sortOrder}), -1)` })
      .from(markerGroups);

    const [created] = await this.db
      .insert(markerGroups)
      .values({
        name,
        color: '#6b7280', // default gray
        icon: null,
        jurisdiction: jurisdictionUpper,
        sortOrder: (maxSort?.max ?? -1) + 1,
        isCustom: true,
        createdBy: null,
      })
      .onConflictDoNothing()
      .returning();

    // If conflict occurred (race condition), fetch the existing row
    if (!created) {
      const [raced] = await this.db
        .select()
        .from(markerGroups)
        .where(conditions)
        .limit(1);
      return raced;
    }

    return created;
  }
}
