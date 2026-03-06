'use client';

import Link from 'next/link';
import { DollarSign } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PENALTY_TYPE_LABELS, PENALTY_TYPE_COLORS } from '@/lib/constants/fines';
import type { FineWithContext } from '@/lib/actions/fines';

interface FinesTableProps {
  data: FineWithContext[];
  state: string;
  onRowClick: (fine: FineWithContext) => void;
}

export function FinesTable({ data, state, onRowClick }: FinesTableProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="No fines or fees found"
        description="Try adjusting your filters"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-neutral-200)]">
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Type</th>
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Amount</th>
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Agency</th>
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Description</th>
            <th className="text-left py-3 text-xs font-medium text-[var(--color-text-muted)]">Source</th>
          </tr>
        </thead>
        <tbody>
          {data.map((fine) => {
            const sourceLink = fine.sourceDocument.type === 'regulation'
              ? `/${state}/regulations/${fine.documentId}`
              : `/${state}/guidance/${fine.guidanceDocumentId}`;

            return (
              <tr
                key={fine.id}
                onClick={() => onRowClick(fine)}
                className="border-b border-[var(--color-neutral-100)] cursor-pointer hover:bg-[var(--color-neutral-50)] transition-colors"
              >
                <td className="py-3 pr-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PENALTY_TYPE_COLORS[fine.penaltyType] || PENALTY_TYPE_COLORS.other}`}>
                    {PENALTY_TYPE_LABELS[fine.penaltyType] || fine.penaltyType}
                  </span>
                </td>
                <td className="py-3 pr-3 text-[var(--color-text)] font-medium whitespace-nowrap">
                  {fine.amount ?? '—'}
                  {fine.perUnit && (
                    <span className="text-xs text-[var(--color-text-muted)] ml-1">
                      {fine.perUnit}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-3 text-[var(--color-text-secondary)] max-w-[150px] truncate" title={fine.responsibleAgency ?? ''}>
                  {fine.responsibleAgency ?? '—'}
                </td>
                <td className="py-3 pr-3 text-[var(--color-text-secondary)] max-w-[250px] truncate" title={fine.violationDescription ?? ''}>
                  {fine.violationDescription ?? '—'}
                </td>
                <td className="py-3 max-w-[200px]">
                  <Link
                    href={sourceLink}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[var(--color-primary)] hover:underline truncate block"
                    title={fine.sourceDocument.title ?? ''}
                  >
                    {fine.sourceDocument.title ?? '—'}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
