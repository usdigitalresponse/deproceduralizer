'use client';

import { useState } from 'react';
import { useQueryStates } from 'nuqs';
import { Download } from 'lucide-react';
import type { JurisdictionCode } from '@deproceduralizer/database';
import { analysisTableParsers } from '@/lib/url/parsers';
import { exportAnalysisCsv } from '@/lib/actions/analysis';
import { parseCommaSeparated } from '@/lib/url/filter-helpers';

interface ExportCsvButtonProps {
  jurisdiction: JurisdictionCode;
}

export function ExportCsvButton({ jurisdiction }: ExportCsvButtonProps) {
  const [filters] = useQueryStates(analysisTableParsers, { shallow: false });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportAnalysisCsv(
        jurisdiction,
        window.location.origin,
        {
          tiersCompleted: parseCommaSeparated(filters.tierCompleted).map(Number).filter(n => !isNaN(n)) || undefined,
          classifications: parseCommaSeparated(filters.classification) || undefined,
          federalMandates: parseCommaSeparated(filters.federalMandate) || undefined,
          pipelineRuns: parseCommaSeparated(filters.pipelineRun) || undefined,
          issueTypes: parseCommaSeparated(filters.issueType) || undefined,
          severities: (parseCommaSeparated(filters.severity) as ('high' | 'medium' | 'low' | 'none')[]) || undefined,
          severityChanges: parseCommaSeparated(filters.severityChanged) || undefined,
          federalMandatesConfirmed: parseCommaSeparated(filters.federalMandateConfirmed) || undefined,
          stateDiscretions: parseCommaSeparated(filters.stateDiscretion) || undefined,
          alternativesFound: parseCommaSeparated(filters.alternativeFound) || undefined,
          evidenceGaps: parseCommaSeparated(filters.evidenceGap) || undefined,
          supersededByLaws: parseCommaSeparated(filters.supersededByLaw) || undefined,
          advocacyForChanges: parseCommaSeparated(filters.advocacyForChange) || undefined,
          tier3Triggers: parseCommaSeparated(filters.tier3Trigger) || undefined,
          easyCleanups: parseCommaSeparated(filters.easyCleanup) || undefined,
          bookmarkedOnly: filters.bookmarkedOnly === 'true' ? true : undefined,
        },
        filters.sortBy,
        filters.sortOrder,
      );

      if (!result.success) {
        console.error('Export failed:', result.error);
        return;
      }

      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${jurisdiction.toLowerCase()}-pipeline-export.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)]
        text-xs font-medium transition-colors
        bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]
        hover:bg-[var(--color-neutral-200)]
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-pulse' : ''}`} />
      {isExporting ? 'Exporting...' : 'Export CSV'}
    </button>
  );
}
