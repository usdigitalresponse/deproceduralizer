'use client';

import { FilterBar, FilterField, Select } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';

interface PipelineFiltersProps {
  issueType: string | null;
  onIssueTypeChange: (value: string | null) => void;
  availableIssueTypes: string[];
}

export function PipelineFilters({
  issueType,
  onIssueTypeChange,
  availableIssueTypes,
}: PipelineFiltersProps) {
  const issueTypeOptions: SelectOption[] = [
    { value: 'all', label: 'All Issue Types' },
    ...availableIssueTypes.map((type) => ({
      value: type,
      label: ISSUE_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    })),
  ];

  return (
    <FilterBar
      variant="panel"
      hasActiveFilters={issueType !== null}
      onClearFilters={() => onIssueTypeChange(null)}
    >
      <FilterField label="Issue Type" htmlFor="pipeline-issue-type">
        <Select
          id="pipeline-issue-type"
          options={issueTypeOptions}
          value={issueType ?? 'all'}
          onValueChange={(value) => onIssueTypeChange(value === 'all' ? null : value)}
        />
      </FilterField>
    </FilterBar>
  );
}
