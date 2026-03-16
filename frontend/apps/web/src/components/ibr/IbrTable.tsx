'use client';

import Link from 'next/link';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { EmptyState } from '@/components/ui/EmptyState';
import { tableHeaderClass, tableRowClass, tableCellClass } from '@/components/ui/table-styles';
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
            <th className={tableHeaderClass}>Standard</th>
            <th className={tableHeaderClass}>Organization</th>
            <th className={tableHeaderClass}>Version</th>
            <th className={tableHeaderClass}>Source Regulation</th>
          </tr>
        </thead>
        <tbody>
          {data.map((ibr) => (
            <tr
              key={ibr.id}
              onClick={() => onRowClick(ibr)}
              className={`${tableRowClass} cursor-pointer`}
            >
              <td className={`${tableCellClass} text-[var(--color-text)] max-w-[250px] truncate`} title={ibr.incorporatedDocument ?? ''}>
                {ibr.incorporatedDocument ?? 'Unknown'}
              </td>
              <td className={`${tableCellClass} text-[var(--color-text-secondary)]`}>
                {ibr.sourceOrganization ?? '—'}
              </td>
              <td className={tableCellClass}>
                {ibr.version ? (
                  <span className="font-mono text-xs bg-[var(--color-neutral-100)] px-1.5 py-0.5 rounded">
                    {ibr.version}
                  </span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">—</span>
                )}
              </td>
              <td className={`${tableCellClass} max-w-[300px]`}>
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
