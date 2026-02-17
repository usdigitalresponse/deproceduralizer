'use client';

import { useState, useEffect, useMemo } from 'react';
import { List, Code, Shield, Cpu } from 'lucide-react';
import type { PromptData, CompliancePromptData } from '@/lib/actions/prompts';

interface PromptNavProps {
  prompts: PromptData[];
  compliancePrompts?: CompliancePromptData[];
  jenaiPrompts?: PromptData[];
  className?: string;
}

/**
 * Sticky sidebar navigation for jumping to specific prompts
 */
export function PromptNav({
  prompts,
  compliancePrompts = [],
  jenaiPrompts = [],
  className = '',
}: PromptNavProps) {
  const [activePrompt, setActivePrompt] = useState<string | null>(null);

  // Group compliance prompts by category
  const complianceByCategory = useMemo(() => {
    const groups: Record<string, CompliancePromptData[]> = {};
    compliancePrompts.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [compliancePrompts]);

  // All prompt names for intersection observer
  const allPromptNames = useMemo(() => {
    return [
      ...prompts.map((p) => p.name),
      ...compliancePrompts.map((p) => p.name),
      ...jenaiPrompts.map((p) => p.name),
    ];
  }, [prompts, compliancePrompts, jenaiPrompts]);

  useEffect(() => {
    // Set up intersection observer to track which prompt is visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id.startsWith('prompt-')) {
              setActivePrompt(id.replace('prompt-', ''));
            }
          }
        });
      },
      {
        rootMargin: '-100px 0px -50% 0px',
        threshold: 0,
      }
    );

    // Observe all prompt cards
    allPromptNames.forEach((name) => {
      const element = document.getElementById(`prompt-${name}`);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [allPromptNames]);

  const scrollToPrompt = (promptName: string) => {
    const element = document.getElementById(`prompt-${promptName}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (prompts.length === 0 && compliancePrompts.length === 0 && jenaiPrompts.length === 0) return null;

  return (
    <nav
      className={`sticky top-4 p-4 bg-[var(--color-background)] border border-[var(--color-neutral-200)] rounded-[var(--radius-lg)] ${className}`}
      aria-label="Prompt navigation"
    >
      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-[var(--color-text)]">
        <List className="w-4 h-4" />
        <span>Jump to prompt</span>
      </div>
      <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Core Prompts */}
        {prompts.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
              <Code className="w-3 h-3" />
              <span>Core ({prompts.length})</span>
            </div>
            <ul className="space-y-1">
              {prompts.map((prompt) => (
                <li key={prompt.name}>
                  <button
                    onClick={() => scrollToPrompt(prompt.name)}
                    className={`
                      w-full text-left px-2 py-1 text-xs font-mono rounded transition-colors truncate
                      ${
                        activePrompt === prompt.name
                          ? 'bg-[var(--color-primary-weak)] text-[var(--color-primary)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-50)] hover:text-[var(--color-text)]'
                      }
                    `}
                    title={prompt.name}
                  >
                    {prompt.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Compliance Prompts by Category */}
        {compliancePrompts.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
              <Shield className="w-3 h-3" />
              <span>Compliance ({compliancePrompts.length})</span>
            </div>
            <div className="space-y-3">
              {Object.entries(complianceByCategory).map(([category, categoryPrompts]) => (
                <div key={category}>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 pl-2">
                    {category}
                  </div>
                  <ul className="space-y-0.5">
                    {categoryPrompts.map((prompt) => (
                      <li key={prompt.name}>
                        <button
                          onClick={() => scrollToPrompt(prompt.name)}
                          className={`
                            w-full text-left px-2 py-1 text-xs rounded transition-colors truncate
                            ${
                              activePrompt === prompt.name
                                ? 'bg-[var(--color-primary-weak)] text-[var(--color-primary)]'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-50)] hover:text-[var(--color-text)]'
                            }
                          `}
                          title={prompt.displayName}
                        >
                          {prompt.displayName}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* JenAI Prompts */}
        {jenaiPrompts.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
              <Cpu className="w-3 h-3" />
              <span>JenAI ({jenaiPrompts.length})</span>
            </div>
            <ul className="space-y-1">
              {jenaiPrompts.map((prompt) => (
                <li key={prompt.name}>
                  <button
                    onClick={() => scrollToPrompt(prompt.name)}
                    className={`
                      w-full text-left px-2 py-1 text-xs font-mono rounded transition-colors truncate
                      ${
                        activePrompt === prompt.name
                          ? 'bg-[var(--color-primary-weak)] text-[var(--color-primary)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-50)] hover:text-[var(--color-text)]'
                      }
                    `}
                    title={prompt.name}
                  >
                    {prompt.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}

export default PromptNav;
