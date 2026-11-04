/**
 * Shared utilities for prompt composition (used by both research-pipeline and barrier-prompt-composer).
 */

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function extractPlaceholders(text: string): string[] {
  const pattern = /\{(\w+)\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = pattern.exec(text)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}
