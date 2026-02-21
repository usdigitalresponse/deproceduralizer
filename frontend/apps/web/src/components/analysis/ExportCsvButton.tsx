'use client';

import { useState } from 'react';
import { useQueryStates } from 'nuqs';
import { Download } from 'lucide-react';
import type { StateCode } from '@deproceduralizer/database';
import { analysisTableParsers } from '@/lib/url/parsers';
import { exportAnalysisCsv } from '@/lib/actions/analysis';

interface ExportCsvButtonProps {
  state: StateCode;
}

export function ExportCsvButton({ state }: ExportCsvButtonProps) {
  const [filters] = useQueryStates(analysisTableParsers, { shallow: false });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportAnalysisCsv(
        state,
        {
          tierCompleted: filters.tierCompleted !== 'all' ? parseInt(filters.tierCompleted) : undefined,
          classification: filters.classification !== 'all' ? filters.classification : undefined,
          federalMandate: filters.federalMandate !== 'all' ? filters.federalMandate === 'true' : undefined,
          pipelineRun: filters.pipelineRun !== 'all' ? filters.pipelineRun === 'true' : undefined,
          issueType: filters.issueType && filters.issueType !== 'all' ? filters.issueType : undefined,
          severity: filters.severity !== 'all' ? filters.severity : undefined,
          severityChanged: filters.severityChanged !== 'all' ? filters.severityChanged : undefined,
          federalMandateConfirmed: filters.federalMandateConfirmed !== 'all' ? filters.federalMandateConfirmed : undefined,
          stateDiscretion: filters.stateDiscretion !== 'all' ? filters.stateDiscretion : undefined,
          alternativeFound: filters.alternativeFound !== 'all' ? filters.alternativeFound : undefined,
          evidenceGap: filters.evidenceGap !== 'all' ? filters.evidenceGap : undefined,
          supersededByLaw: filters.supersededByLaw !== 'all' ? filters.supersededByLaw : undefined,
          advocacyForChange: filters.advocacyForChange !== 'all' ? filters.advocacyForChange : undefined,
          tier3Trigger: filters.tier3Trigger !== 'all' ? filters.tier3Trigger : undefined,
          easyCleanup: filters.easyCleanup !== 'all' ? filters.easyCleanup : undefined,
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
      link.download = `${state.toLowerCase()}-pipeline-export.csv`;
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
