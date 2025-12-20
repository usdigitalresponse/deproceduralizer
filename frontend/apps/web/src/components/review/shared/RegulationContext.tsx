'use client';

import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { formatNjacCitation } from '@/lib/formatters/njac';

interface RegulationContextProps {
  regulation: {
    id: number;
    title: string | null;
    state?: string | null;
    nycrrTitle?: number | null;
    nycrrPart?: string | null;
    nycrrSection?: string | null;
    njacTitle?: string | null;
    njacChapter?: string | null;
    njacSubchapter?: string | null;
  };
  className?: string;
}

/**
 * Displays regulation citation and title.
 * Formats citation based on state (NY uses NYCRR, NJ uses NJAC).
 *
 * @example
 * <RegulationContext regulation={flag.regulation} />
 */
export function RegulationContext({ regulation, className = '' }: RegulationContextProps) {
  // Format citation based on state
  const citation = regulation.state === 'NJ'
    ? formatNjacCitation(
        regulation.njacTitle ?? null,
        regulation.njacChapter ?? null,
        regulation.njacSubchapter ?? null
      )
    : formatNycrrCitation(
        regulation.nycrrTitle ?? null,
        regulation.nycrrPart ?? null,
        regulation.nycrrSection ?? null
      );

  return (
    <div className={`text-sm ${className}`}>
      {citation && (
        <span className="text-[var(--color-text-muted)] font-mono">{citation}</span>
      )}
      {citation && regulation.title && ' - '}
      <span className="text-[var(--color-text-secondary)]">{regulation.title}</span>
    </div>
  );
}

export default RegulationContext;
