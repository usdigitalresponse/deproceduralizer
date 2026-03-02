'use client';

import Link from 'next/link';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { EmptyState } from '@/components/ui/EmptyState';
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
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Ref</th>
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Title</th>
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Agency</th>
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Type</th>
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Category</th>
            <th className="text-left py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Status</th>
            <th className="text-right py-3 text-xs font-medium text-[var(--color-text-muted)]">Year</th>
          </tr>
        </thead>
        <tbody>
          {data.map((doc) => (
            <tr
              key={doc.id}
              className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] transition-colors"
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
