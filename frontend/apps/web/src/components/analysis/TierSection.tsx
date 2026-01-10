'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ClassificationBadge } from '@/components/issues/TierClassificationFlow';
import { usePrintMode } from './PrintModeContext';

interface TierSectionProps {
  tierNumber: 1 | 2 | 3 | 4;
  title: string;
  classification: string | null;
  confidence?: number | null;
  completedAt: Date | null;
  isCompleted: boolean;
  children: React.ReactNode;
}

const TIER_COLORS = {
  1: 'var(--color-info)',
  2: 'var(--color-primary)',
  3: 'var(--color-warning)',
  4: 'var(--color-success)',
};

export function TierSection({
  tierNumber,
  title,
  classification,
  confidence,
  completedAt,
  isCompleted,
  children,
}: TierSectionProps) {
  const { isPrintMode } = usePrintMode();
  const [localExpanded, setLocalExpanded] = useState(isCompleted);
  // In print mode, always expand. Otherwise use local state.
  const isExpanded = isPrintMode || localExpanded;
  const color = TIER_COLORS[tierNumber];

  return (
    <div
      className={`
        border rounded-[var(--radius-md)] overflow-hidden
        ${isCompleted
          ? 'border-l-4 border-l-[var(--color-neutral-400)] border-[var(--color-neutral-200)]'
          : 'border-dashed border-[var(--color-neutral-300)] opacity-60'
        }
      `}
      style={isCompleted ? { borderLeftColor: color } : undefined}
    >
      {/* Header */}
      <div
        role={isPrintMode ? undefined : 'button'}
        tabIndex={isPrintMode || !isCompleted ? undefined : 0}
        onClick={isPrintMode ? undefined : () => setLocalExpanded(!localExpanded)}
        onKeyDown={isPrintMode ? undefined : (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setLocalExpanded(!localExpanded);
          }
        }}
        className={`
          w-full flex items-center justify-between p-4 bg-[var(--color-neutral-50)] text-left
          ${!isPrintMode && isCompleted ? 'hover:bg-[var(--color-neutral-100)] cursor-pointer' : ''}
          transition-colors
        `}
      >
        <div className="flex items-center gap-3">
          {/* Tier badge */}
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold print:w-6 print:h-6 print:text-xs"
            style={{ backgroundColor: isCompleted ? color : 'var(--color-neutral-300)' }}
          >
            T{tierNumber}
          </span>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--color-text)]">{title}</span>
              {classification && (
                <ClassificationBadge classification={classification} />
              )}
            </div>
            {completedAt && (
              <span className="text-xs text-[var(--color-text-muted)]">
                Completed: {new Date(completedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {confidence !== null && confidence !== undefined && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {(confidence * 100).toFixed(0)}% confidence
            </span>
          )}
          {/* Hide chevron in print mode */}
          {isCompleted && !isPrintMode && (
            isExpanded ? (
              <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
            )
          )}
        </div>
      </div>

      {/* Content */}
      {isCompleted && isExpanded && (
        <div className="p-4 border-t border-[var(--color-neutral-200)] bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

export default TierSection;
