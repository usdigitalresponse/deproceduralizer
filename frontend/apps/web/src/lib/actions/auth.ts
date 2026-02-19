'use server';
import 'server-only';
import { db, eq, and } from '@deproceduralizer/database';
import { shareTokens } from '@deproceduralizer/database/schema';
import { randomBytes } from 'crypto';

/**
 * Validates a password against the SITE_PASSWORD environment variable.
 *
 * @param password - The password to validate
 * @returns Success result or error message
 */
export async function validatePassword(password: string) {
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    console.error('SITE_PASSWORD environment variable not set');
    return { success: false, error: 'Configuration error' };
  }

  if (password === sitePassword) {
    return { success: true };
  }

  return { success: false, error: 'Incorrect password' };
}

/**
 * Generates a new one-time share token.
 *
 * Creates a cryptographically random 64-character hex token and stores it
 * in the database for later validation.
 *
 * @returns Success result with token, or error message
 */
export async function generateShareToken() {
  try {
    // Generate cryptographically random 64-character hex string
    const token = randomBytes(32).toString('hex');

    await db.insert(shareTokens).values({
      token,
      used: false,
    });

    return { success: true, token };
  } catch (error) {
    console.error('Error generating share token:', error);
    return { success: false, error: 'Failed to generate share link' };
  }
}

/**
 * Validates a share token and marks it as used.
 *
 * Checks if the token exists and hasn't been used yet. If valid, marks it
 * as consumed with the current timestamp.
 *
 * @param token - The token to validate
 * @returns Success result or error message
 */
export async function validateShareToken(token: string) {
  try {
    const result = await db
      .select()
      .from(shareTokens)
      .where(and(
        eq(shareTokens.token, token),
        eq(shareTokens.used, false)
      ))
      .limit(1);

    if (result.length === 0) {
      return { success: false, error: 'Invalid or already used link' };
    }

    // Mark as used
    await db
      .update(shareTokens)
      .set({ used: true, usedAt: new Date() })
      .where(eq(shareTokens.token, token));

    return { success: true };
  } catch (error) {
    console.error('Error validating share token:', error);
    return { success: false, error: 'Failed to validate link' };
  }
}
