'use client';

import { Badge } from '@/components/ui/Badge';
import { ClickableTag } from '@/components/tags/ClickableTag';

const CATEGORY_CONFIG: Record<string, { variant: 'info' | 'warning' | 'success' | 'danger' | 'default'; label: string }> = {
  policy_directive: { variant: 'info', label: 'Policy Directive' },
  legal_interpretation: { variant: 'warning', label: 'Legal Interpretation' },
  tax_guidance: { variant: 'danger', label: 'Tax Guidance' },
  informational: { variant: 'success', label: 'Informational' },
  reference_material: { variant: 'default', label: 'Reference Material' },
  non_policy: { variant: 'default', label: 'Non-Policy' },
  data_dump: { variant: 'default', label: 'Data Dump' },
  unclassified: { variant: 'default', label: 'Unclassified' },
};

interface PolicyCategoryBadgeProps {
  category: string | null;
  /** When true, wraps the badge with ClickableTag for policy_category field */
  clickable?: boolean;
}

export function PolicyCategoryBadge({ category, clickable }: PolicyCategoryBadgeProps) {
  const config = category ? CATEGORY_CONFIG[category.toLowerCase()] : null;
  const badge = config
    ? <Badge variant={config.variant}>{config.label}</Badge>
    : <Badge variant="default">{category ?? 'Unclassified'}</Badge>;

  if (clickable && category) {
    return (
      <ClickableTag field="policy_category" value={category}>
        {badge}
      </ClickableTag>
    );
  }

  return badge;
}
