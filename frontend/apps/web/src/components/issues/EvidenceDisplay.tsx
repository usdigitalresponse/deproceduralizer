'use client';

import { useState, HTMLAttributes } from 'react';
import type { ContextEntry } from '@deproceduralizer/database';
import { usePrintMode } from '@/components/analysis/PrintModeContext';

interface EvidenceDisplayProps extends HTMLAttributes<HTMLDivElement> {
  contextUsed: ContextEntry[] | null;
  verbatimRequirements?: string[];
  compact?: boolean;
}

type ContextType = ContextEntry['type'];

const TYPE_LABELS: Record<ContextType, string> = {
  self: 'Document',
  hierarchy: 'Hierarchy',
  sibling: 'Sibling Sections',
  definition: 'Definitions',
  cross_reference: 'Cross References',
  statute: 'Statutes',
  web: 'Web Sources',
};

const TYPE_ICONS: Record<ContextType, string> = {
  self: '📄',
  hierarchy: '📊',
  sibling: '📑',
  definition: '📖',
  cross_reference: '🔗',
  statute: '⚖️',
  web: '🌐',
};

const TYPE_ORDER: ContextType[] = [
  'self',
  'hierarchy',
  'sibling',
  'definition',
  'cross_reference',
  'statute',
  'web',
];

function groupByType(entries: ContextEntry[]): Map<ContextType, ContextEntry[]> {
  const groups = new Map<ContextType, ContextEntry[]>();

  for (const entry of entries) {
    const existing = groups.get(entry.type) || [];
    existing.push(entry);
    groups.set(entry.type, existing);
  }

  return groups;
}

interface ContextGroupProps {
  type: ContextType;
  entries: ContextEntry[];
  defaultExpanded?: boolean;
  compact?: boolean;
}

function ContextGroup({ type, entries, defaultExpanded = false, compact = false }: ContextGroupProps) {
  const { isPrintMode } = usePrintMode();
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  // In print mode, always expand
  const isExpanded = isPrintMode || localExpanded;

  if (entries.length === 0) return null;

  return (
    <div className="border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden">
      {/* Header - simplified in print mode */}
      <div
        role={isPrintMode ? undefined : 'button'}
        tabIndex={isPrintMode ? undefined : 0}
        onClick={isPrintMode ? undefined : () => setLocalExpanded(!localExpanded)}
        onKeyDown={isPrintMode ? undefined : (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setLocalExpanded(!localExpanded);
          }
        }}
        className={`
          w-full flex items-center justify-between
          px-3 py-2
          bg-[var(--color-neutral-50)]
          ${!isPrintMode ? 'hover:bg-[var(--color-neutral-100)] cursor-pointer' : ''}
          transition-colors
          text-left
        `}
      >
        <div className="flex items-center gap-2">
          <span>{TYPE_ICONS[type]}</span>
          <span className="font-medium text-sm text-[var(--color-text-primary)]">
            {TYPE_LABELS[type]}
          </span>
          <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-neutral-200)] px-1.5 py-0.5 rounded">
            {entries.length}
          </span>
        </div>
        {/* Hide chevron in print mode */}
        {!isPrintMode && (
          <svg
            className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="divide-y divide-[var(--color-neutral-100)]">
          {entries.map((entry, index) => (
            <ContextEntryItem key={index} entry={entry} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ContextEntryItemProps {
  entry: ContextEntry;
  compact?: boolean;
}

function ContextEntryItem({ entry, compact = false }: ContextEntryItemProps) {
  return (
    <div className={`px-3 ${compact ? 'py-2' : 'py-3'}`}>
      {/* Identifier/Source */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {entry.type === 'web' && entry.url ? (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[var(--color-primary)] hover:underline truncate"
              title={entry.url}
            >
              {entry.title || entry.identifier}
              <svg className="inline-block w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {entry.identifier}
            </span>
          )}

          {/* Source type badge for web sources */}
          {entry.type === 'web' && entry.sourceType && (
            <WebSourceTypeBadge sourceType={entry.sourceType} />
          )}

          {/* Federal mandate indicator */}
          {entry.isMandate && (
            <span className="text-xs bg-[var(--color-danger-bg)] text-[var(--color-danger)] px-1.5 py-0.5 rounded">
              Federal Mandate
            </span>
          )}
        </div>
      </div>

      {/* Quote */}
      {entry.quote && !compact && (
        <blockquote className="mt-2 pl-3 border-l-2 border-[var(--color-neutral-300)] text-sm text-[var(--color-text-secondary)] italic">
          &ldquo;{entry.quote}&rdquo;
        </blockquote>
      )}

      {/* Summary (for hierarchy/cross-refs) */}
      {entry.summary && !compact && (
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {entry.summary}
        </p>
      )}

      {/* Relevance explanation */}
      <p className={`${compact ? 'mt-1' : 'mt-2'} text-xs text-[var(--color-text-muted)]`}>
        {entry.relevance}
      </p>

      {/* State discretion indicator */}
      {entry.stateDiscretion && entry.stateDiscretion !== 'none' && (
        <span className={`
          inline-block mt-1 text-xs px-1.5 py-0.5 rounded
          ${entry.stateDiscretion === 'full'
            ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
            : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
          }
        `}>
          State has {entry.stateDiscretion} discretion
        </span>
      )}
    </div>
  );
}

interface WebSourceTypeBadgeProps {
  sourceType: NonNullable<ContextEntry['sourceType']>;
}

function WebSourceTypeBadge({ sourceType }: WebSourceTypeBadgeProps) {
  const styles: Record<NonNullable<ContextEntry['sourceType']>, string> = {
    government: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    academic: 'bg-purple-100 text-purple-700',
    journalism: 'bg-amber-100 text-amber-700',
    advocacy: 'bg-rose-100 text-rose-700',
  };

  const labels: Record<NonNullable<ContextEntry['sourceType']>, string> = {
    government: 'Gov',
    academic: 'Academic',
    journalism: 'News',
    advocacy: 'Advocacy',
  };

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${styles[sourceType]}`}>
      {labels[sourceType]}
    </span>
  );
}

export function EvidenceDisplay({
  contextUsed,
  verbatimRequirements = [],
  compact = false,
  className = '',
  ...props
}: EvidenceDisplayProps) {
  if (!contextUsed || contextUsed.length === 0) {
    if (verbatimRequirements.length === 0) {
      return null;
    }
  }

  const groupedContext = contextUsed ? groupByType(contextUsed) : new Map();

  return (
    <div className={`space-y-3 ${className}`} {...props}>
      {/* Verbatim requirements */}
      {verbatimRequirements.length > 0 && (
        <div className="border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)]/30 rounded-[var(--radius-md)] p-3">
          <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
            <span>📋</span>
            <span>Verbatim Requirements</span>
          </h4>
          <ul className="space-y-2">
            {verbatimRequirements.map((req, index) => (
              <li key={index} className="text-sm text-[var(--color-text-secondary)]">
                <blockquote className="pl-3 border-l-2 border-[var(--color-warning)] italic">
                  &ldquo;{req}&rdquo;
                </blockquote>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Context by type */}
      {TYPE_ORDER.map((type) => {
        const entries = groupedContext.get(type);
        if (!entries || entries.length === 0) return null;

        // Expand by default if it's the main evidence types
        const defaultExpanded = type === 'statute' || type === 'definition' || type === 'web';

        return (
          <ContextGroup
            key={type}
            type={type}
            entries={entries}
            defaultExpanded={defaultExpanded}
            compact={compact}
          />
        );
      })}
    </div>
  );
}

export default EvidenceDisplay;
