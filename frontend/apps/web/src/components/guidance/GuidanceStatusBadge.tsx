'use client';

import { Badge } from '@/components/ui/Badge';

const STATUS_CONFIG: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  superseded: { variant: 'warning', label: 'Superseded' },
  canceled: { variant: 'danger', label: 'Canceled' },
  expired: { variant: 'default', label: 'Expired' },
};

interface GuidanceStatusBadgeProps {
  status: string | null;
}

export function GuidanceStatusBadge({ status }: GuidanceStatusBadgeProps) {
  const config = status ? STATUS_CONFIG[status.toLowerCase()] : null;
  if (!config) {
    return <Badge variant="default">{status ?? 'Unknown'}</Badge>;
  }
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
