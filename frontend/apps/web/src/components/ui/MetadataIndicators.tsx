'use client';

import { FileText } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { HTMLAttributes } from 'react';
import { ClickableTag } from '@/components/tags/ClickableTag';

interface MetadataIndicatorsProps extends HTMLAttributes<HTMLDivElement> {
  /** Section references a specific form */
  hasForm?: boolean | null;
  /** Section incorporates external standards by reference (IBR) */
  hasIbr?: boolean | null;
  /** Size of icons */
  size?: 'sm' | 'md';
  /** When provided, wraps indicators with ClickableTag using prefix + '_has_form' / '_has_ibr' */
  tagFieldPrefix?: string;
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
  tagFieldPrefix,
  className = '',
  ...props
}: MetadataIndicatorsProps) {
  if (!hasForm && !hasIbr) return null;

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const IbrIcon = getEntityIcon('ibr_standard');

  const formIndicator = (
    <span
      title="References a form"
      className="text-indigo-500 flex items-center"
    >
      <FileText className={iconSize} aria-hidden="true" />
      <span className="sr-only">References a form</span>
    </span>
  );

  const ibrIndicator = (
    <span
      title="Incorporates external standards (ASTM, NFPA, ISO, etc.)"
      className="text-emerald-600 flex items-center"
    >
      <IbrIcon className={iconSize} aria-hidden="true" />
      <span className="sr-only">Incorporates external standards</span>
    </span>
  );

  return (
    <div className={`flex items-center gap-1.5 ${className}`} {...props}>
      {hasForm && (
        tagFieldPrefix ? (
          <ClickableTag field={`${tagFieldPrefix}_has_form`} value="true">
            {formIndicator}
          </ClickableTag>
        ) : (
          formIndicator
        )
      )}
      {hasIbr && (
        tagFieldPrefix ? (
          <ClickableTag field={`${tagFieldPrefix}_has_ibr`} value="true">
            {ibrIndicator}
          </ClickableTag>
        ) : (
          ibrIndicator
        )
      )}
    </div>
  );
}

export default MetadataIndicators;
