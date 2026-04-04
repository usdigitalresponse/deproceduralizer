'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import type { JurisdictionCode, FullAnalysisRecord, FullGuidanceAnalysisRecord, EvidencedFlag, MarkerGroup } from '@deproceduralizer/database';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from '@/components/ui/Drawer';
import { AnalysisBookmarkProvider, BookmarkNotesCard, useBookmarkRefresh, useBookmarkContext } from './AnalysisBookmarkSection';
import { ClassificationBadge } from '@/components/issues/TierClassificationFlow';
import { TierBadge } from '@/components/issues/TierProgressIndicator';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { BookmarkButton } from '@/components/ui';
import { MarkerBadge, MarkerPicker } from '@/components/markers';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { getFullAnalysisRecord, getFullGuidanceAnalysisRecord } from '@/lib/actions/analysis';
import { getTriageMarkerGroups } from '@/lib/actions/marker-groups';
import { toggleTriageTag } from '@/lib/actions/bookmarks';
import { isInteractiveElement } from '@/lib/utils/keyboard';
import { TriageButtons } from './TriageButtons';
import type { UnifiedAnalysisRow } from './AnalysisTable';


type FullRecord = FullAnalysisRecord | FullGuidanceAnalysisRecord;

interface AnalysisDetailDrawerProps {
  item: UnifiedAnalysisRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jurisdiction: JurisdictionCode;
  rows: UnifiedAnalysisRow[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onTriageChanged?: () => void;
}

// ---------------------------------------------------------------------------
// Collapsible section component
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-[var(--color-neutral-200)] pt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full text-left group"
      >
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          : <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        }
        <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider group-hover:text-[var(--color-text-secondary)] transition-colors">
          {title}
        </h4>
      </button>
      {isOpen && (
        <div className="mt-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DrawerSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Classification skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-24 bg-[var(--color-neutral-200)] rounded" />
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-[var(--color-neutral-200)] rounded" />
          <div className="h-6 w-16 bg-[var(--color-neutral-200)] rounded" />
        </div>
      </div>
      {/* Summary skeleton */}
      <div className="border-t border-[var(--color-neutral-200)] pt-4 space-y-3">
        <div className="h-3 w-32 bg-[var(--color-neutral-200)] rounded" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-[var(--color-neutral-200)] rounded" />
          <div className="h-4 w-5/6 bg-[var(--color-neutral-200)] rounded" />
          <div className="h-4 w-3/4 bg-[var(--color-neutral-200)] rounded" />
        </div>
      </div>
      {/* Reasoning skeleton */}
      <div className="border-t border-[var(--color-neutral-200)] pt-4 space-y-3">
        <div className="h-3 w-28 bg-[var(--color-neutral-200)] rounded" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-[var(--color-neutral-200)] rounded" />
          <div className="h-4 w-4/5 bg-[var(--color-neutral-200)] rounded" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidenced flag display
// ---------------------------------------------------------------------------

function EvidencedFlagDisplay({ label, flag }: { label: string; flag: EvidencedFlag | undefined }) {
  if (!flag?.value) return null;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          {label}
        </span>
        {flag.scope && (
          <span className="text-[10px] text-[var(--color-text-muted)]">({flag.scope})</span>
        )}
      </div>
      {flag.reason && (
        <MarkdownContent className="text-sm text-[var(--color-text-secondary)] ml-0.5">{flag.reason}</MarkdownContent>
      )}
      {flag.evidence && flag.evidence.length > 0 && (
        <div className="mt-1.5 ml-0.5 space-y-1">
          {flag.evidence.map((ev, i) => {
            const url = ev.url || ev.identifier;
            return (
              <div key={i} className="text-xs text-[var(--color-text-muted)] border-l-2 border-[var(--color-neutral-200)] pl-2">
                {ev.quote && (
                  <p className="italic text-[var(--color-text-secondary)]">&ldquo;{ev.quote}&rdquo;</p>
                )}
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-primary)] hover:underline break-all"
                  >
                    {url.length > 60 ? url.slice(0, 60) + '...' : url}
                  </a>
                )}
                {ev.source_type && (
                  <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">
                    [{ev.source_type}]
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper to get the best available reasoning from the full record
// ---------------------------------------------------------------------------

function getBestSummary(record: FullRecord): { tier: number; reasoning: string | null; classification: string | null } {
  if (record.tier3?.reasoning) {
    return { tier: 3, reasoning: record.tier3.reasoning, classification: record.tier3.classification };
  }
  if (record.tier2?.reasoning) {
    return { tier: 2, reasoning: record.tier2.reasoning, classification: record.tier2.classification };
  }
  if (record.tier1?.reasoning) {
    return { tier: 1, reasoning: record.tier1.reasoning, classification: record.tier1.classification };
  }
  return { tier: 0, reasoning: null, classification: null };
}

// ---------------------------------------------------------------------------
// Full analysis detail content (loaded async)
// ---------------------------------------------------------------------------

function FullAnalysisContent({ record }: { record: FullRecord }) {
  const best = getBestSummary(record);

  // Argument framing from Tier 1
  const argFraming = record.tier1?.argumentFraming;

  // Tier 2 argument against (the "what's burdensome" summary)
  const argumentAgainst = record.tier2?.argumentAgainstRegulation;
  const argumentFor = record.tier2?.argumentForRegulation;
  const verbatimRequirements = record.tier2?.verbatimRequirements;

  // Tier 3 flags
  const t3Flags = record.tier3?.flags;
  const webSearchSummary = record.tier3?.webSearchSummary;
  const severityAdjReasoning = record.tier3?.severityAdjustmentReasoning;

  // Severity details
  const severityCalc = record.tier2?.severityCalculation;

  return (
    <>
      {/* --- Issue Summary --- */}
      {(argumentAgainst || best.reasoning) && (
        <CollapsibleSection title="Issue Summary" defaultOpen>
          {argumentAgainst && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                What&apos;s Burdensome
              </h5>
              <MarkdownContent className="text-sm text-[var(--color-text)]">{argumentAgainst}</MarkdownContent>
            </div>
          )}
          {best.reasoning && (
            <div>
              <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                Best Analysis (Tier {best.tier})
              </h5>
              <MarkdownContent>{best.reasoning}</MarkdownContent>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* --- Matched Text / Verbatim Requirements --- */}
      {verbatimRequirements && verbatimRequirements.length > 0 && (
        <CollapsibleSection title="Bad Regulation Text" defaultOpen>
          <div className="space-y-2">
            {verbatimRequirements.map((text, i) => (
              <blockquote
                key={i}
                className="text-sm text-[var(--color-text)] border-l-3 border-[var(--color-primary)] pl-3 py-1 bg-[var(--color-neutral-50)] rounded-r italic leading-relaxed"
              >
                {text}
              </blockquote>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* --- Argument Framing (Tier 1) --- */}
      {argFraming && (argFraming.best_argument_burdensome || argFraming.best_argument_justified) && (
        <CollapsibleSection title="Argument Framing">
          {argFraming.best_argument_burdensome && (
            <div className="mb-3">
              <h5 className="text-xs font-medium text-[var(--color-danger)] mb-1">
                Argument: Burdensome
              </h5>
              <MarkdownContent>{argFraming.best_argument_burdensome}</MarkdownContent>
            </div>
          )}
          {argFraming.best_argument_justified && (
            <div className="mb-3">
              <h5 className="text-xs font-medium text-[var(--color-success)] mb-1">
                Argument: Justified
              </h5>
              <MarkdownContent>{argFraming.best_argument_justified}</MarkdownContent>
            </div>
          )}
          {argFraming.best_argument_unrelated && (
            <div>
              <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-1">
                Argument: Unrelated
              </h5>
              <MarkdownContent>{argFraming.best_argument_unrelated}</MarkdownContent>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* --- Counterargument --- */}
      {argumentFor && (
        <CollapsibleSection title="Counterargument (Pro-Regulation)">
          <MarkdownContent>{argumentFor}</MarkdownContent>
        </CollapsibleSection>
      )}

      {/* --- Severity Justification --- */}
      {(record.finalSeverity !== null && (severityCalc || severityAdjReasoning)) && (
        <CollapsibleSection title="Severity Justification">
          <div className="space-y-3">
            {record.finalSeverity !== null && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-[var(--color-text-muted)]">Final Score:</span>
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                    record.finalSeverity >= 7
                      ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                      : record.finalSeverity >= 4
                        ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                        : 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                  }`}
                >
                  {record.finalSeverity}
                </span>
                {record.tier3?.severityAdjustment != null && record.tier3.severityAdjustment !== 0 && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    (T3 adjusted by {record.tier3.severityAdjustment > 0 ? '+' : ''}{record.tier3.severityAdjustment})
                  </span>
                )}
              </div>
            )}
            {severityCalc && (
              <div>
                <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-1">
                  Calculation (Tier 2)
                </h5>
                <MarkdownContent>{severityCalc}</MarkdownContent>
              </div>
            )}
            {severityAdjReasoning && (
              <div>
                <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-1">
                  Tier 3 Adjustment
                </h5>
                <MarkdownContent>{severityAdjReasoning}</MarkdownContent>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* --- Web Search / Tier 3 Evidence --- */}
      {(webSearchSummary || t3Flags) && (
        <CollapsibleSection title="Web Research & Evidence">
          {webSearchSummary && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                Web Search Summary
              </h5>
              <MarkdownContent>{webSearchSummary}</MarkdownContent>
            </div>
          )}
          {t3Flags && (
            <div>
              <EvidencedFlagDisplay label="Federal Mandate Confirmed" flag={t3Flags.federal_mandate_confirmed} />
              <EvidencedFlagDisplay label="State Has Discretion" flag={t3Flags.state_discretion_found} />
              <EvidencedFlagDisplay label="Modernized Alternative Found" flag={t3Flags.modernized_alternative_found} />
              <EvidencedFlagDisplay label="Superseded by Law" flag={t3Flags.superseded_by_law} />
              <EvidencedFlagDisplay label="Advocacy for Change" flag={t3Flags.advocacy_for_change} />
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* --- Easy Cleanup Details --- */}
      {record.easyCleanupCandidate && (
        <CollapsibleSection title="Easy Cleanup Details" defaultOpen>
          <div className="space-y-2">
            {record.cleanupType && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-text-muted)]">Type:</span>
                <span className="text-sm text-[var(--color-text)] font-medium">
                  {record.cleanupType.replace(/_/g, ' ')}
                </span>
              </div>
            )}
            {record.cleanupEffort && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-text-muted)]">Effort:</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  record.cleanupEffort === 'trivial'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : record.cleanupEffort === 'easy'
                      ? 'bg-green-50 text-green-600 border border-green-200'
                      : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                }`}>
                  {record.cleanupEffort}
                </span>
              </div>
            )}
            {record.cleanupEvidence && (
              <div>
                <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Evidence</h5>
                <MarkdownContent>{record.cleanupEvidence}</MarkdownContent>
              </div>
            )}
            {record.cleanupRecommendation && (
              <div>
                <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Recommendation</h5>
                <MarkdownContent>{record.cleanupRecommendation}</MarkdownContent>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Bookmark toggle wrapper — notifies parent table when bookmark state changes
// ---------------------------------------------------------------------------

function SyncingBookmarkToggle({ onDataChanged }: { onDataChanged?: () => void }) {
  const { isBookmarked, handleToggle, isLoading } = useBookmarkContext();
  const prevBookmarked = useRef(isBookmarked);

  useEffect(() => {
    if (prevBookmarked.current !== isBookmarked) {
      prevBookmarked.current = isBookmarked;
      onDataChanged?.();
    }
  }, [isBookmarked, onDataChanged]);

  return (
    <BookmarkButton
      isBookmarked={isBookmarked}
      onToggle={handleToggle}
      isLoading={isLoading}
      size="md"
      showLabel
    />
  );
}

// ---------------------------------------------------------------------------
// Unified toolbar content — lives inside AnalysisBookmarkProvider so it can
// read markers from context. Triage active state derives from the provider's
// markers, so badge-X removals and triage button toggles stay in sync.
// ---------------------------------------------------------------------------

function DrawerToolbarContent({
  triageGroups,
  onTriageToggle,
  triageLoading,
  onDataChanged,
}: {
  triageGroups: MarkerGroup[];
  onTriageToggle: (groupId: number) => Promise<void>;
  triageLoading: boolean;
  onDataChanged?: () => void;
}) {
  const { bookmark, isBookmarked, markers, availableGroups, handleMarkerToggle, handleCreateCustomMarker } = useBookmarkContext();
  const refreshBookmark = useBookmarkRefresh();

  // Derive active triage IDs from the provider's markers (single source of truth)
  const triageGroupIds = useMemo(() => new Set(triageGroups.map(g => g.id)), [triageGroups]);
  const activeTriageIds = useMemo(
    () => new Set(markers.filter(m => triageGroupIds.has(m.id)).map(m => m.id)),
    [markers, triageGroupIds]
  );

  const handleTriage = useCallback(async (groupId: number) => {
    await onTriageToggle(groupId);
    await refreshBookmark();
    onDataChanged?.();
  }, [onTriageToggle, refreshBookmark, onDataChanged]);

  // Wrap marker toggle to also notify parent of changes
  const handleMarkerToggleWithRefresh = useCallback((bookmarkId: number, markerGroupId: number, assign: boolean) => {
    handleMarkerToggle(bookmarkId, markerGroupId, assign);
    onDataChanged?.();
  }, [handleMarkerToggle, onDataChanged]);

  return (
    <>
      {/* Triage tags */}
      {triageGroups.length > 0 && (
        <TriageButtons
          triageGroups={triageGroups}
          activeTriageIds={activeTriageIds}
          onToggle={handleTriage}
          disabled={triageLoading}
        />
      )}

      {/* Additional markers */}
      {isBookmarked && bookmark && bookmark.id > 0 && availableGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {markers.map(m => (
            <MarkerBadge
              key={m.id}
              name={m.name}
              color={m.color}
              size="sm"
              onRemove={() => handleMarkerToggleWithRefresh(bookmark.id, m.id, false)}
            />
          ))}
          <MarkerPicker
            bookmarkId={bookmark.id}
            assignedMarkerIds={markers.map(m => m.id)}
            availableGroups={availableGroups}
            onToggle={handleMarkerToggleWithRefresh}
            onCreateCustom={handleCreateCustomMarker}
          />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main drawer component
// ---------------------------------------------------------------------------

export function AnalysisDetailDrawer({ item, open, onOpenChange, jurisdiction, rows, currentIndex, onNavigate, onTriageChanged }: AnalysisDetailDrawerProps) {
  const [fullRecord, setFullRecord] = useState<FullRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [triageGroups, setTriageGroups] = useState<MarkerGroup[]>([]);
  const [triageLoading, setTriageLoading] = useState(false);
  const fetchVersionRef = useRef(0);

  // Build a stable key from the item to detect changes
  const itemKey = item
    ? item.kind === 'guidance'
      ? `guidance-${item.guidanceDocumentId}-${item.issueType}`
      : `reg-${item.documentId}-${item.issueType}`
    : null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < rows.length - 1;

  // Fetch triage marker groups once
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await getTriageMarkerGroups(jurisdiction);
      if (!cancelled && result.success) setTriageGroups(result.data);
    }
    load();
    return () => { cancelled = true; };
  }, [jurisdiction]);

  // Fetch full record when item changes or drawer opens (with cancellation guard)
  useEffect(() => {
    if (open && item) {
      const version = ++fetchVersionRef.current;
      setFullRecord(null);
      setLoading(true);
      setFetchError(null);

      const doFetch = async () => {
        try {
          const result = item.kind === 'guidance'
            ? await getFullGuidanceAnalysisRecord(item.guidanceDocumentId, item.issueType)
            : await getFullAnalysisRecord(item.documentId, item.issueType);

          // Discard if a newer navigation has started
          if (version !== fetchVersionRef.current) return;

          if (result.success && result.data) {
            setFullRecord(result.data);
          } else {
            setFetchError(result.success ? 'No analysis record found.' : result.error);
          }
        } catch (err) {
          if (version !== fetchVersionRef.current) return;
          setFetchError(err instanceof Error ? err.message : 'Failed to load analysis details.');
        } finally {
          if (version === fetchVersionRef.current) {
            setLoading(false);
          }
        }
      };

      doFetch();
    }
    if (!open) {
      fetchVersionRef.current++;
      setFullRecord(null);
      setFetchError(null);
    }
  }, [open, itemKey, item]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (isInteractiveElement(e)) return;

      if ((e.key === 'ArrowLeft' || e.key === 'p') && hasPrev) {
        e.preventDefault();
        onNavigate(currentIndex - 1);
      } else if ((e.key === 'ArrowRight' || e.key === 'n') && hasNext) {
        e.preventDefault();
        onNavigate(currentIndex + 1);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, hasPrev, hasNext, currentIndex, onNavigate]);

  // Handle triage tag toggle (state sync handled by DrawerToolbarContent)
  const handleTriageToggle = useCallback(async (markerGroupId: number) => {
    if (!item) return;
    setTriageLoading(true);

    const kind = item.kind;
    const docId = kind === 'guidance' ? item.guidanceDocumentId : item.documentId;
    await toggleTriageTag(kind, docId, item.issueType, markerGroupId, jurisdiction);

    setTriageLoading(false);
  }, [item, jurisdiction]);

  if (!item) return null;

  const issueTypeLabel = ISSUE_TYPE_LABELS[item.issueType as keyof typeof ISSUE_TYPE_LABELS] || item.issueType;

  const detailHref = item.kind === 'guidance'
    ? `/${jurisdiction.toLowerCase()}/pipeline/guidance/${item.guidanceDocumentId}/${item.issueType}`
    : `/${jurisdiction.toLowerCase()}/pipeline/${item.documentId}/${item.issueType}`;

  // Determine which classification to show as the "final" one
  const finalClassification = item.tier3Classification ?? item.tier2Classification ?? item.tier1Classification;

  // Bookmark provider props depend on the kind
  const bookmarkProviderProps = item.kind === 'guidance'
    ? { guidanceDocumentId: item.guidanceDocumentId, issueType: item.issueType, jurisdiction }
    : { documentId: item.documentId, issueType: item.issueType, jurisdiction };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" size="xl">
        <AnalysisBookmarkProvider {...bookmarkProviderProps}>
          <div className="flex flex-col h-full">
            <DrawerHeader>
              <div className="flex-1 min-w-0">
                <DrawerTitle>
                  <FileText className="w-4 h-4 inline-block mr-1.5 align-text-bottom text-[var(--color-text-secondary)]" />
                  {issueTypeLabel}
                </DrawerTitle>
                <div className="mt-1">
                  {item.kind === 'guidance' && item.agency && (
                    <div className="text-xs text-[var(--color-text-muted)] font-medium">
                      {item.agency}
                    </div>
                  )}
                  <div className="text-sm text-[var(--color-text-secondary)] truncate" title={item.documentTitle || ''}>
                    {item.documentTitle || 'Untitled'}
                  </div>
                  {item.kind === 'regulation' && item.citation && (
                    <div className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
                      {item.citation}
                    </div>
                  )}
                  {item.kind === 'guidance' && item.canonicalRef && (
                    <div className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
                      {item.canonicalRef}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SyncingBookmarkToggle onDataChanged={onTriageChanged} />
                <DrawerClose />
              </div>
            </DrawerHeader>

            {/* Sticky toolbar: navigation + triage tags */}
            <div className="sticky top-0 z-10 bg-[var(--color-surface)] border-b border-[var(--color-neutral-200)] px-4 py-2 space-y-2">
              {/* Navigation row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate(currentIndex - 1)}
                    disabled={!hasPrev}
                    className="p-1 rounded border border-[var(--color-neutral-300)] hover:bg-[var(--color-neutral-100)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Previous (← or P)"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                    {currentIndex + 1} of {rows.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate(currentIndex + 1)}
                    disabled={!hasNext}
                    className="p-1 rounded border border-[var(--color-neutral-300)] hover:bg-[var(--color-neutral-100)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Next (→ or N)"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <Link
                  href={detailHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline font-medium"
                >
                  Full details <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {/* Triage + markers — single component inside provider for state consistency */}
              <DrawerToolbarContent
                triageGroups={triageGroups}
                onTriageToggle={handleTriageToggle}
                triageLoading={triageLoading}
                onDataChanged={onTriageChanged}
              />
            </div>

            <DrawerBody className="p-4 space-y-6">
              {/* Bookmark Notes */}
              <BookmarkNotesCard />

              {/* --- Classification Summary --- */}
              <div className="space-y-4">
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                  Classification
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  <ClassificationBadge classification={finalClassification} />
                  <TierBadge highestTierCompleted={item.highestTierCompleted} />
                  {item.finalSeverity !== null && (
                    <SeverityBadge severity={item.finalSeverity} />
                  )}
                </div>
              </div>

              {/* --- Review Summary --- */}
              {item.reviewSummary && (
                <div className="border-t border-[var(--color-neutral-200)] pt-4">
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {item.reviewSummary}
                  </p>
                </div>
              )}

              {/* --- Tier Breakdown --- */}
              <div className="border-t border-[var(--color-neutral-200)] pt-4 space-y-3">
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                  Tier Breakdown
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-xs text-[var(--color-text-muted)] mb-1">Tier 1</div>
                    <ClassificationBadge classification={item.tier1Classification} />
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-[var(--color-text-muted)] mb-1">Tier 2</div>
                    <div className="flex flex-col items-center gap-0.5">
                      <ClassificationBadge classification={item.tier2Classification} />
                      {item.rerunCount > 0 && (
                        <span
                          className="text-[10px] px-1 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-medium"
                          title={`Tier 2 required ${item.rerunCount} re-run(s) for additional context`}
                        >
                          {item.rerunCount}x rerun
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-[var(--color-text-muted)] mb-1">Tier 3</div>
                    <ClassificationBadge classification={item.tier3Classification} />
                  </div>
                </div>
              </div>

              {/* --- Flags --- */}
              {(item.federalMandateFound || item.easyCleanupCandidate || item.tier3TriggerReason) && (
                <div className="border-t border-[var(--color-neutral-200)] pt-4 space-y-4">
                  <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Flags
                  </h4>

                  {/* Federal Mandate */}
                  {item.federalMandateFound && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        Federal Mandate
                      </span>
                    </div>
                  )}

                  {/* Easy Cleanup */}
                  {item.easyCleanupCandidate && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          Easy Cleanup{item.cleanupEffort ? ` (${item.cleanupEffort})` : ''}
                        </span>
                      </div>
                      {item.cleanupType && (
                        <p className="text-xs text-[var(--color-text-secondary)] ml-0.5">
                          Type: {item.cleanupType.replace(/_/g, ' ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tier 3 Trigger Reason */}
                  {item.tier3TriggerReason && (
                    <div>
                      <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-1">
                        Tier 3 Trigger
                      </h5>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {item.tier3TriggerReason}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* --- Full Analysis Details (loaded async) --- */}
              {loading && <DrawerSkeleton />}
              {fetchError && (
                <div className="border-t border-[var(--color-neutral-200)] pt-4">
                  <p className="text-sm text-[var(--color-danger)]">{fetchError}</p>
                </div>
              )}
              {fullRecord && !loading && <FullAnalysisContent record={fullRecord} />}

              {/* --- Metadata --- */}
              <div className="border-t border-[var(--color-neutral-200)] pt-4">
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                  Details
                </h4>
                <div className="text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-text-muted)]">Source</span>
                    <Badge variant={item.kind === 'guidance' ? 'info' : 'default'} className="text-xs">
                      {item.kind === 'guidance' ? 'Guidance' : 'Regulation'}
                    </Badge>
                  </div>
                  {item.kind === 'guidance' && item.docType && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-text-muted)]">Doc Type</span>
                      <span className="text-[var(--color-text)]">{item.docType}</span>
                    </div>
                  )}
                  {item.finalSeverity !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-text-muted)]">Severity Score</span>
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          item.finalSeverity >= 7
                            ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                            : item.finalSeverity >= 4
                              ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                              : 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                        }`}
                      >
                        {item.finalSeverity}
                      </span>
                    </div>
                  )}
                  {item.createdAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-text-muted)]">Created</span>
                      <span className="text-[var(--color-text)]">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </DrawerBody>
          </div>
        </AnalysisBookmarkProvider>
      </DrawerContent>
    </Drawer>
  );
}
