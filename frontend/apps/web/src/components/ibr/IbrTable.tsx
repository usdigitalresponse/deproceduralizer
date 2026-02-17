'use client';

import Link from 'next/link';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { EmptyState } from '@/components/ui/EmptyState';
import type { IbrWithContext } from '@/lib/actions/ibr';

interface IbrTableProps {
  data: IbrWithContext[];
  state: string;
  onRowClick: (ibr: IbrWithContext) => void;
}

export function IbrTable({ data, state, onRowClick }: IbrTableProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={getEntityIcon('ibr_standard')}
        title="No IBR records found"
        description="Try adjusting your filters"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-neutral-200)]">
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Standard</th>
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Organization</th>
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Version</th>
            <th className="text-left py-3 text-xs font-medium text-[var(--color-text-muted)]">Source Regulation</th>
          </tr>
        </thead>
        <tbody>
          {data.map((ibr) => (
            <tr
              key={ibr.id}
              onClick={() => onRowClick(ibr)}
              className="border-b border-[var(--color-neutral-100)] cursor-pointer hover:bg-[var(--color-neutral-50)] transition-colors"
            >
              <td className="py-3 pr-3 text-[var(--color-text)] max-w-[250px] truncate" title={ibr.incorporatedDocument ?? ''}>
                {ibr.incorporatedDocument ?? 'Unknown'}
              </td>
              <td className="py-3 pr-3 text-[var(--color-text-secondary)]">
                {ibr.sourceOrganization ?? '—'}
              </td>
              <td className="py-3 pr-3 text-[var(--color-text-muted)]">
                {ibr.version ?? '—'}
              </td>
              <td className="py-3 max-w-[300px]">
                <Link
                  href={`/${state}/regulations/${ibr.documentId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[var(--color-primary)] hover:underline truncate block"
                  title={ibr.regulation.title ?? ''}
                >
                  {ibr.regulation.title ?? '—'}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
