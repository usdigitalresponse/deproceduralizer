'use client';

interface RegulationContentProps {
  content: string | null | undefined;
  /** Whether to show the heading (default: true) */
  showHeading?: boolean;
  /** Max height before scrolling (default: '16rem' for modals, 'none' for full page) */
  maxHeight?: string;
  /** Max characters to show before truncating (default: no truncation) */
  truncateAt?: number;
  /** Custom heading text (default: 'Regulation Text') */
  heading?: string;
  className?: string;
}

/**
 * Displays the regulation text content with optional truncation and scrolling.
 * Used in DetailModal, DetailPanel, and regulation detail page.
 *
 * @example
 * // Full content with scroll in modal
 * <RegulationContent content={regulation.content} maxHeight="16rem" />
 *
 * @example
 * // Truncated preview
 * <RegulationContent
 *   content={regulation.content}
 *   truncateAt={500}
 *   heading="Content Preview"
 * />
 */
export function RegulationContent({
  content,
  showHeading = true,
  maxHeight = '16rem',
  truncateAt,
  heading = 'Regulation Text',
  className = '',
}: RegulationContentProps) {
  const normalizedContent = normalizeLineBreaks(content || 'No content available');
  const isTruncated = truncateAt && normalizedContent.length > truncateAt;
  const finalContent = isTruncated
    ? normalizedContent.substring(0, truncateAt) + '...'
    : normalizedContent;

  const heightStyles = maxHeight && maxHeight !== 'none'
    ? { maxHeight, overflowY: 'auto' as const }
    : {};

  return (
    <div className={className}>
      {showHeading && (
        <h3 className="font-semibold text-[var(--color-text)] mb-3">{heading}</h3>
      )}
      <div
        className="bg-[var(--color-neutral-50)] border-l-4 border-[var(--color-neutral-400)] p-4 rounded-[var(--radius-md)] text-sm leading-relaxed whitespace-pre-wrap"
        style={heightStyles}
      >
        {finalContent}
      </div>
    </div>
  );
}

/**
 * Collapse hard line breaks into spaces while preserving structural breaks.
 *
 * Source text from scraped statutes/regulations has fixed-width wrapping
 * at ~70 chars. Content may contain real newlines OR literal escaped "\n".
 *
 * Patterns:
 * - `\n ` (newline + leading space) = structural sub-section (e.g. " 2.", " (a)")
 * - `\n` followed by non-space = hard wrap artifact, collapse to space
 * - `\n\n` = paragraph break, preserve
 */
function normalizeLineBreaks(text: string): string {
  // First, convert literal escaped \n sequences to real newlines
  const unescaped = text.replace(/\\n/g, '\n');

  return unescaped
    .split(/\n{2,}/)
    .map(paragraph =>
      paragraph
        .replace(/\n(?! )/g, ' ')
        .replace(/ {2,}/g, ' ')
        .trim()
    )
    .join('\n\n');
}

export default RegulationContent;
