'use client';

import { Badge } from '@/components/ui/Badge';
import type { PromptVariable } from '@/lib/actions/prompts';

interface PromptVariablesProps {
  variables: PromptVariable[];
  className?: string;
}

/**
 * Displays a list of prompt variables as badges
 */
export function PromptVariables({ variables, className = '' }: PromptVariablesProps) {
  if (variables.length === 0) {
    return (
      <span className="text-sm text-[var(--color-text-muted)]">
        No variables
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {variables.map((variable) => (
        <Badge key={variable.name} variant="info">
          <code className="font-mono text-xs">{`{${variable.name}}`}</code>
        </Badge>
      ))}
    </div>
  );
}

export default PromptVariables;
