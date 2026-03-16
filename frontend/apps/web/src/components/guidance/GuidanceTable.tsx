'use client';

import Link from 'next/link';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { EmptyState } from '@/components/ui/EmptyState';
import { zebraRowClass, hoverRowClass, tableHeaderClass } from '@/components/ui/table-styles';
import { Badge } from '@/components/ui/Badge';
import { GuidanceStatusBadge } from './GuidanceStatusBadge';
import { PolicyCategoryBadge } from './PolicyCategoryBadge';
import type { GuidanceDocumentListItem } from '@/lib/actions/guidance-documents';

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
];

function AgencyAvatar({ name }: { name: string }) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colorClass = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const letter = name.charAt(0).toUpperCase();

  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 ${colorClass}`}
      title={name}
    >
      {letter}
    </span>
  );
}

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
            <th className={`${tableHeaderClass} bg-[var(--color-neutral-50)]`}>Ref</th>
            <th className={`${tableHeaderClass} bg-[var(--color-neutral-50)]`}>Title</th>
            <th className={`${tableHeaderClass} bg-[var(--color-neutral-50)]`}>Agency</th>
            <th className={`${tableHeaderClass} bg-[var(--color-neutral-50)]`}>Type</th>
            <th className={`${tableHeaderClass} bg-[var(--color-neutral-50)]`}>Category</th>
            <th className={`${tableHeaderClass} bg-[var(--color-neutral-50)]`}>Status</th>
            <th className={`${tableHeaderClass} bg-[var(--color-neutral-50)] text-right`}>Year</th>
          </tr>
        </thead>
        <tbody>
          {data.map((doc) => {
            const isExcluded = doc.excludeFromAnalysis === true;
            return (
            <tr
              key={doc.id}
              className={`${zebraRowClass} ${hoverRowClass} border-b border-[var(--color-neutral-100)]${isExcluded ? ' opacity-60' : ''}`}
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
                <div className="flex items-center gap-2">
                  <Link
                    href={`/${state}/guidance/${doc.id}`}
                    className="text-[var(--color-primary)] hover:underline truncate"
                  >
                    {doc.title}
                  </Link>
                  {isExcluded && <Badge variant="warning">Excluded</Badge>}
                </div>
              </td>
              <td className="py-3 pr-3 text-[var(--color-text-secondary)] max-w-[150px]">
                <div className="flex items-center gap-2">
                  <AgencyAvatar name={doc.agency} />
                  <span className="truncate" title={doc.agency}>{doc.agency}</span>
                </div>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
