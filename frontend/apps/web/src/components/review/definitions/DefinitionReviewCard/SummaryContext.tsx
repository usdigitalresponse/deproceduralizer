import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import type { SummaryContextProps } from './types';

export function SummaryContext({ regulation }: SummaryContextProps) {
  if (!regulation) return null;

  const hasContent = regulation.summary || regulation.sectionType || regulation.hasForm || regulation.hasIbr;
  if (!hasContent) return null;

  return (
    <div className="bg-[var(--color-neutral-50)] rounded p-2 mb-4">
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
  );
}
