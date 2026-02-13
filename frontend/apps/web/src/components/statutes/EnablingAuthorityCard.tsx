import Link from 'next/link';
import { Scale } from 'lucide-react';
import type { RegulationStatuteLinkWithStatute } from '@deproceduralizer/database';

interface EnablingAuthorityCardProps {
  /** Enabling authority statute links */
  links: RegulationStatuteLinkWithStatute[];
  /** State code for constructing links */
  state: string;
}

/**
 * Info-blue card displaying enabling authority statutes for a regulation.
 * Only render when links array has items.
 */
export function EnablingAuthorityCard({ links, state }: EnablingAuthorityCardProps) {
  if (links.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-info-bg)] border border-[var(--color-info)] border-opacity-30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Scale className="w-4 h-4 text-[var(--color-info)]" />
        <h2 className="font-semibold text-[var(--color-text)] text-sm">
          Enabling Authority
        </h2>
      </div>

      <div className="space-y-2">
        {links.map((link) => (
          <div key={link.linkId} className="text-sm">
            {link.statute?.id ? (
              <Link
                href={`/${state}/statutes/${link.statute.id}`}
                className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] font-medium"
              >
                {link.citation}
              </Link>
            ) : (
              <span className="text-[var(--color-text)] font-medium">
                {link.citation}
              </span>
            )}
            {link.statute?.title && (
              <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                {link.statute.title}
              </p>
            )}
            {link.context && (
              <p className="text-[var(--color-text-secondary)] text-xs mt-1 italic">
                {link.context}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default EnablingAuthorityCard;
