'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Code, Calendar, Tag, Regex } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PromptTemplate } from './PromptTemplate';
import type { CompliancePromptData } from '@/lib/actions/prompts';

/**
 * Format a date string (YYYY-MM-DD) to a readable format (Dec 26, 2025)
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface CompliancePromptCardProps {
  prompt: CompliancePromptData;
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * Expandable card displaying a compliance issue prompt
 */
export function CompliancePromptCard({
  prompt,
  defaultExpanded = false,
  className = '',
}: CompliancePromptCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card
      id={`prompt-${prompt.name}`}
      padding="md"
      className={`hover:border-[var(--color-primary-weak)] transition-colors scroll-mt-24 ${className}`}
    >
      {/* Header - always visible */}
      <div
        className="flex items-start justify-between gap-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Code className="w-5 h-5 text-[var(--color-primary)]" />
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              {prompt.displayName}
            </h3>
            <Badge variant="default" className="text-xs">
              <Tag className="w-3 h-3 mr-1" />
              {prompt.category}
            </Badge>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
            {prompt.description}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-[var(--color-text-muted)] font-mono">
              {prompt.name}
            </span>
            {prompt.updatedAt && (
              <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                <Calendar className="w-3 h-3" />
                <span>Last updated: {formatDate(prompt.updatedAt)}</span>
              </div>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)] space-y-4">
          {/* Patterns */}
          {prompt.patterns.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--color-text)] mb-2 flex items-center gap-2">
                <Regex className="w-4 h-4" />
                Detection Patterns ({prompt.patterns.length})
              </h4>
              <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3 space-y-1">
                {prompt.patterns.map((pattern, i) => (
                  <code
                    key={i}
                    className="block text-xs font-mono text-[var(--color-text-secondary)] break-all"
                  >
                    {pattern}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* LLM Prompt */}
          {prompt.prompt && (
            <div className="space-y-3">
              {prompt.prompt.system && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">
                    System Prompt
                  </h4>
                  <PromptTemplate template={prompt.prompt.system} />
                </div>
              )}
              {prompt.prompt.template && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">
                    Template
                  </h4>
                  <PromptTemplate template={prompt.prompt.template} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default CompliancePromptCard;
