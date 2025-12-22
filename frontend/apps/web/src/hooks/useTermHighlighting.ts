'use client';

import { useMemo } from 'react';
import type { ApplicableDefinition } from '@deproceduralizer/database';

/**
 * Represents a matched term in the content
 */
export interface TermMatch {
  /** The term text as it appears in the content */
  term: string;
  /** Normalized (lowercase, trimmed) version of the term */
  normalizedTerm: string;
  /** Character offset where the match starts */
  startOffset: number;
  /** Character offset where the match ends */
  endOffset: number;
  /** The definition associated with this term */
  definition: ApplicableDefinition;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find all matches of a regex pattern in content using matchAll
 */
function findAllMatches(
  content: string,
  regex: RegExp,
  termMap: Map<string, ApplicableDefinition>
): TermMatch[] {
  const matches: TermMatch[] = [];

  // Use matchAll for cleaner iteration (ES2020+)
  for (const match of content.matchAll(regex)) {
    const matchedText = match[0];
    const normalized = matchedText.toLowerCase().trim();
    const def = termMap.get(normalized);

    if (def && match.index !== undefined) {
      matches.push({
        term: matchedText,
        normalizedTerm: normalized,
        startOffset: match.index,
        endOffset: match.index + matchedText.length,
        definition: def,
      });
    }
  }

  return matches;
}

/**
 * Build a term matcher function from a list of definitions
 * Returns a function that finds all term occurrences in content
 */
function buildTermMatcher(definitions: ApplicableDefinition[]) {
  if (!definitions || definitions.length === 0) {
    return () => [];
  }

  // 1. Dedupe by normalizedTerm (keep first definition for each term)
  const termMap = new Map<string, ApplicableDefinition>();
  for (const def of definitions) {
    const key = def.normalizedTerm ?? def.term.toLowerCase().trim();
    // Skip empty terms
    if (!key || key.length < 2) continue;
    // Keep first (or could prioritize by quality/scope level)
    if (!termMap.has(key)) {
      termMap.set(key, def);
    }
  }

  if (termMap.size === 0) {
    return () => [];
  }

  // 2. Sort by length descending (match longest terms first)
  // This ensures "gross vehicle weight rating" matches before "weight"
  const sortedTerms = [...termMap.entries()].sort((a, b) => b[0].length - a[0].length);

  // 3. Build word-boundary regex pattern
  // Join all terms with | (OR), each wrapped in word boundaries
  const pattern = sortedTerms
    .map(([term]) => `\\b(${escapeRegex(term)})\\b`)
    .join('|');

  // Use 'gi' flags for global (find all) and case-insensitive matching
  const regex = new RegExp(pattern, 'gi');

  // 4. Return matcher function
  return (content: string): TermMatch[] => {
    if (!content) return [];
    return findAllMatches(content, regex, termMap);
  };
}

/**
 * Hook for finding and highlighting defined terms in content
 *
 * @param content - The text content to search for terms
 * @param definitions - Array of applicable definitions with terms to highlight
 * @returns Array of TermMatch objects with term positions and definition data
 *
 * @example
 * ```tsx
 * const termMatches = useTermHighlighting(content, applicableDefinitions);
 * // termMatches: [{ term: "applicant", startOffset: 42, endOffset: 51, definition: {...} }]
 * ```
 */
export function useTermHighlighting(
  content: string,
  definitions: ApplicableDefinition[] | undefined
): TermMatch[] {
  // Memoize the term matcher function - only rebuild when definitions change
  const termMatcher = useMemo(
    () => buildTermMatcher(definitions ?? []),
    [definitions]
  );

  // Memoize the match results - only recompute when content or matcher changes
  const termMatches = useMemo(
    () => termMatcher(content),
    [termMatcher, content]
  );

  return termMatches;
}
