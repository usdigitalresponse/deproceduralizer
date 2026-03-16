'use client';

import { HTMLAttributes } from 'react';
import { ClickableTag } from '@/components/tags/ClickableTag';

export type SectionType =
  | 'definitions'
  | 'requirements'
  | 'procedures'
  | 'prohibitions'
  | 'standards'
  | 'eligibility'
  | 'penalties'
  | 'fees'
  | 'forms'
  | 'reporting'
  | 'purpose'
  | 'scope'
  | 'exemptions'
  | 'reserved'
  | 'other';

interface SectionTypeBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  type: string | null | undefined;
  /** Show abbreviated version for compact displays */
  compact?: boolean;
  /** When provided, wraps the badge with ClickableTag using this field name */
  tagField?: string;
}

const SECTION_TYPE_STYLES: Record<SectionType, { bg: string; text: string }> = {
  definitions: { bg: 'bg-blue-100', text: 'text-blue-800' },
  requirements: { bg: 'bg-red-100', text: 'text-red-800' },
  procedures: { bg: 'bg-purple-100', text: 'text-purple-800' },
  prohibitions: { bg: 'bg-orange-100', text: 'text-orange-800' },
  standards: { bg: 'bg-green-100', text: 'text-green-800' },
  eligibility: { bg: 'bg-teal-100', text: 'text-teal-800' },
  penalties: { bg: 'bg-rose-100', text: 'text-rose-800' },
  fees: { bg: 'bg-amber-100', text: 'text-amber-800' },
  forms: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  reporting: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  purpose: { bg: 'bg-violet-100', text: 'text-violet-800' },
  scope: { bg: 'bg-slate-100', text: 'text-slate-800' },
  exemptions: { bg: 'bg-lime-100', text: 'text-lime-800' },
  reserved: { bg: 'bg-gray-100', text: 'text-gray-400' },
  other: { bg: 'bg-stone-100', text: 'text-stone-800' },
};

const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  definitions: 'Definitions',
  requirements: 'Requirements',
  procedures: 'Procedures',
  prohibitions: 'Prohibitions',
  standards: 'Standards',
  eligibility: 'Eligibility',
  penalties: 'Penalties',
  fees: 'Fees',
  forms: 'Forms',
  reporting: 'Reporting',
  purpose: 'Purpose',
  scope: 'Scope',
  exemptions: 'Exemptions',
  reserved: 'Reserved',
  other: 'Other',
};

const SECTION_TYPE_ABBREV: Record<SectionType, string> = {
  definitions: 'DEF',
  requirements: 'REQ',
  procedures: 'PROC',
  prohibitions: 'PROH',
  standards: 'STD',
  eligibility: 'ELIG',
  penalties: 'PEN',
  fees: 'FEES',
  forms: 'FORM',
  reporting: 'RPT',
  purpose: 'PURP',
  scope: 'SCOPE',
  exemptions: 'EXM',
  reserved: 'RES',
  other: 'OTHR',
};

/**
 * Badge component for displaying section type categorization.
 *
 * @example
 * <SectionTypeBadge type="definitions" />
 *
 * @example
 * <SectionTypeBadge type="requirements" compact />
 */
export function SectionTypeBadge({
  type,
  compact = false,
  tagField,
  className = '',
  ...props
}: SectionTypeBadgeProps) {
  if (!type) return null;

  const normalizedType = type.toLowerCase() as SectionType;
  const styles = SECTION_TYPE_STYLES[normalizedType] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
  };
  const label = compact
    ? SECTION_TYPE_ABBREV[normalizedType] ?? type.toUpperCase().slice(0, 4)
    : SECTION_TYPE_LABELS[normalizedType] ?? type;

  const badge = (
    <span
      className={`
        inline-flex items-center
        px-2 py-0.5
        text-xs font-medium
        rounded-full
        ${styles.bg}
        ${styles.text}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      title={compact ? SECTION_TYPE_LABELS[normalizedType] : undefined}
      {...props}
    >
      {label}
    </span>
  );

  if (tagField) {
    return (
      <ClickableTag field={tagField} value={type}>
        {badge}
      </ClickableTag>
    );
  }

  return badge;
}

export default SectionTypeBadge;
