'use client';

import { Filter, Search, ShieldCheck } from 'lucide-react';
import type { ComponentType } from 'react';
import type { PipelineFunnelData } from '@/lib/actions/pipeline-analytics';
import { Card } from '@/components/ui';

interface PipelineStepperProps {
  data: PipelineFunnelData | null;
}

interface StepDef {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const STEPS: StepDef[] = [
  { label: 'Tier 1', description: 'Initial Filtering', icon: Filter },
  { label: 'Tier 2', description: 'Classification', icon: Search },
  { label: 'Tier 3', description: 'Verification', icon: ShieldCheck },
];

type StepStatus = 'complete' | 'in-progress' | 'pending';

function getStepStatus(data: PipelineFunnelData, stepIndex: number): StepStatus {
  const tiers = [data.tier1, data.tier2, data.tier3];
  const current = tiers[stepIndex];
  if (!current || current.total === 0) return 'pending';

  // A tier is complete if the next tier has data, or if it's the last tier
  if (stepIndex === 2) return current.total > 0 ? 'complete' : 'pending';
  const next = tiers[stepIndex + 1];
  if (next && next.total > 0) return 'complete';
  return 'in-progress';
}

const STATUS_COLORS: Record<StepStatus, string> = {
  complete: 'var(--color-success)',
  'in-progress': 'var(--color-warning)',
  pending: 'var(--color-neutral-300)',
};

const STATUS_TEXT_COLORS: Record<StepStatus, string> = {
  complete: 'text-[var(--color-success)]',
  'in-progress': 'text-[var(--color-warning)]',
  pending: 'text-[var(--color-text-muted)]',
};

function getStepCount(data: PipelineFunnelData, stepIndex: number): number {
  const tiers = [data.tier1, data.tier2, data.tier3];
  return tiers[stepIndex]?.total ?? 0;
}

/**
 * Horizontal stepper showing completion status of each pipeline tier.
 * Uses semantic colors: complete (green), in-progress (amber), pending (gray).
 */
export function PipelineStepper({ data }: PipelineStepperProps) {
  if (!data) return null;

  const steps = STEPS.map((step, i) => ({
    ...step,
    status: getStepStatus(data, i),
    count: getStepCount(data, i),
  }));

  return (
    <Card padding="lg">
      <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
        Pipeline Progress
      </h3>
      <div className="flex items-start">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const color = STATUS_COLORS[step.status];
          const textColor = STATUS_TEXT_COLORS[step.status];

          return (
            <div key={step.label} className="flex items-start flex-1 min-w-0">
              {/* Step circle + content */}
              <div className="flex flex-col items-center text-center flex-1 min-w-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-[var(--color-text)] mt-2">
                  {step.label}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {step.description}
                </span>
                <span className={`text-xs font-medium mt-0.5 ${textColor}`}>
                  {step.count.toLocaleString()} analyzed
                </span>
              </div>

              {/* Connector line between steps */}
              {i < steps.length - 1 && (
                <div className="flex-shrink-0 mt-5 w-8 sm:w-12 lg:w-16">
                  <div
                    className="h-0.5 w-full transition-colors"
                    style={{
                      backgroundColor:
                        steps[i + 1].status !== 'pending'
                          ? STATUS_COLORS[steps[i + 1].status]
                          : STATUS_COLORS.pending,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
