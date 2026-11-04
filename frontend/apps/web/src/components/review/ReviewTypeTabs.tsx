'use client';

import { useQueryStates } from 'nuqs';
import { Badge } from '@/components/ui';
import { REVIEW_TYPES, type ReviewType, type ReviewMode } from '@/types/regulation';
import { Lightbulb } from 'lucide-react';
import { ComplianceAvatar } from './ComplianceAvatar';
import {
  reviewTypeParser,
  pageParser,
  categoryParser,
  developerStatusParser,
  developerAssignedParser,
} from '@/lib/url/parsers';

interface ReviewTypeTabsProps {
  activeType: ReviewType;
  counts: {
    compliance: number;
    definitions: number;
    needs_info: number;
    barriers: number;
  };
  mode?: ReviewMode;
}

export function ReviewTypeTabs({ activeType, counts, mode = 'review' }: ReviewTypeTabsProps) {
  const [, setParams] = useQueryStates(
    {
      type: reviewTypeParser,
      page: pageParser,
      category: categoryParser,
      issueType: categoryParser, // Same parser as category
      developerStatus: developerStatusParser,
      developerAssigned: developerAssignedParser,
    },
    { shallow: false } // Preserve other query params
  );

  const handleTabChange = (type: ReviewType) => {
    // Reset to page 1 and clear tab-specific filters when switching tabs
    setParams({
      type,
      page: 1,
      category: null,
      issueType: null,
      developerStatus: null,
      developerAssigned: null,
    });
  };

  const getCount = (type: ReviewType): number => {
    switch (type) {
      case 'compliance':
        return counts.compliance;
      case 'definitions':
        return counts.definitions;
      case 'needs_info':
        return counts.needs_info;
      case 'barriers':
        return counts.barriers;
      default:
        return 0;
    }
  };

  // Developer mode: show separate tabs for Compliance Issues, Definitions, and Needs Info
  if (mode === 'developer') {
    const isComplianceActive = activeType === 'compliance';
    const isDefinitionsActive = activeType === 'definitions';
    const isNeedsInfoActive = activeType === 'needs_info';
    const isBarrierActive = activeType === 'barriers';

    return (
      <div className="flex gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] mb-4">
        <button
          onClick={() => handleTabChange('compliance')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
            transition-all duration-[var(--duration-fast)]
            ${
              isComplianceActive
                ? 'bg-white text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
            }
          `}
        >
          <ComplianceAvatar size={22} />
          Compliance Issues
          {counts.compliance > 0 && (
            <Badge
              variant={isComplianceActive ? 'warning' : 'default'}
              className="text-xs"
            >
              {counts.compliance}
            </Badge>
          )}
        </button>
        <button
          onClick={() => handleTabChange('barriers')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
            transition-all duration-[var(--duration-fast)]
            ${
              isBarrierActive
                ? 'bg-white text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
            }
          `}
        >
          <Lightbulb size={18} aria-hidden="true" />
          Barriers
          {counts.barriers > 0 && (
            <Badge
              variant={isBarrierActive ? 'info' : 'default'}
              className="text-xs"
            >
              {counts.barriers}
            </Badge>
          )}
        </button>
        <button
          onClick={() => handleTabChange('definitions')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
            transition-all duration-[var(--duration-fast)]
            ${
              isDefinitionsActive
                ? 'bg-white text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
            }
          `}
        >
          Definitions
          {counts.definitions > 0 && (
            <Badge
              variant={isDefinitionsActive ? 'info' : 'default'}
              className="text-xs"
            >
              {counts.definitions}
            </Badge>
          )}
        </button>
        <button
          onClick={() => handleTabChange('needs_info')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
            transition-all duration-[var(--duration-fast)]
            ${
              isNeedsInfoActive
                ? 'bg-white text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
            }
          `}
        >
          Needs More Info
          {counts.needs_info > 0 && (
            <Badge
              variant={isNeedsInfoActive ? 'warning' : 'default'}
              className="text-xs"
            >
              {counts.needs_info}
            </Badge>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] mb-4">
      {REVIEW_TYPES.map((tab) => {
        const isActive = activeType === tab.value;
        const count = getCount(tab.value);

        return (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
              transition-all duration-[var(--duration-fast)]
              ${
                isActive
                  ? 'bg-white text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
              }
            `}
          >
            {tab.value === 'compliance' && <ComplianceAvatar size={22} />}
            {tab.value === 'barriers' && <Lightbulb size={18} aria-hidden="true" />}
            {tab.label}
            {count > 0 && (
              <Badge
                variant={isActive ? (tab.value === 'needs_info' ? 'warning' : 'info') : 'default'}
                className="text-xs"
              >
                {count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ReviewTypeTabs;
