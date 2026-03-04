import {
  pgTable,
  bigserial,
  text,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

/**
 * Prompt Templates table
 *
 * Stores deduplicated prompt templates for observability.
 * Each unique canonical request (model + system + messages + tools + tool_choice + max_tokens) gets one row, identified by SHA-256 content hash.
 * Linked from compliance_issue_analyses via tier1/2/3_prompt_id FKs.
 */
export const promptTemplates = pgTable('prompt_templates', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  contentHash: text('content_hash').notNull().unique(),
  pipeline: text('pipeline').notNull(),        // 'research', 'jenai', 'summarization'
  tier: integer('tier'),                        // 1, 2, 3 (NULL for single-pass)
  model: text('model').notNull(),
  systemPrompt: text('system_prompt'),
  userMessage: text('user_message'),
  toolsSchema: jsonb('tools_schema').$type<Record<string, unknown>[]>(),
  fullRequest: jsonb('full_request').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow(),
});

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type NewPromptTemplate = typeof promptTemplates.$inferInsert;

export const PROMPT_PIPELINES = ['research', 'jenai', 'summarization'] as const;
export type PromptPipeline = typeof PROMPT_PIPELINES[number];
