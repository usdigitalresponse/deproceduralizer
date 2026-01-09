import { Tag } from '@/components/ui';
import type { TechnicalDetailsSectionProps } from './types';

export function TechnicalDetailsSection({ regexMatchPattern }: TechnicalDetailsSectionProps) {
  return (
    <details className="mb-4 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] group">
      <summary className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors list-none [&::-webkit-details-marker]:hidden">
        <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Technical Details
      </summary>
      <div className="mt-3 bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-3">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Pattern matched:</span>
        <div className="mt-1">
          <Tag variant="warning" size="sm">
            {regexMatchPattern}
          </Tag>
        </div>
      </div>
    </details>
  );
}
