import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { KeywordTags } from '@/components/ui/KeywordTags';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import type { MetadataSectionProps } from './types';

export function MetadataSection({ document }: MetadataSectionProps) {
  const hasContent = document.sectionType || document.keywords?.length || document.appliesTo?.length || document.hasForm || document.hasIbr;

  if (!hasContent) return null;

  return (
    <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {document.sectionType && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">Type:</span>
            <SectionTypeBadge type={document.sectionType} />
          </div>
        )}
        <MetadataIndicators hasForm={document.hasForm} hasIbr={document.hasIbr} size="md" />
      </div>

      {document.appliesTo && document.appliesTo.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Applies to:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {document.appliesTo.map((entity) => (
              <span
                key={entity}
                className="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-xs"
              >
                {entity}
              </span>
            ))}
          </div>
        </div>
      )}

      {document.keywords && document.keywords.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Keywords:</span>
          <div className="mt-1">
            <KeywordTags keywords={document.keywords} maxDisplay={10} />
          </div>
        </div>
      )}
    </div>
  );
}
