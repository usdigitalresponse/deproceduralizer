'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import {
  db,
  PromptFeedbackRepository,
  type PromptFeedback,
  type FeedbackType,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runAction } from './types';

const feedbackRepo = new PromptFeedbackRepository(db);

export interface CreateFeedbackInput {
  promptName: string;
  feedbackType: FeedbackType;
  content: string;
  highlightedText?: string;
  authorName?: string;
}

/**
 * Create new feedback for a prompt.
 */
export async function createPromptFeedback(
  input: CreateFeedbackInput
): Promise<ActionResult<PromptFeedback>> {
  try {
    const feedback = await feedbackRepo.create({
      promptName: input.promptName,
      feedbackType: input.feedbackType,
      content: input.content,
      highlightedText: input.highlightedText,
      authorName: input.authorName,
    });

    revalidatePath('/prompts');
    return success(feedback);
  } catch (error) {
    console.error('[createPromptFeedback]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get all feedback for a specific prompt.
 */
export async function getFeedbackByPrompt(
  promptName: string
): Promise<ActionResult<PromptFeedback[]>> {
  return runAction('getFeedbackByPrompt', () => feedbackRepo.getByPromptName(promptName));
}

/**
 * Get all feedback (for detecting orphaned feedback).
 */
export async function getAllFeedback(): Promise<ActionResult<PromptFeedback[]>> {
  return runAction('getAllFeedback', () => feedbackRepo.getAll());
}

/**
 * Get feedback counts grouped by prompt name.
 */
export async function getFeedbackCounts(): Promise<
  ActionResult<Record<string, number>>
> {
  return runAction('getFeedbackCounts', () => feedbackRepo.getCountsByPrompt());
}

/**
 * Delete feedback by ID.
 */
export async function deletePromptFeedback(
  id: number
): Promise<ActionResult<boolean>> {
  try {
    const deleted = await feedbackRepo.delete(id);

    if (!deleted) {
      return failure(`Feedback with id ${id} not found`);
    }

    revalidatePath('/prompts');
    return success(deleted);
  } catch (error) {
    console.error('[deletePromptFeedback]', error);
    return failure(getErrorMessage(error));
  }
}
