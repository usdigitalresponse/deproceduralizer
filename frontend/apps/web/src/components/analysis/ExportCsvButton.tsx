'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Download, ChevronDown, FileArchive } from 'lucide-react';
import type { JurisdictionCode, AnalysisListFilters } from '@deproceduralizer/database';
import { Button } from '@/components/ui/Button';
import { analysisTableParsers } from '@/lib/url/parsers';
import {
  exportAnalysisCsv,
  exportComprehensiveAnalysisCsv,
  exportAnalysisZipByAgency,
} from '@/lib/actions/analysis';
import { parseCommaSeparated } from '@/lib/url/filter-helpers';

interface ExportDropdownProps {
  jurisdiction: JurisdictionCode;
}

function buildFiltersFromParams(filters: Record<string, string>): AnalysisListFilters {
  return {
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
  };
}

export function ExportDropdown({ jurisdiction }: ExportDropdownProps) {
  const [params] = useQueryStates(analysisTableParsers, { shallow: false });
  const [exporting, setExporting] = useState<'csv' | 'full-csv' | 'zip' | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentFilters = useMemo(() => buildFiltersFromParams(params as unknown as Record<string, string>), [params]);

  const hasActiveFilters = useMemo(() => {
    const filterKeys = [
      'tierCompleted', 'classification', 'federalMandate', 'pipelineRun',
      'issueType', 'severity', 'severityChanged', 'federalMandateConfirmed',
      'stateDiscretion', 'alternativeFound', 'evidenceGap', 'supersededByLaw',
      'advocacyForChange', 'tier3Trigger', 'easyCleanup',
    ] as const;
    const p = params as unknown as Record<string, string | null>;
    return filterKeys.some(k => {
      const v = p[k];
      return v !== null && v !== undefined && v !== '' && v !== 'all';
    }) || params.bookmarkedOnly === 'true';
  }, [params]);

  const triggerDownload = useCallback((data: BlobPart, filename: string, mimeType: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportSimple = useCallback(async () => {
    setOpen(false);
    setExporting('csv');
    try {
      const result = await exportAnalysisCsv(
        jurisdiction,
        window.location.origin,
        currentFilters,
        params.sortBy,
        params.sortOrder,
      );
      if (result.success) {
        triggerDownload(result.data, `${jurisdiction.toLowerCase()}-pipeline-export.csv`, 'text/csv');
      } else {
        console.error('Export failed:', result.error);
      }
    } finally {
      setExporting(null);
    }
  }, [jurisdiction, currentFilters, params.sortBy, params.sortOrder, triggerDownload]);

  const handleExportFull = useCallback(async () => {
    setOpen(false);
    setExporting('full-csv');
    try {
      const result = await exportComprehensiveAnalysisCsv(
        jurisdiction,
        window.location.origin,
        currentFilters,
        params.sortBy,
        params.sortOrder,
      );
      if (result.success) {
        triggerDownload(result.data, `${jurisdiction.toLowerCase()}-pipeline-full-export.csv`, 'text/csv');
      } else {
        console.error('Export failed:', result.error);
      }
    } finally {
      setExporting(null);
    }
  }, [jurisdiction, currentFilters, params.sortBy, params.sortOrder, triggerDownload]);

  const handleExportZip = useCallback(async () => {
    setOpen(false);
    setExporting('zip');
    try {
      const result = await exportAnalysisZipByAgency(
        jurisdiction,
        window.location.origin,
        currentFilters,
        params.sortBy,
        params.sortOrder,
      );
      if (result.success) {
        const byteString = atob(result.data);
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
          bytes[i] = byteString.charCodeAt(i);
        }
        triggerDownload(bytes, `pipeline-by-agency-${jurisdiction.toLowerCase()}.zip`, 'application/zip');
      } else {
        console.error('Export failed:', result.error);
      }
    } finally {
      setExporting(null);
    }
  }, [jurisdiction, currentFilters, params.sortBy, params.sortOrder, triggerDownload]);

  const handleAction = (action: () => void) => {
    action();
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        disabled={exporting !== null}
      >
        <Download className="w-3.5 h-3.5 mr-1.5" />
        {exporting ? 'Exporting...' : 'Export'}
        <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-[var(--color-surface)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] shadow-lg z-50 py-1">
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-neutral-50)] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleAction(handleExportSimple)}
            disabled={exporting === 'csv'}
          >
            <Download className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <div>
              <div>{hasActiveFilters ? 'Export Filtered CSV (Summary)' : 'Export CSV (Summary)'}</div>
              <div className="text-xs text-[var(--color-text-muted)]">11 key columns</div>
            </div>
          </button>

          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-neutral-50)] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleAction(handleExportFull)}
            disabled={exporting === 'full-csv'}
          >
            <Download className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <div>
              <div>{hasActiveFilters ? 'Export Filtered Full CSV' : 'Export Full CSV'}</div>
              <div className="text-xs text-[var(--color-text-muted)]">All analysis fields</div>
            </div>
          </button>

          <div className="border-t border-[var(--color-neutral-100)] my-1" />

          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-neutral-50)] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleAction(handleExportZip)}
            disabled={exporting === 'zip'}
          >
            <FileArchive className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <div>
              <div>{hasActiveFilters ? 'Export Filtered by Agency (ZIP)' : 'Export by Agency (ZIP)'}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Full CSV per agency</div>
            </div>
          </button>

          {hasActiveFilters && (
            <>
              <div className="border-t border-[var(--color-neutral-100)] my-1" />
              <span className="block px-3 py-1 text-xs text-[var(--color-text-muted)]">
                Exporting filtered results only
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** @deprecated Use ExportDropdown instead */
export { ExportDropdown as ExportCsvButton };
