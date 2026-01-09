'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, Loader2 } from 'lucide-react';
import type { IssueTypeOption } from './types';

interface IssueSelectorProps {
  issueTypes: IssueTypeOption[];
  selectedIssue: string | null;
  onSelect: (issueType: string) => void;
  isLoading?: boolean;
}

export function IssueSelector({
  issueTypes,
  selectedIssue,
  onSelect,
  isLoading = false,
}: IssueSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Group by category
  const groupedIssues = useMemo(() => {
    const filtered = issueTypes.filter(
      (i) =>
        i.displayName.toLowerCase().includes(search.toLowerCase()) ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase())
    );

    const groups: Record<string, IssueTypeOption[]> = {};
    filtered.forEach((issue) => {
      if (!groups[issue.category]) groups[issue.category] = [];
      groups[issue.category].push(issue);
    });

    return groups;
  }, [issueTypes, search]);

  const selectedIssueData = issueTypes.find((i) => i.name === selectedIssue);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
        Select Issue Type
      </label>

      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-3
          bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)]
          text-left text-sm
          hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
          transition-colors
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Search className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
          {selectedIssueData ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[var(--color-text)] truncate">
                {selectedIssueData.displayName}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-neutral-100)] px-2 py-0.5 rounded flex-shrink-0">
                {selectedIssueData.category}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                {selectedIssueData.precision.toFixed(0)}% precision
              </span>
            </div>
          ) : (
            <span className="text-[var(--color-text-muted)]">
              Select an issue type to view prompts...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />}
          <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] shadow-lg max-h-[400px] overflow-hidden">
            {/* Search Input */}
            <div className="p-2 border-b border-[var(--color-neutral-100)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Search issue types..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Options */}
            <div className="overflow-y-auto max-h-[320px]">
              {Object.entries(groupedIssues).map(([category, issues]) => (
                <div key={category}>
                  {/* Category Header */}
                  <div className="px-3 py-2 bg-[var(--color-neutral-50)] text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide sticky top-0">
                    {category} ({issues.length})
                  </div>

                  {/* Issue Options */}
                  {issues.map((issue) => (
                    <button
                      key={issue.name}
                      onClick={() => {
                        onSelect(issue.name);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={`
                        w-full flex items-center justify-between px-4 py-2.5 text-left text-sm
                        hover:bg-[var(--color-primary-faint)] transition-colors
                        ${selectedIssue === issue.name ? 'bg-[var(--color-primary-weaker)]' : ''}
                      `}
                    >
                      <span className="text-[var(--color-text)]">
                        {issue.displayName}
                      </span>
                      <span className={`
                        text-xs px-2 py-0.5 rounded
                        ${issue.precision >= 70
                          ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                          : issue.precision >= 40
                          ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                          : 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]'
                        }
                      `}>
                        {issue.precision.toFixed(0)}%
                      </span>
                    </button>
                  ))}
                </div>
              ))}

              {Object.keys(groupedIssues).length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  No issue types match &quot;{search}&quot;
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
