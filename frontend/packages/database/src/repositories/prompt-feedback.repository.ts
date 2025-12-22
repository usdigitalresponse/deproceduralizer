import { eq, desc, sql } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import {
  promptFeedback,
  PromptFeedback,
  NewPromptFeedback,
  FeedbackType,
} from '../schema/prompt-feedback';

export interface CreatePromptFeedbackInput {
  promptName: string;
  feedbackType: FeedbackType;
  content: string;
  highlightedText?: string;
  authorName?: string;
}

export interface UpdatePromptFeedbackInput {
  content?: string;
  feedbackType?: FeedbackType;
  highlightedText?: string;
  authorName?: string;
}

export class PromptFeedbackRepository extends BaseRepository {
  async create(input: CreatePromptFeedbackInput): Promise<PromptFeedback> {
    const [feedback] = await this.db
      .insert(promptFeedback)
      .values({
        promptName: input.promptName,
        feedbackType: input.feedbackType,
        content: input.content,
        highlightedText: input.highlightedText ?? null,
        authorName: input.authorName ?? null,
      })
      .returning();

    return feedback;
  }

  async getById(id: number): Promise<PromptFeedback | undefined> {
    const [feedback] = await this.db
      .select()
      .from(promptFeedback)
      .where(eq(promptFeedback.id, id))
      .limit(1);

    return feedback;
  }

  async getByPromptName(promptName: string): Promise<PromptFeedback[]> {
    return this.db
      .select()
      .from(promptFeedback)
      .where(eq(promptFeedback.promptName, promptName))
      .orderBy(desc(promptFeedback.createdAt));
  }

  async getAll(): Promise<PromptFeedback[]> {
    return this.db
      .select()
      .from(promptFeedback)
      .orderBy(desc(promptFeedback.createdAt));
  }

  async getCountsByPrompt(): Promise<Record<string, number>> {
    const results = await this.db
      .select({
        promptName: promptFeedback.promptName,
        count: sql<number>`count(*)::int`,
      })
      .from(promptFeedback)
      .groupBy(promptFeedback.promptName);

    return results.reduce(
      (acc, row) => {
        acc[row.promptName] = row.count;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  async update(
    id: number,
    data: UpdatePromptFeedbackInput
  ): Promise<PromptFeedback | undefined> {
    const updateData: Partial<NewPromptFeedback> = {
      updatedAt: new Date(),
    };

    if (data.content !== undefined) {
      updateData.content = data.content;
    }
    if (data.feedbackType !== undefined) {
      updateData.feedbackType = data.feedbackType;
    }
    if (data.highlightedText !== undefined) {
      updateData.highlightedText = data.highlightedText;
    }
    if (data.authorName !== undefined) {
      updateData.authorName = data.authorName;
    }

    const [feedback] = await this.db
      .update(promptFeedback)
      .set(updateData)
      .where(eq(promptFeedback.id, id))
      .returning();

    return feedback;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(promptFeedback)
      .where(eq(promptFeedback.id, id))
      .returning({ id: promptFeedback.id });

    return result.length > 0;
  }
}
