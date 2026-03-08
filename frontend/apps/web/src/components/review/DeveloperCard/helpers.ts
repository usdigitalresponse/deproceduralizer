import { IMPACT_TYPES, formatLabel } from '@/types/regulation';

const PRIORITY_OPTIONS = [
  { value: '1', label: '1 - Lowest' },
  { value: '2', label: '2 - Low' },
  { value: '3', label: '3 - Medium' },
  { value: '4', label: '4 - High' },
  { value: '5', label: '5 - Highest' },
];

export const getPriorityLabel = (priority: number | null) => {
  if (!priority) return null;
  const option = PRIORITY_OPTIONS.find(o => o.value === String(priority));
  return option?.label || `P${priority}`;
};

export const getImpactLabel = (impact: string | null) => {
  if (!impact) return null;
  const option = IMPACT_TYPES.find(o => o.value === impact);
  return option?.label || formatLabel(impact);
};

export const getStatusVariant = (status: string | null) => {
  switch (status) {
    case 'resolved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'backlogged':
      return 'default';
    case 'need_more_info':
      return 'info';
    case 'unresolved':
    default:
      return 'danger';
  }
};
