import { SeverityBadge, Tag } from '@/components/ui';
import { formatLabel } from '@/types/regulation';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { HierarchyBreadcrumbsInline, RegulationTextViewer } from '../../shared';
import type { RedFlagContentProps } from '../types';

export function RedFlagContent({ item, state }: RedFlagContentProps) {
  if (!item.redFlagData) return null;

  const flag = item.redFlagData;
  const nycrrCitation = formatNycrrCitation(
    flag.regulation.nycrrTitle,
    flag.regulation.nycrrPart,
    flag.regulation.nycrrSection
  );

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-[var(--color-text)]">{formatLabel(flag.category)}</span>
        <SeverityBadge severity={flag.severity} />
      </div>

      {/* Hierarchy breadcrumb */}
      <div className="mb-1">
        <HierarchyBreadcrumbsInline
          documentId={flag.regulation.id}
          state={state}
        />
      </div>

      <div className="text-sm text-[var(--color-text-muted)] mb-2">
        {nycrrCitation && <span className="font-mono">{nycrrCitation}</span>}
        {nycrrCitation && flag.regulation.title && ' - '}
        <span className="text-[var(--color-text-secondary)]">{flag.regulation.title}</span>
      </div>

      {/* Explanation */}
      <div className="mb-4">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Why Flagged:</span>
        <p className="mt-1 text-sm text-[var(--color-text)]">{flag.explanation}</p>
      </div>

      {/* Matched phrases */}
      {flag.matchedPhrases && flag.matchedPhrases.length > 0 && (
        <div className="mb-4">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Matched phrases:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {flag.matchedPhrases.map((phrase, i) => (
              <Tag key={i} variant="primary" size="sm">
                {phrase}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* Implementation approach */}
      {flag.implementationApproach && (
        <div className="mb-4 text-sm">
          <span className="font-medium text-[var(--color-text-secondary)]">Implementation:</span>
          <span className="ml-2 text-[var(--color-text)]">{flag.implementationApproach}</span>
        </div>
      )}

      {/* Full Regulation Text Viewer */}
      {(flag.regulation as unknown as { content?: string }).content && (
        <RegulationTextViewer
          content={(flag.regulation as unknown as { content: string }).content}
          documentId={flag.regulation.id}
          state={state}
          scrollToText={flag.explanation}
          highlightPattern={flag.matchedPhrases?.length ? flag.matchedPhrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : undefined}
          label="Show Regulation Text"
        />
      )}
    </>
  );
}
