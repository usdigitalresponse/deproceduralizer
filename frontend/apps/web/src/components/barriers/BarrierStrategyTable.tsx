'use client';

import Link from 'next/link';
import { Lightbulb } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { tableRowClass, tableHeaderClass } from '@/components/ui/table-styles';
import { BARRIER_CATEGORY_LABELS } from '@deproceduralizer/database/schema';
import type { BarrierIssueWithContext } from '@/lib/actions/barrier-strategies';

interface BarrierStrategyTableProps {
  data: BarrierIssueWithContext[];
  state: string;
}

/** Color mapping for Barrier categories */
const CATEGORY_COLORS: Record<string, string> = {
  ADMINISTRATIVE_BURDENS: 'bg-red-50 text-red-700',
  DEAD_SUPERSEDED_REFERENCES: 'bg-orange-50 text-orange-700',
  FROZEN_TECHNOLOGY: 'bg-blue-50 text-blue-700',
  FEE_COST_BURDENS: 'bg-yellow-50 text-yellow-700',
  MISSING_DIGITAL_AUTHORIZATION: 'bg-purple-50 text-purple-700',
  ACCESS_ASSUMPTION_BARRIERS: 'bg-pink-50 text-pink-700',
  REGULATORY_COMPLEXITY: 'bg-indigo-50 text-indigo-700',
  POLICY_IMPLEMENTATION_SEPARATION: 'bg-teal-50 text-teal-700',
  CASCADE_OF_RIGIDITY: 'bg-amber-50 text-amber-700',
  MANDATED_STEPS_NOT_OUTCOMES: 'bg-rose-50 text-rose-700',
  NO_FEEDBACK_LOOPS: 'bg-cyan-50 text-cyan-700',
  PROCESS_WORSHIP_OVERSIGHT: 'bg-fuchsia-50 text-fuchsia-700',
  ZERO_RISK_LANGUAGE: 'bg-slate-100 text-slate-700',
  MISSING_OUTCOMES: 'bg-emerald-50 text-emerald-700',
  UNCLEAR_DELEGATION: 'bg-violet-50 text-violet-700',
  ONE_SIZE_FITS_ALL: 'bg-lime-50 text-lime-700',
  UNFUNDED_MANDATE: 'bg-orange-100 text-orange-800',
  OTHER: 'bg-gray-50 text-gray-600',
};

/** Severity badge color */
function severityBadge(severity: number): string {
  if (severity >= 7) return 'bg-red-50 text-red-700';
  if (severity >= 4) return 'bg-yellow-50 text-yellow-700';
  return 'bg-green-50 text-green-700';
}

export function BarrierStrategyTable({ data, state }: BarrierStrategyTableProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="No findings found"
        description="Try adjusting your filters"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-neutral-200)]">
            <th className={tableHeaderClass}>Category</th>
            <th className={tableHeaderClass}>Severity</th>
            <th className={tableHeaderClass}>Type</th>
            <th className={tableHeaderClass}>Source</th>
            <th className={tableHeaderClass}>Explanation</th>
          </tr>
        </thead>
        <tbody>
          {data.map((issue) => {
            const isGuidance = issue.sourceType === 'guidance';
            const sourceLink = isGuidance
              ? `/${state}/guidance/${issue.guidanceDocumentId}`
              : `/${state}/regulations/${issue.documentId}`;
            const sourceTitle = isGuidance
              ? issue.guidance?.title
              : issue.regulation?.title;
            const categoryLabel = BARRIER_CATEGORY_LABELS[issue.category as keyof typeof BARRIER_CATEGORY_LABELS] ?? issue.category;
            const categoryColor = CATEGORY_COLORS[issue.category] ?? CATEGORY_COLORS.OTHER;

            return (
              <tr key={issue.id} className={tableRowClass}>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${categoryColor}`}>
                    {categoryLabel}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${severityBadge(issue.severity)}`}>
                    {issue.severity}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                    isGuidance
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}>
                    {isGuidance ? 'Guidance' : 'Regulation'}
                  </span>
                </td>
                <td className="py-3 px-4 max-w-[250px]">
                  <Link
                    href={sourceLink}
                    className="text-[var(--color-primary)] hover:underline truncate block"
                    title={sourceTitle ?? ''}
                  >
                    {sourceTitle ?? '--'}
                  </Link>
                </td>
                <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                  <p className="text-sm leading-relaxed">
                    {issue.explanation}
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
