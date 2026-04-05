'use client';

import type { MarkerGroup } from '@deproceduralizer/database';

interface TriageButtonsProps {
  triageGroups: MarkerGroup[];
  activeTriageIds: Set<number>;
  onToggle: (groupId: number) => void;
  disabled?: boolean;
}

export function TriageButtons({ triageGroups, activeTriageIds, onToggle, disabled }: TriageButtonsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {triageGroups.map((group) => {
        const isActive = activeTriageIds.has(group.id);

        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onToggle(group.id)}
            disabled={disabled}
            className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed border"
            style={
              isActive
                ? { backgroundColor: group.color, color: '#fff', borderColor: group.color }
                : { backgroundColor: 'transparent', color: group.color, borderColor: group.color }
            }
            title={isActive ? `Remove "${group.name}" tag` : `Add "${group.name}" tag`}
          >
            {group.name}
          </button>
        );
      })}
    </div>
  );
}
