import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { bookmarks } from './bookmarks';

/**
 * Marker groups table
 *
 * Predefined + user-created categories for bookmarks.
 * Groups can be global (jurisdiction = NULL) or scoped to a jurisdiction.
 * Freeform groups (is_custom = true) are created by users on the fly.
 */
export const markerGroups = pgTable('marker_groups', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }).notNull().default('#6b7280'),
  icon: varchar('icon', { length: 50 }),
  jurisdiction: varchar('jurisdiction', { length: 3 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isCustom: boolean('is_custom').notNull().default(false),
  category: varchar('category', { length: 30 }),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_marker_groups_name_jurisdiction')
    .on(sql`LOWER(${table.name})`, sql`COALESCE(${table.jurisdiction}, '__global__')`),
]);

/**
 * Bookmark markers junction table (many-to-many)
 *
 * Links bookmarks to marker groups.
 */
export const bookmarkMarkers = pgTable('bookmark_markers', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  bookmarkId: bigint('bookmark_id', { mode: 'number' })
    .notNull()
    .references(() => bookmarks.id, { onDelete: 'cascade' }),
  markerGroupId: bigint('marker_group_id', { mode: 'number' })
    .notNull()
    .references(() => markerGroups.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_bookmark_markers_unique')
    .on(table.bookmarkId, table.markerGroupId),
]);

// Type exports
export type MarkerGroup = typeof markerGroups.$inferSelect;
export type NewMarkerGroup = typeof markerGroups.$inferInsert;
export type BookmarkMarker = typeof bookmarkMarkers.$inferSelect;
export type NewBookmarkMarker = typeof bookmarkMarkers.$inferInsert;
