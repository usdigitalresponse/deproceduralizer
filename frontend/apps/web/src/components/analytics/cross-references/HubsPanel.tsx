'use client';

import { ArrowDownLeft, ArrowUpRight, Link2 } from 'lucide-react';
import Link from 'next/link';
import { Card, Badge } from '@/components/ui';
import type { DocumentHub } from './types';

interface HubsPanelProps {
  hubs: DocumentHub[];
  state: string;
  sortBy: 'in' | 'out' | 'total';
  onSortChange: (sortBy: 'in' | 'out' | 'total') => void;
}

export function HubsPanel({ hubs, state, sortBy, onSortChange }: HubsPanelProps) {
  return (
    <Card padding="md" className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Top Referenced Sections
        </h3>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as 'in' | 'out' | 'total')}
          className="text-xs px-2 py-1 border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] bg-white"
        >
          <option value="total">Total</option>
          <option value="in">Cited By</option>
          <option value="out">Cites</option>
        </select>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {hubs.length === 0 ? (
          <div className="text-center text-sm text-[var(--color-text-muted)] py-4">
            No hub documents found
          </div>
        ) : (
          hubs.map((hub, index) => (
            <Link
              key={hub.documentId}
              href={`/${state.toLowerCase()}/regulations/${hub.documentId}`}
              className="block p-2 rounded-[var(--radius-md)] hover:bg-[var(--color-neutral-50)] transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-[var(--color-text-muted)] w-5 shrink-0">
                  {index + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" title={hub.title ?? undefined}>
                    {hub.shortTitle || hub.citation || hub.title}
                  </div>
                  {hub.citation && hub.shortTitle && (
                    <div className="text-xs text-[var(--color-text-muted)] truncate">
                      {hub.citation}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="info" className="text-xs">
                      <ArrowDownLeft className="w-3 h-3 mr-0.5" />
                      {hub.inDegree}
                    </Badge>
                    <Badge variant="default" className="text-xs">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />
                      {hub.outDegree}
                    </Badge>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      = {hub.totalDegree} total
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
