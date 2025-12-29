'use client';

import { Tag, FolderOpen, Target, SkipForward, Trash2, Info } from 'lucide-react';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import type { GroupingModeValue, BatchSizeValue } from '@/lib/constants/values';
import { BATCH_SIZE_VALUES } from '@/lib/constants/values';

interface SuggestionModeControlsProps {
  groupingMode: GroupingModeValue;
  focus: {
    issueType?: string;
    section?: string;
    pattern?: string;
  };
  remainingInFocus: number;
  nextGroupingMode: GroupingModeValue;
  totalUnreviewed: number;
  batchSize: BatchSizeValue;
  shownCount: number;
  onSkipToNextMode: () => void;
  onClearHistory: () => void;
  onBatchSizeChange: (size: BatchSizeValue) => void;
}

const GROUPING_MODE_CONFIG: Record<GroupingModeValue, {
  icon: typeof Tag;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  issue_type: {
    icon: Tag,
    label: 'By Issue Type',
    description: 'Grouping similar issues together helps identify systematic false positives',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  section: {
    icon: FolderOpen,
    label: 'By Section',
    description: 'Reviewing issues from the same regulation section for context',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  combined: {
    icon: Target,
    label: 'By Type + Section',
    description: 'Focused review of the same issue type within a single section',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
};

const NEXT_MODE_LABELS: Record<GroupingModeValue, string> = {
  issue_type: 'group by issue type',
  section: 'group by section',
  combined: 'group by type + section',
};

function getFocusLabel(
  groupingMode: GroupingModeValue,
  focus: SuggestionModeControlsProps['focus']
): string {
  const issueTypeLabel = focus.issueType
    ? ISSUE_TYPE_LABELS[focus.issueType] || focus.issueType
    : null;
  const sectionLabel = focus.section ? `Title ${focus.section}` : null;

  switch (groupingMode) {
    case 'issue_type':
      return issueTypeLabel || 'Unknown type';
    case 'section':
      return sectionLabel || 'Unknown section';
    case 'combined':
      if (issueTypeLabel && sectionLabel) {
        return `${issueTypeLabel} in ${sectionLabel}`;
      }
      return issueTypeLabel || sectionLabel || 'Unknown';
    default:
      return 'Unknown';
  }
}

export function SuggestionModeControls({
  groupingMode,
  focus,
  remainingInFocus,
  nextGroupingMode,
  totalUnreviewed,
  batchSize,
  shownCount,
  onSkipToNextMode,
  onClearHistory,
  onBatchSizeChange,
}: SuggestionModeControlsProps) {
  const config = GROUPING_MODE_CONFIG[groupingMode];
  const nextConfig = GROUPING_MODE_CONFIG[nextGroupingMode];
  const Icon = config.icon;
  const NextIcon = nextConfig.icon;
  const focusLabel = getFocusLabel(groupingMode, focus);

  return (
    <div className="bg-[var(--color-neutral-50)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4 space-y-4">
      {/* How it works explanation */}
      <div className="flex items-start gap-3 p-3 bg-white rounded-[var(--radius-md)] border border-[var(--color-border)]">
        <Info className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-[var(--color-text-secondary)]">
          <span className="font-medium text-[var(--color-text)]">Smart Suggestions</span> groups similar items together so you can identify patterns.
          Items cycle through three grouping strategies: by issue type, by regulation section, then both combined.
          Only LLM-confirmed issues are shown.
        </div>
      </div>

      {/* Current mode and focus */}
      <div className="flex items-start justify-between">
        <div>
          <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${config.bgColor} mb-2`}>
            <Icon className={`w-4 h-4 ${config.color}`} />
            <span className={`text-sm font-medium ${config.color}`}>
              {config.label}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">
            {focusLabel}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {config.description}
          </p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            {remainingInFocus.toLocaleString()} more {remainingInFocus === 1 ? 'item' : 'items'} in this group
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] justify-end mb-1">
            <span>Then:</span>
            <NextIcon className={`w-3.5 h-3.5 ${nextConfig.color}`} />
            <span>{NEXT_MODE_LABELS[nextGroupingMode]}</span>
          </div>
          <p className="text-2xl font-semibold text-[var(--color-text)]">
            {totalUnreviewed.toLocaleString()}
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            total remaining
          </p>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
        {/* Batch size selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Items per batch:
          </span>
          <div className="inline-flex gap-1">
            {BATCH_SIZE_VALUES.map((size) => (
              <button
                key={size}
                onClick={() => onBatchSizeChange(size)}
                className={`
                  w-8 h-8 rounded-[var(--radius-md)] text-sm font-medium
                  transition-all duration-[var(--duration-fast)]
                  ${
                    batchSize === size
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-100)] border border-[var(--color-border)]'
                  }
                `}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {shownCount > 0 && (
            <span className="text-sm text-[var(--color-text-tertiary)]">
              {shownCount} reviewed this session
            </span>
          )}
          <button
            onClick={onSkipToNextMode}
            title="Skip to next grouping strategy"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
              text-[var(--color-text-secondary)] hover:text-[var(--color-text)]
              bg-white hover:bg-[var(--color-neutral-100)]
              border border-[var(--color-border)] rounded-[var(--radius-md)]
              transition-all duration-[var(--duration-fast)]"
          >
            <SkipForward className="w-4 h-4" />
            Skip Group
          </button>
          <button
            onClick={onClearHistory}
            title="Clear session history and start fresh"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
              text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]
              bg-white hover:bg-red-50
              border border-[var(--color-border)] rounded-[var(--radius-md)]
              transition-all duration-[var(--duration-fast)]"
          >
            <Trash2 className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default SuggestionModeControls;
