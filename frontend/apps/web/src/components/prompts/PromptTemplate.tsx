'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface PromptTemplateProps {
  template: string;
  maxLines?: number;
  className?: string;
}

/**
 * Displays a prompt template with syntax highlighting for variables
 * and expand/collapse functionality for long templates
 */
export function PromptTemplate({
  template,
  maxLines = 15,
  className = '',
}: PromptTemplateProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = template.split('\n');
  const isLongTemplate = lines.length > maxLines;
  const displayLines = isExpanded ? lines : lines.slice(0, maxLines);

  // Highlight {variable} placeholders
  const highlightVariables = (text: string) => {
    const parts = text.split(/(\{[^}]+\})/g);
    return parts.map((part, i) => {
      if (part.match(/^\{[^}]+\}$/)) {
        return (
          <span
            key={i}
            className="bg-[var(--color-info-weak)] text-[var(--color-info)] px-1 rounded"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Copy button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10"
        aria-label={copied ? 'Copied!' : 'Copy template'}
      >
        {copied ? (
          <Check className="w-4 h-4 text-[var(--color-success)]" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>

      {/* Template content */}
      <pre
        className={`
          font-mono text-sm bg-[var(--color-neutral-50)]
          rounded-[var(--radius-md)] p-4 pr-12
          overflow-x-auto whitespace-pre-wrap break-words
          text-[var(--color-text-secondary)]
          border border-[var(--color-neutral-200)]
        `}
      >
        {displayLines.map((line, i) => (
          <div key={i} className="min-h-[1.4em]">
            {highlightVariables(line)}
          </div>
        ))}
        {isLongTemplate && !isExpanded && (
          <div className="text-[var(--color-text-muted)] italic mt-2">
            ... {lines.length - maxLines} more lines
          </div>
        )}
      </pre>

      {/* Expand/collapse button */}
      {isLongTemplate && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs flex items-center gap-1"
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show full template ({lines.length} lines)
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export default PromptTemplate;
