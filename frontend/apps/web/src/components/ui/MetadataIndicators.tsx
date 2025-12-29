'use client';

import { FileText, ExternalLink } from 'lucide-react';
import { HTMLAttributes } from 'react';

interface MetadataIndicatorsProps extends HTMLAttributes<HTMLDivElement> {
  /** Section references a specific form */
  hasForm?: boolean | null;
  /** Section incorporates external standards by reference (IBR) */
  hasIbr?: boolean | null;
  /** Size of icons */
  size?: 'sm' | 'md';
}

/**
 * Component for displaying metadata indicator icons for form references
 * and incorporation by reference (external standards).
 *
 * @example
 * <MetadataIndicators hasForm hasIbr />
 *
 * @example
 * <MetadataIndicators hasForm={document.hasForm} hasIbr={document.hasIbr} size="md" />
 */
export function MetadataIndicators({
  hasForm,
  hasIbr,
  size = 'sm',
  className = '',
  ...props
}: MetadataIndicatorsProps) {
  if (!hasForm && !hasIbr) return null;

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className={`flex items-center gap-1.5 ${className}`} {...props}>
      {hasForm && (
        <span
          title="References a form"
          className="text-indigo-500 flex items-center"
        >
          <FileText className={iconSize} aria-hidden="true" />
          <span className="sr-only">References a form</span>
        </span>
      )}
      {hasIbr && (
        <span
          title="Incorporates external standards (ASTM, NFPA, ISO, etc.)"
          className="text-green-600 flex items-center"
        >
          <ExternalLink className={iconSize} aria-hidden="true" />
          <span className="sr-only">Incorporates external standards</span>
        </span>
      )}
    </div>
  );
}

export default MetadataIndicators;
