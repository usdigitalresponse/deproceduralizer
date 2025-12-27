'use client';

import { useQueryStates } from 'nuqs';
import { ClipboardList, Code2 } from 'lucide-react';
import type { ReviewMode } from '@/types/regulation';
import {
  reviewModeParser,
  developerStatusParser,
  developerAssignedParser,
  reviewStatusParser,
  pageParser,
} from '@/lib/url/parsers';

interface ReviewModeSwitcherProps {
  mode: ReviewMode;
}

export function ReviewModeSwitcher({ mode }: ReviewModeSwitcherProps) {
  const [, setParams] = useQueryStates(
    {
      mode: reviewModeParser,
      developerStatus: developerStatusParser,
      developerAssigned: developerAssignedParser,
      reviewStatus: reviewStatusParser,
      page: pageParser,
    },
    { shallow: false } // Preserve other query params
  );

  const handleModeChange = (newMode: ReviewMode) => {
    if (newMode === mode) return;

    if (newMode === 'developer') {
      setParams({
        mode: 'developer',
        reviewStatus: null, // Remove reviewStatus
        developerStatus: 'all',
        page: 1,
      });
    } else {
      setParams({
        mode: null, // Remove mode (defaults to 'review')
        developerStatus: null,
        developerAssigned: null,
        reviewStatus: 'unreviewed',
        page: 1,
      });
    }
  };

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] mb-3">
      <button
        onClick={() => handleModeChange('review')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
          transition-all duration-[var(--duration-fast)]
          ${
            mode === 'review'
              ? 'bg-white text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
          }
        `}
      >
        <ClipboardList className="w-4 h-4" />
        Review Mode
      </button>
      <button
        onClick={() => handleModeChange('developer')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
          transition-all duration-[var(--duration-fast)]
          ${
            mode === 'developer'
              ? 'bg-white text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
          }
        `}
      >
        <Code2 className="w-4 h-4" />
        Developer Mode
      </button>
    </div>
  );
}

export default ReviewModeSwitcher;
