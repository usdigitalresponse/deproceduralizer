'use client';

import { Table, LayoutGrid } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui';
import type { ViewModeValue } from '@/lib/constants/values';

interface ViewToggleProps {
  viewMode: ViewModeValue;
  onChange: (mode: ViewModeValue) => void;
}

const VIEW_OPTIONS: SegmentedControlOption<ViewModeValue>[] = [
  { value: 'table', label: 'Table', icon: Table },
  { value: 'cards', label: 'Cards', icon: LayoutGrid },
];

/**
 * Toggle button group for switching between table and card grid views.
 */
export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--color-text-muted)]">View:</span>
      <SegmentedControl
        options={VIEW_OPTIONS}
        value={viewMode}
        onChange={onChange}
        variant="outlined"
        size="sm"
        role="radiogroup"
      />
    </div>
  );
}
