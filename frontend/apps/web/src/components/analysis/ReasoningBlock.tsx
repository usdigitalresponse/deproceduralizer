'use client';

import { useState } from 'react';
import Markdown from 'react-markdown';
import { usePrintMode } from './PrintModeContext';

interface ReasoningBlockProps {
  label: string;
  text: string | null;
  variant?: 'default' | 'for' | 'against';
  maxLength?: number;
}

const VARIANT_STYLES = {
  default: {
    bg: 'bg-[var(--color-neutral-50)]',
    border: 'border-[var(--color-neutral-200)]',
    label: 'text-[var(--color-text-secondary)]',
  },
  for: {
    bg: 'bg-[var(--color-success-bg)]',
    border: 'border-[var(--color-success)]/20',
    label: 'text-[var(--color-success)]',
  },
  against: {
    bg: 'bg-[var(--color-danger-bg)]',
    border: 'border-[var(--color-danger)]/20',
    label: 'text-[var(--color-danger)]',
  },
};

export function ReasoningBlock({
  label,
  text,
  variant = 'default',
  maxLength = 300,
}: ReasoningBlockProps) {
  const { isPrintMode } = usePrintMode();
  const [localExpanded, setLocalExpanded] = useState(false);
  const styles = VARIANT_STYLES[variant];

  if (!text) {
    return null;
  }

  const isLong = text.length > maxLength;
  // In print mode, always show full text
  const isExpanded = isPrintMode || localExpanded;
  const displayText = isExpanded || !isLong
    ? text
    : text.slice(0, maxLength) + '...';

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-[var(--radius-sm)] p-3`}>
      <h5 className={`text-xs font-semibold ${styles.label} mb-2`}>
        {label}
      </h5>
      <div className="text-sm text-[var(--color-text-secondary)] prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
        <Markdown>{displayText}</Markdown>
      </div>
      {/* Hide "Show more" button in print mode */}
      {isLong && !isPrintMode && (
        <button
          onClick={() => setLocalExpanded(!localExpanded)}
          className="mt-2 text-xs text-[var(--color-primary)] hover:underline print:hidden"
        >
          {localExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export default ReasoningBlock;
