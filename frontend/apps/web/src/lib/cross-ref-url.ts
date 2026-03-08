import type { CrossRefMatch } from '@/hooks/useCrossRefHighlighting';

/**
 * Get the target URL for a cross-reference link.
 * Returns null if neither target is set (unresolved ref).
 */
export function getCrossRefTargetUrl(
  state: string,
  crossRef: Pick<CrossRefMatch, 'targetDocumentId' | 'targetGuidanceId'>
): string | null {
  if (crossRef.targetGuidanceId) {
    return `/${state}/guidance/${crossRef.targetGuidanceId}`;
  }
  if (crossRef.targetDocumentId) {
    return `/${state}/regulations/${crossRef.targetDocumentId}`;
  }
  return null;
}

/**
 * Get the link text for a cross-reference based on its target type.
 */
export function getCrossRefLinkText(
  crossRef: Pick<CrossRefMatch, 'targetGuidanceId'>
): string {
  return crossRef.targetGuidanceId
    ? 'View referenced guidance'
    : 'View referenced document';
}
