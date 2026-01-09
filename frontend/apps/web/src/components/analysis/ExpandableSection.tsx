'use client';

import { useState, ReactNode } from 'react';
import { usePrintMode } from './PrintModeContext';

interface ExpandableSectionProps {
  label: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * ExpandableSection - Collapsible "Show more" section for progressive disclosure
 *
 * Used to hide detailed information by default while making it accessible
 * when the user wants to see more.
 *
 * In print mode, content is always expanded and toggle button is hidden.
 */
export function ExpandableSection({
  label,
  children,
  defaultExpanded = false,
  className = '',
}: ExpandableSectionProps) {
  const { isPrintMode } = usePrintMode();
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  // In print mode, always expand
  const isExpanded = isPrintMode || localExpanded;

  return (
    <div className={`${className}`}>
      {/* Hide toggle button in print mode */}
      {!isPrintMode && (
        <button
          type="button"
          onClick={() => setLocalExpanded(!localExpanded)}
          className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors print:hidden"
        >
          <span
            className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          >
            ▶
          </span>
          <span>{isExpanded ? 'Hide' : label}</span>
        </button>
      )}

      {/* In print mode, show label as a heading instead of toggle */}
      {isPrintMode && (
        <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1">
          {label}
        </div>
      )}

      {isExpanded && (
        <div className={`${isPrintMode ? '' : 'mt-2'} pl-4 border-l-2 border-[var(--color-neutral-200)]`}>
          {children}
        </div>
      )}
    </div>
  );
}

export default ExpandableSection;
