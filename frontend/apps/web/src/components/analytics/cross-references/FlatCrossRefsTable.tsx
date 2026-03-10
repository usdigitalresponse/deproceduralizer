'use client';

import Link from 'next/link';
import { ArrowUpDown } from 'lucide-react';
import { Badge, Pagination } from '@/components/ui';
import type { CrossRefTableRow } from '@/lib/actions/cross-references';
import type { JurisdictionCode } from '@/types/state';
import type { CrossRefSortByValue, SortOrderValue } from '@/lib/url/parsers';
import { CROSSREF_REF_TYPE_LABELS } from '@/lib/constants/values';

interface FlatCrossRefsTableProps {
  data: CrossRefTableRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sortBy: CrossRefSortByValue;
  sortOrder: SortOrderValue;
  isPending: boolean;
  jurisdiction: JurisdictionCode;
  onPageChange: (page: number) => void;
  onSort: (column: CrossRefSortByValue) => void;
}

function refTypeBadgeVariant(refType: string): 'default' | 'info' | 'warning' | 'success' {
  switch (refType) {
    case 'nycrr':
    case 'njac':
      return 'info';
    case 'form':
      return 'warning';
    case 'ssl':
    case 'ny_statute':
      return 'success';
    default:
      return 'default';
  }
}

function SourceLink({
  row,
  jurisdiction,
}: {
  row: CrossRefTableRow;
  jurisdiction: JurisdictionCode;
}) {
  const state = jurisdiction.toLowerCase();
  if (row.sourceGuidanceId) {
    return (
      <Link
        href={`/${state}/guidance/${row.sourceGuidanceId}`}
        className="text-[var(--color-primary)] hover:underline text-sm"
      >
        {row.sourceGuidanceRef ?? `Guidance #${row.sourceGuidanceId}`}
      </Link>
    );
  }
  if (row.sourceDocumentId) {
    return (
      <Link
        href={`/${state}/browse/${row.sourceDocumentId}`}
        className="text-[var(--color-primary)] hover:underline text-sm"
      >
        {row.sourceDocumentCitation ?? row.sourceDocumentTitle ?? `Doc #${row.sourceDocumentId}`}
      </Link>
    );
  }
  return <span className="text-[var(--color-text-muted)] text-sm">Unknown</span>;
}

function TargetLink({
  row,
  jurisdiction,
}: {
  row: CrossRefTableRow;
  jurisdiction: JurisdictionCode;
}) {
  const state = jurisdiction.toLowerCase();
  if (row.targetGuidanceId) {
    return (
      <Link
        href={`/${state}/guidance/${row.targetGuidanceId}`}
        className="text-[var(--color-primary)] hover:underline text-sm"
      >
        {row.targetGuidanceRef ?? `Guidance #${row.targetGuidanceId}`}
      </Link>
    );
  }
  if (row.targetDocumentId) {
    return (
      <Link
        href={`/${state}/browse/${row.targetDocumentId}`}
        className="text-[var(--color-primary)] hover:underline text-sm"
      >
        {row.targetDocumentCitation ?? row.targetDocumentTitle ?? `Doc #${row.targetDocumentId}`}
      </Link>
    );
  }
  return <span className="text-[var(--color-text-muted)] text-sm">&mdash;</span>;
}

function SortableHeader({
  label,
  column,
  currentSort,
  currentOrder,
  onClick,
}: {
  label: string;
  column: CrossRefSortByValue;
  currentSort: CrossRefSortByValue;
  currentOrder: SortOrderValue;
  onClick: (column: CrossRefSortByValue) => void;
}) {
  const isActive = currentSort === column;
  return (
    <button
      type="button"
      onClick={() => onClick(column)}
      className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] uppercase tracking-wide"
    >
      {label}
      <ArrowUpDown
        className={`w-3 h-3 ${isActive ? 'text-[var(--color-primary)]' : 'opacity-40'}`}
      />
      {isActive && (
        <span className="text-[var(--color-primary)] text-[10px]">
          {currentOrder === 'asc' ? '\u2191' : '\u2193'}
        </span>
      )}
    </button>
  );
}

export function FlatCrossRefsTable({
  data,
  total,
  page,
  pageSize,
  totalPages,
  sortBy,
  sortOrder,
  isPending,
  jurisdiction,
  onPageChange,
  onSort,
}: FlatCrossRefsTableProps) {
  if (data.length === 0 && !isPending) {
    return (
      <div className="text-center py-12 text-[var(--color-text-muted)]">
        <p className="text-lg font-medium">No cross-references found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className={`relative ${isPending ? 'opacity-60' : ''}`}>
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--color-surface)]/50">
          <div className="animate-pulse text-[var(--color-text-muted)]">Loading...</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-neutral-200)]">
              <th className="px-3 py-2">
                <SortableHeader
                  label="Source"
                  column="sourceDocument"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
              <th className="px-3 py-2">
                <SortableHeader
                  label="Type"
                  column="refType"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
              <th className="px-3 py-2 max-w-[200px]">
                <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                  Raw Text
                </span>
              </th>
              <th className="px-3 py-2">
                <SortableHeader
                  label="Citation"
                  column="normalizedCitation"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
              <th className="px-3 py-2">
                <SortableHeader
                  label="Resolved"
                  column="isResolved"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
              <th className="px-3 py-2">
                <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                  Target
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] transition-colors"
              >
                <td className="px-3 py-2">
                  <SourceLink row={row} jurisdiction={jurisdiction} />
                </td>
                <td className="px-3 py-2">
                  <Badge variant={refTypeBadgeVariant(row.refType)}>
                    {CROSSREF_REF_TYPE_LABELS[row.refType] ?? row.refType}
                  </Badge>
                </td>
                <td className="px-3 py-2 max-w-[200px]">
                  <span
                    className="text-sm text-[var(--color-text-secondary)] truncate block"
                    title={row.rawText}
                  >
                    {row.rawText.length > 60
                      ? row.rawText.slice(0, 60) + '\u2026'
                      : row.rawText}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-sm font-mono text-[var(--color-text)]">
                    {row.normalizedCitation}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={row.isResolved ? 'success' : 'warning'}>
                    {row.isResolved ? 'Resolved' : 'Unresolved'}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <TargetLink row={row} jurisdiction={jurisdiction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          showItemCount
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
