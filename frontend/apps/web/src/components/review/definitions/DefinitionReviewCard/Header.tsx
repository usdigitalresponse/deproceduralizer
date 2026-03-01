import Link from 'next/link';
import { Badge } from '@/components/ui';
import { CopyLinkButton } from '@/components/ui/CopyLinkButton';
import { CornellLink } from '../../shared';
import type { HeaderProps } from './types';

export function Header({ definition, citation, jurisdiction, isSelected, onSelectionChange }: HeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        {onSelectionChange && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelectionChange(definition.id, e.target.checked)}
            className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          />
        )}
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">
            &ldquo;{definition.term}&rdquo;
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[var(--color-text-secondary)]">Source:</span>
            {definition.regulation ? (
              <>
                <Link
                  href={`/${jurisdiction.toLowerCase()}/regulations/${definition.regulation.id}`}
                  className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
                  target="_blank"
                >
                  {citation}
                </Link>
                <CornellLink url={definition.regulation.url} />
              </>
            ) : (
              <span className="text-[var(--color-text-secondary)]">Unknown source</span>
            )}

            {definition.scopeDocumentId && (
              <>
                <span className="text-[var(--color-text-secondary)] ml-2">Scope:</span>
                <Link
                  href={`/${jurisdiction.toLowerCase()}/regulations/${definition.scopeDocumentId}`}
                  className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
                  target="_blank"
                >
                  ID: {definition.scopeDocumentId}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {definition.reviewStatus === 'unreviewed' && (
          <Badge variant="default">Unreviewed</Badge>
        )}
        {definition.reviewStatus === 'confirmed' && (
          <Badge variant="success">Confirmed</Badge>
        )}
        {definition.reviewStatus === 'corrected' && (
          <Badge variant="warning">Corrected</Badge>
        )}
        {definition.reviewStatus === 'false_positive' && (
          <Badge variant="danger">False Positive</Badge>
        )}
        <CopyLinkButton anchor={`definition-${definition.id}`} />
      </div>
    </div>
  );
}
