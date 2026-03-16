'use client';

import Link from 'next/link';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { EmptyState } from '@/components/ui/EmptyState';
import { tableRowClass, tableHeaderClass } from '@/components/ui/table-styles';
import { GuidanceStatusBadge } from './GuidanceStatusBadge';
import { PolicyCategoryBadge } from './PolicyCategoryBadge';
import type { GuidanceDocumentListItem } from '@/lib/actions/guidance-documents';

interface GuidanceTableProps {
  data: GuidanceDocumentListItem[];
  state: string;
}

export function GuidanceTable({ data, state }: GuidanceTableProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={getEntityIcon('guidance_document')}
        title="No guidance documents found"
        description="Try adjusting your filters"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-neutral-200)]">
            <th className={tableHeaderClass}>Ref</th>
            <th className={tableHeaderClass}>Title</th>
            <th className={tableHeaderClass}>Agency</th>
            <th className={tableHeaderClass}>Type</th>
            <th className={tableHeaderClass}>Category</th>
            <th className={tableHeaderClass}>Status</th>
            <th className={`${tableHeaderClass} text-right`}>Year</th>
          </tr>
        </thead>
        <tbody>
          {data.map((doc) => (
            <tr
              key={doc.id}
              className={tableRowClass}
            >
              <td className="py-3 pr-3 text-[var(--color-text-muted)] text-xs whitespace-nowrap">
                <Link
                  href={`/${state}/guidance/${doc.id}`}
                  className="text-[var(--color-primary)] hover:underline"
                >
                  {doc.canonicalRef ?? '—'}
                </Link>
              </td>
              <td className="py-3 pr-3 text-[var(--color-text)] max-w-[300px] truncate" title={doc.title}>
                <Link
                  href={`/${state}/guidance/${doc.id}`}
                  className="text-[var(--color-primary)] hover:underline"
                >
                  {doc.title}
                </Link>
              </td>
              <td className="py-3 pr-3 text-[var(--color-text-secondary)] max-w-[150px] truncate" title={doc.agency}>
                {doc.agency}
              </td>
              <td className="py-3 pr-3 text-[var(--color-text-muted)]">
                {doc.docType ?? '—'}
              </td>
              <td className="py-3 pr-3">
                <PolicyCategoryBadge category={doc.policyCategory} />
              </td>
              <td className="py-3 pr-3">
                <GuidanceStatusBadge status={doc.status} />
              </td>
              <td className="py-3 text-right text-[var(--color-text-muted)]">
                {doc.year ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
