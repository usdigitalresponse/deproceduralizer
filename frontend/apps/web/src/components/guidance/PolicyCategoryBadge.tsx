'use client';

import { Badge } from '@/components/ui/Badge';

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
}

export function PolicyCategoryBadge({ category }: PolicyCategoryBadgeProps) {
  const config = category ? CATEGORY_CONFIG[category.toLowerCase()] : null;
  if (!config) {
    return <Badge variant="default">{category ?? 'Unclassified'}</Badge>;
  }
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
