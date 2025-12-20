/**
 * Schema-only exports for use in client components
 *
 * Use this import path when you only need types/constants and don't need
 * the database client (which requires DATABASE_URL):
 *
 * import { REVIEW_STATUSES } from '@deproceduralizer/database/schema-only';
 *
 * For server-side code that needs the db client, use:
 * import { db } from '@deproceduralizer/database';
 */
export * from './schema';
