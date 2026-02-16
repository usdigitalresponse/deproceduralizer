import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { RegulationQuickStats } from '@/components/regulations';
import { formatStateCitation } from '@/lib/formatters/citations';
import { formatDisplayTitle } from '@/lib/format';
import type { HeaderProps } from './types';

export function Header({ document, state, currentUrl, onClose }: HeaderProps) {
  const citation = formatStateCitation(state, document);

  return (
    <div className="p-4 border-b border-[var(--color-neutral-200)] shrink-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-text)] truncate" title={document.title}>
            {formatDisplayTitle(document)}
          </h2>
          {citation && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{citation}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/${state}/regulations/${document.id}?from=${encodeURIComponent(currentUrl)}`}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="w-4 h-4 mr-1" />
              Full Page
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <RegulationQuickStats regulation={document} className="mt-3" />
    </div>
  );
}
