import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import { Badge } from '@/components/ui';
import { HierarchyBreadcrumbsInline } from '../shared';
import type { SummaryContextProps } from './types';

export function SummaryContext({ regulation, state, citation, guidance }: SummaryContextProps) {
  // Guidance document context (for guidance-sourced compliance issues)
  if (guidance) {
    return (
      <div className="bg-[var(--color-warning-bg)] rounded p-2 mb-3">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {guidance.agency && <span className="text-xs font-medium text-[var(--color-text-secondary)]">{guidance.agency}</span>}
          {guidance.docType && <Badge variant="default" className="text-xs">{guidance.docType}</Badge>}
          {guidance.year && <span className="text-xs text-[var(--color-text-muted)]">{guidance.year}</span>}
        </div>
        {guidance.title && <p className="text-sm text-[var(--color-text)]">{guidance.title}</p>}
      </div>
    );
  }

  const hasSummaryContent = regulation.summary || regulation.sectionType || regulation.hasForm || regulation.hasIbr;

  return (
    <>
      {/* Summary context */}
      {hasSummaryContent && (
        <div className="bg-[var(--color-neutral-50)] rounded p-2 mb-3">
          {regulation.summary && (
            <p className="text-xs text-[var(--color-text-secondary)] mb-1 line-clamp-2">
              {regulation.summary}
            </p>
          )}
          <div className="flex items-center gap-2">
            {regulation.sectionType && (
              <SectionTypeBadge type={regulation.sectionType} compact />
            )}
            <MetadataIndicators hasForm={regulation.hasForm} hasIbr={regulation.hasIbr} />
          </div>
        </div>
      )}

      {/* Hierarchy breadcrumb */}
      <div className="mb-2">
        <HierarchyBreadcrumbsInline
          documentId={regulation.id}
          state={state}
        />
      </div>

      {/* Regulation context */}
      <div className="mb-4 text-sm">
        <span className="text-[var(--color-text-muted)]">
          {citation && <span className="font-mono">{citation}</span>}
          {citation && regulation.title && ' - '}
        </span>
        <span className="text-[var(--color-text-secondary)]">{regulation.title}</span>
      </div>
    </>
  );
}
