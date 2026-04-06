'use client';

import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export interface AdvancedFilterToggleProps {
  isOpen: boolean;
  onClick: () => void;
  label?: string;
  activeCount?: number;
}

export function AdvancedFilterToggle({
  isOpen,
  onClick,
  label = 'More Filters',
  activeCount = 0,
}: AdvancedFilterToggleProps) {
  const hasActive = activeCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5
        px-3 py-1.5 rounded-[var(--radius-md)]
        text-xs font-medium
        transition-colors duration-[var(--duration-fast)]
        cursor-pointer
        ${hasActive
          ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)] border border-[var(--color-primary-weak)]'
          : 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-200)]'
        }
      `}
      aria-expanded={isOpen}
    >
      <SlidersHorizontal className="w-3.5 h-3.5" />
      {label}
      {hasActive && (
        <Badge variant="info" className="text-[10px] ml-0.5">
          {activeCount}
        </Badge>
      )}
      <ChevronDown
        className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
  );
}
