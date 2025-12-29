'use client';

import { useQueryStates } from 'nuqs';
import { Filter, Sparkles } from 'lucide-react';
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

export function ComplianceQueueModeSwitcher({ mode }: ComplianceQueueModeSwitcherProps) {
  const [, setParams] = useQueryStates(
    {
      queueMode: queueModeParser,
      // Suggestion mode params
      groupingMode: groupingModeParser,
      batchSize: batchSizeParser,
      shownIds: shownIdsParser,
      focusType: focusTypeParser,
      focusSection: focusSectionParser,
      focusPattern: focusPatternParser,
      // Filter mode params
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
      // Switch to suggestion mode: clear filter params, set suggestion defaults
      setParams({
        queueMode: 'suggestion',
        groupingMode: 'issue_type',
        batchSize: 3,
        shownIds: null,
        focusType: null,
        focusSection: null,
        focusPattern: null,
        // Clear filter params
        page: null,
        reviewStatus: null,
        severity: null,
        issueType: null,
        statuteSource: null,
        sortBy: null,
        sortOrder: null,
      });
    } else {
      // Switch to filter mode: clear suggestion params, set filter defaults
      setParams({
        queueMode: 'filter',
        // Clear suggestion params
        groupingMode: null,
        batchSize: null,
        shownIds: null,
        focusType: null,
        focusSection: null,
        focusPattern: null,
        // Set filter defaults
        page: 1,
        reviewStatus: 'unreviewed',
        requirementFound: 'true',
        severity: 'all',
      });
    }
  };

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)]">
      <button
        onClick={() => handleModeChange('filter')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
          transition-all duration-[var(--duration-fast)]
          ${
            mode === 'filter'
              ? 'bg-white text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
          }
        `}
      >
        <Filter className="w-4 h-4" />
        Manual Filters
      </button>
      <button
        onClick={() => handleModeChange('suggestion')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
          transition-all duration-[var(--duration-fast)]
          ${
            mode === 'suggestion'
              ? 'bg-white text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
          }
        `}
      >
        <Sparkles className="w-4 h-4" />
        Smart Suggestions
      </button>
    </div>
  );
}

export default ComplianceQueueModeSwitcher;
