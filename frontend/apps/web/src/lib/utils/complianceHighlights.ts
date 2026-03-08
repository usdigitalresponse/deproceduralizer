import type { ComplianceIssueWithAnalysisFields } from '@deproceduralizer/database';

export interface ComplianceHighlightMatch {
  issueId: number;
  issueType: string;
  startOffset: number;
  endOffset: number;
  reviewStatus: string | null;
  verbatimText: string | null;
  documentId: number | null;
  guidanceDocumentId: number | null;
}

/**
 * Compute highlight offsets for compliance issues within regulation content.
 * Uses whitespace-normalized search (same as expandContext.ts) to find
 * each issue's regexMatchContext in the content, then applies regexMatchPattern
 * to find the exact match span within that context window.
 */
export function computeComplianceHighlights(
  content: string,
  issues: ComplianceIssueWithAnalysisFields[]
): ComplianceHighlightMatch[] {
  if (!content) return [];

  const normalizedContent = content.replace(/\s+/g, ' ');
  const highlights: ComplianceHighlightMatch[] = [];

  for (const issue of issues) {
    const context = issue.regexMatchContext;
    if (!context) continue;

    const normalizedContext = context.replace(/\s+/g, ' ').trim();

    // Find the context window in the content (same logic as expandContext.ts)
    let contextIndex = normalizedContent.indexOf(normalizedContext);

    // Fuzzy fallback: try first 50 chars
    if (contextIndex === -1 && normalizedContext.length > 50) {
      const shortContext = normalizedContext.slice(0, 50);
      contextIndex = normalizedContent.indexOf(shortContext);
    }

    if (contextIndex === -1) continue;

    // Now find the exact match within the context window using regexMatchPattern
    if (issue.regexMatchPattern) {
      try {
        const regex = new RegExp(issue.regexMatchPattern, 'i');
        const contextWindow = normalizedContent.slice(
          contextIndex,
          contextIndex + normalizedContext.length
        );
        const match = regex.exec(contextWindow);

        if (match) {
          // Map back to original content offsets
          // Since we normalized whitespace, we need to map from normalized offsets
          // back to original content offsets
          const normalizedStart = contextIndex + match.index;
          const normalizedEnd = normalizedStart + match[0].length;

          // Map normalized offsets back to original content
          const originalStart = mapNormalizedToOriginal(content, normalizedStart);
          const originalEnd = mapNormalizedToOriginal(content, normalizedEnd);

          highlights.push({
            issueId: issue.id,
            issueType: issue.issueType,
            startOffset: originalStart,
            endOffset: originalEnd,
            reviewStatus: issue.reviewStatus ?? null,
            verbatimText: issue.verbatimSupportingText?.[0] ?? null,
            documentId: issue.documentId ?? null,
            guidanceDocumentId: issue.guidanceDocumentId ?? null,
          });
          continue;
        }
      } catch {
        // Invalid regex, fall through to context-level highlight
      }
    }

    // Fallback: highlight the entire context window
    const originalStart = mapNormalizedToOriginal(content, contextIndex);
    const originalEnd = mapNormalizedToOriginal(content, contextIndex + normalizedContext.length);

    highlights.push({
      issueId: issue.id,
      issueType: issue.issueType,
      startOffset: originalStart,
      endOffset: originalEnd,
      reviewStatus: issue.reviewStatus ?? null,
      verbatimText: issue.verbatimSupportingText?.[0] ?? null,
      documentId: issue.documentId ?? null,
      guidanceDocumentId: issue.guidanceDocumentId ?? null,
    });
  }

  return highlights;
}

/**
 * Map an offset in whitespace-normalized content back to the original content.
 * Walks through the original content counting non-whitespace-collapsed characters.
 */
function mapNormalizedToOriginal(original: string, normalizedOffset: number): number {
  let normalizedPos = 0;
  let originalPos = 0;
  let inWhitespace = false;

  while (originalPos < original.length && normalizedPos < normalizedOffset) {
    const char = original[originalPos];
    const isWs = /\s/.test(char);

    if (isWs) {
      if (!inWhitespace) {
        // First whitespace char in a run counts as single space in normalized
        normalizedPos++;
        inWhitespace = true;
      }
      // Subsequent whitespace chars don't advance normalizedPos
    } else {
      normalizedPos++;
      inWhitespace = false;
    }
    originalPos++;
  }

  return originalPos;
}
