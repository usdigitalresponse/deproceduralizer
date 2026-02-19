import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

/**
 * Share Tokens table
 *
 * One-time shareable authentication tokens for granting temporary site access.
 * Each token can be used exactly once - after first use, the token is marked
 * as consumed and cannot be reused.
 */
export const shareTokens = pgTable('share_tokens', {
  id: serial('id').primaryKey(),

  // Cryptographically random 64-character hex string (from 32 random bytes)
  token: text('token').notNull().unique(),

  // Whether this token has been consumed
  used: boolean('used').default(false).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  usedAt: timestamp('used_at'),
});

// Type exports
export type ShareToken = typeof shareTokens.$inferSelect;
export type NewShareToken = typeof shareTokens.$inferInsert;
