import Markdown from 'react-markdown';

interface DecisionRationaleProps {
  tier1Reasoning: string | null;
  tier2Reasoning: string | null;
  tier3Reasoning: string | null;
}

const sections = [
  { key: 'tier3Reasoning', label: 'Web Search' },
  { key: 'tier2Reasoning', label: 'Full Justification' },
  { key: 'tier1Reasoning', label: 'Filtering' },
] as const;

export function DecisionRationale({ tier1Reasoning, tier2Reasoning, tier3Reasoning }: DecisionRationaleProps) {
  const values: Record<string, string | null> = { tier1Reasoning, tier2Reasoning, tier3Reasoning };
  const activeSections = sections.filter(s => values[s.key]);

  if (activeSections.length === 0) return null;

  return (
    <div className="pt-3 border-t border-[var(--color-primary)]/10 space-y-3">
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">Decision Rationale</span>
      {activeSections.map(({ key, label }) => (
        <div key={key}>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
          <div className="mt-0.5 text-sm text-[var(--color-text)] prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
            <Markdown>{values[key]!}</Markdown>
          </div>
        </div>
      ))}
    </div>
  );
}
