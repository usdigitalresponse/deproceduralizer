'use client';

import { useQueryStates } from 'nuqs';
import { Filter, Sparkles } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui';
import type { QueueModeValue } from '@/lib/constants/values';
import {
  queueModeParser,
  groupingModeParser,
  batchSizeParser,
  shownIdsParser,
  focusTypeParser,
  focusSectionParser,
  focusPatternParser,
  pageParser,
  reviewStatusParser,
  severityParser,
  categoryParser,
  statuteSourceParser,
  requirementFoundParser,
  complianceSortByParser,
  sortOrderParser,
} from '@/lib/url/parsers';

interface ComplianceQueueModeSwitcherProps {
  mode: QueueModeValue;
}

const QUEUE_MODE_OPTIONS: SegmentedControlOption<QueueModeValue>[] = [
  { value: 'filter', label: 'Manual Filters', icon: Filter },
  { value: 'suggestion', label: 'Smart Suggestions', icon: Sparkles },
];

export function ComplianceQueueModeSwitcher({ mode }: ComplianceQueueModeSwitcherProps) {
  const [, setParams] = useQueryStates(
    {
      queueMode: queueModeParser,
      groupingMode: groupingModeParser,
      batchSize: batchSizeParser,
      shownIds: shownIdsParser,
      focusType: focusTypeParser,
      focusSection: focusSectionParser,
      focusPattern: focusPatternParser,
      page: pageParser,
      reviewStatus: reviewStatusParser,
      severity: severityParser,
      issueType: categoryParser,
      statuteSource: statuteSourceParser,
      requirementFound: requirementFoundParser,
      sortBy: complianceSortByParser,
      sortOrder: sortOrderParser,
    },
    { shallow: false }
  );

  const handleModeChange = (newMode: QueueModeValue) => {
    if (newMode === mode) return;

    if (newMode === 'suggestion') {
      setParams({
        queueMode: 'suggestion',
        groupingMode: 'issue_type',
        batchSize: 3,
        shownIds: null,
        focusType: null,
        focusSection: null,
        focusPattern: null,
        page: null,
        reviewStatus: null,
        severity: null,
        issueType: null,
        statuteSource: null,
        sortBy: null,
        sortOrder: null,
      });
    } else {
      setParams({
        queueMode: 'filter',
        groupingMode: null,
        batchSize: null,
        shownIds: null,
        focusType: null,
        focusSection: null,
        focusPattern: null,
        page: 1,
        reviewStatus: 'unreviewed',
        requirementFound: 'true',
        severity: 'all',
      });
    }
  };

  return (
    <SegmentedControl
      options={QUEUE_MODE_OPTIONS}
      value={mode}
      onChange={handleModeChange}
      variant="filled"
    />
  );
}

export default ComplianceQueueModeSwitcher;
