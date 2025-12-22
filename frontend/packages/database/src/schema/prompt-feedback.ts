import {
  pgTable,
  pgEnum,
  bigserial,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const feedbackTypeEnum = pgEnum('feedback_type', [
  'suggestion',
  'bug',
  'question',
  'other',
]);

export const promptFeedback = pgTable('prompt_feedback', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),

  // Prompt identification (matches key in prompts.yaml)
  promptName: varchar('prompt_name', { length: 100 }).notNull(),

  // Feedback content
  feedbackType: feedbackTypeEnum('feedback_type').notNull(),
  content: text('content').notNull(),

  // Optional: specific part of template feedback applies to
  highlightedText: text('highlighted_text'),

  // Author tracking
  authorName: varchar('author_name', { length: 255 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type PromptFeedback = typeof promptFeedback.$inferSelect;
export type NewPromptFeedback = typeof promptFeedback.$inferInsert;
export type FeedbackType = 'suggestion' | 'bug' | 'question' | 'other';
