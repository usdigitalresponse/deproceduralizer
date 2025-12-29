'use client';

import { Table, LayoutGrid } from 'lucide-react';
import type { ViewModeValue } from '@/lib/constants/values';

interface ViewToggleProps {
  viewMode: ViewModeValue;
  onChange: (mode: ViewModeValue) => void;
}

/**
 * Toggle button group for switching between table and card grid views.
 */
export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--color-text-muted)]">View:</span>
      <div className="flex rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] overflow-hidden">
        <button
          type="button"
          onClick={() => onChange('table')}
          className={`
            flex items-center gap-1.5 px-3 py-1.5
            text-sm font-medium
            transition-colors duration-[var(--duration-fast)]
            ${
              viewMode === 'table'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-50)]'
            }
          `
            .trim()
            .replace(/\s+/g, ' ')}
          aria-pressed={viewMode === 'table'}
        >
          <Table className="w-4 h-4" />
          <span className="hidden sm:inline">Table</span>
        </button>
        <button
          type="button"
          onClick={() => onChange('cards')}
          className={`
            flex items-center gap-1.5 px-3 py-1.5
            text-sm font-medium
            border-l border-[var(--color-neutral-200)]
            transition-colors duration-[var(--duration-fast)]
            ${
              viewMode === 'cards'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-50)]'
            }
          `
            .trim()
            .replace(/\s+/g, ' ')}
          aria-pressed={viewMode === 'cards'}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="hidden sm:inline">Cards</span>
        </button>
      </div>
    </div>
  );
}
