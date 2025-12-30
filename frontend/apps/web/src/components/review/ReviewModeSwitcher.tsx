'use client';

import { useQueryStates } from 'nuqs';
import { ClipboardList, Code2 } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui';
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

const MODE_OPTIONS: SegmentedControlOption<ReviewMode>[] = [
  { value: 'review', label: 'Review Mode', icon: ClipboardList },
  { value: 'developer', label: 'Developer Mode', icon: Code2 },
];

export function ReviewModeSwitcher({ mode }: ReviewModeSwitcherProps) {
  const [, setParams] = useQueryStates(
    {
      mode: reviewModeParser,
      developerStatus: developerStatusParser,
      developerAssigned: developerAssignedParser,
      reviewStatus: reviewStatusParser,
      page: pageParser,
    },
    { shallow: false }
  );

  const handleModeChange = (newMode: ReviewMode) => {
    if (newMode === mode) return;

    if (newMode === 'developer') {
      setParams({
        mode: 'developer',
        reviewStatus: null,
        developerStatus: 'all',
        page: 1,
      });
    } else {
      setParams({
        mode: null,
        developerStatus: null,
        developerAssigned: null,
        reviewStatus: 'unreviewed',
        page: 1,
      });
    }
  };

  return (
    <SegmentedControl
      options={MODE_OPTIONS}
      value={mode}
      onChange={handleModeChange}
      variant="filled"
      className="mb-3"
    />
  );
}

export default ReviewModeSwitcher;
