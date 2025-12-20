'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ClipboardList, Code2 } from 'lucide-react';
import type { ReviewMode } from '@/types/regulation';

interface ReviewModeSwitcherProps {
  mode: ReviewMode;
}

export function ReviewModeSwitcher({ mode }: ReviewModeSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleModeChange = (newMode: ReviewMode) => {
    if (newMode === mode) return;

    const params = new URLSearchParams(searchParams.toString());

    if (newMode === 'developer') {
      params.set('mode', 'developer');
      // Reset to show all developer statuses
      params.delete('reviewStatus');
      params.set('developerStatus', 'all');
    } else {
      params.delete('mode');
      params.delete('developerStatus');
      params.delete('developerAssigned');
      // Default to unreviewed for review mode
      params.set('reviewStatus', 'unreviewed');
    }

    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] mb-3">
      <button
        onClick={() => handleModeChange('review')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
          transition-all duration-[var(--duration-fast)]
          ${
            mode === 'review'
              ? 'bg-white text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
          }
        `}
      >
        <ClipboardList className="w-4 h-4" />
        Review Mode
      </button>
      <button
        onClick={() => handleModeChange('developer')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
          transition-all duration-[var(--duration-fast)]
          ${
            mode === 'developer'
              ? 'bg-white text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
          }
        `}
      >
        <Code2 className="w-4 h-4" />
        Developer Mode
      </button>
    </div>
  );
}

export default ReviewModeSwitcher;
