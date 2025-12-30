'use client';

import { AlertCircle, ArrowRight } from 'lucide-react';
import { Card, Badge } from '@/components/ui';
import type { CircularReference } from './types';

interface CircularRefsPanelProps {
  cycles: CircularReference[];
  onCycleClick?: (cycle: CircularReference) => void;
  selectedCycle?: number[] | null;
}

export function CircularRefsPanel({ cycles, onCycleClick, selectedCycle }: CircularRefsPanelProps) {
  return (
    <Card padding="md" className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--color-warning)]" />
          Circular References
        </h3>
        <Badge variant={cycles.length > 0 ? 'warning' : 'success'}>
          {cycles.length} found
        </Badge>
      </div>

      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {cycles.length === 0 ? (
          <div className="text-center text-sm text-[var(--color-text-muted)] py-4">
            No circular references detected
          </div>
        ) : (
          cycles.map((cycle, index) => {
            const isSelected =
              selectedCycle &&
              cycle.cycle.length === selectedCycle.length &&
              cycle.cycle.every((id: number, i: number) => id === selectedCycle[i]);

            return (
              <button
                key={index}
                onClick={() => onCycleClick?.(cycle)}
                className={`
                  w-full p-2 rounded-[var(--radius-md)] text-left
                  transition-colors border
                  ${
                    isSelected
                      ? 'bg-[var(--color-warning-bg)] border-[var(--color-warning)]'
                      : 'hover:bg-[var(--color-neutral-50)] border-transparent'
                  }
                `}
              >
                <div className="flex items-center gap-1 text-xs">
                  <Badge variant="warning" className="text-xs">
                    {cycle.cycleLength} steps
                  </Badge>
                </div>
                <div className="flex items-center flex-wrap gap-1 mt-1">
                  {cycle.cycle.slice(0, -1).map((docId, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs">
                      <span className="font-mono bg-[var(--color-neutral-100)] px-1 rounded">
                        #{docId}
                      </span>
                      {i < cycle.cycle.length - 2 && (
                        <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)]" />
                      )}
                    </span>
                  ))}
                  <ArrowRight className="w-3 h-3 text-[var(--color-warning)]" />
                  <span className="text-xs text-[var(--color-warning)] font-medium">back to start</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
}
