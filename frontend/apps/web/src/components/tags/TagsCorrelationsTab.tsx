'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ResponsiveSankey } from '@nivo/sankey';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { HeatmapGrid } from '@/components/charts/HeatmapGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { getTagCooccurrence, getTagFlow } from '@/lib/actions/tags';
import type { TagCooccurrenceResult, TagFlowResult } from '@/lib/actions/tags';
import type { JurisdictionCode } from '@deproceduralizer/database';
import { getFieldMultiselectOptions } from '@/lib/constants/tags';
import type { HeatmapData } from '@/lib/charts/types';

// ---------------------------------------------------------------------------
// Field options for dropdowns
// ---------------------------------------------------------------------------

const FIELD_OPTIONS = getFieldMultiselectOptions().map(f => ({
  value: f.value,
  label: f.label,
}));

// ---------------------------------------------------------------------------
// Sankey preset configurations
// ---------------------------------------------------------------------------

interface SankeyPreset {
  label: string;
  stages: string[];
}

const SANKEY_PRESETS: SankeyPreset[] = [
  {
    label: 'Regulation Journey',
    stages: ['reg_section_type', 'reg_keywords', 'issue_type', 'tier_classification'],
  },
  {
    label: 'Fines Flow',
    stages: ['activity_category', 'penalty_type', 'who_pays_normalized', 'jurisdiction_level'],
  },
];

// ---------------------------------------------------------------------------
// Heatmap helpers
// ---------------------------------------------------------------------------

function toHeatmapData(result: TagCooccurrenceResult): HeatmapData {
  const maxValue = result.matrix.reduce(
    (max, cell) => Math.max(max, cell.count),
    0,
  );

  return {
    rows: result.valuesA,
    columns: result.valuesB,
    cells: result.matrix.map(cell => ({
      row: cell.valueA,
      column: cell.valueB,
      value: cell.count,
    })),
    maxValue,
  };
}

// ---------------------------------------------------------------------------
// Sankey helpers
// ---------------------------------------------------------------------------

interface SankeyData {
  nodes: Array<{ id: string }>;
  links: Array<{ source: string; target: string; value: number }>;
}

function toSankeyData(result: TagFlowResult): SankeyData {
  const nodes = result.nodes.map(id => ({ id }));
  const links = result.links.map(l => ({
    source: l.source,
    target: l.target,
    value: l.value,
  }));

  return { nodes, links };
}

// ---------------------------------------------------------------------------
// Zoomable Sankey wrapper (scroll-to-zoom + drag-to-pan)
// ---------------------------------------------------------------------------

function SankeyZoomable({ data }: { data: SankeyData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(4, Math.max(0.5, prev + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translate };
  }, [scale, translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setTranslate({
      x: translateStart.current.x + (e.clientX - dragStart.current.x),
      y: translateStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // Render Sankey at a larger internal size for better detail when zoomed
  const innerHeight = 450;

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-[var(--color-bg)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] px-1.5 py-1 shadow-sm">
        <button
          type="button"
          onClick={() => setScale(prev => Math.min(4, prev + 0.25))}
          className="w-6 h-6 flex items-center justify-center text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)] rounded"
          aria-label="Zoom in"
        >
          +
        </button>
        <span className="text-xs text-[var(--color-text-muted)] tabular-nums w-10 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))}
          className="w-6 h-6 flex items-center justify-center text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)] rounded"
          aria-label="Zoom out"
        >
          −
        </button>
        {scale !== 1 && (
          <button
            type="button"
            onClick={handleReset}
            className="ml-0.5 px-1.5 h-6 flex items-center justify-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)] rounded"
          >
            Reset
          </button>
        )}
      </div>

      {/* Zoomable container */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="overflow-hidden rounded-[var(--radius-md)]"
        style={{
          height: innerHeight,
          cursor: scale > 1 ? (isDragging.current ? 'grabbing' : 'grab') : 'default',
        }}
      >
        <div
          style={{
            height: innerHeight,
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging.current ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <ResponsiveSankey
            data={data}
            margin={{ top: 20, right: 160, bottom: 20, left: 20 }}
            align="justify"
            colors={{ scheme: 'category10' }}
            nodeOpacity={1}
            nodeHoverOthersOpacity={0.35}
            nodeThickness={18}
            nodeSpacing={24}
            nodeBorderWidth={0}
            nodeBorderRadius={3}
            linkOpacity={0.4}
            linkHoverOthersOpacity={0.1}
            linkContract={3}
            enableLinkGradient={true}
            labelPosition="outside"
            labelOrientation="horizontal"
            labelPadding={16}
            labelTextColor={{ from: 'color', modifiers: [['darker', 1]] }}
            animate={true}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TagsCorrelationsTabProps {
  jurisdiction: string;
}

export function TagsCorrelationsTab({ jurisdiction }: TagsCorrelationsTabProps) {
  // --- Heatmap state ---
  const [fieldA, setFieldA] = useState('activity_category');
  const [fieldB, setFieldB] = useState('jenai_category');
  const [cooccurrence, setCooccurrence] = useState<TagCooccurrenceResult | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);

  // --- Sankey state ---
  const [sankeyStages, setSankeyStages] = useState<string[]>(SANKEY_PRESETS[0].stages);
  const [flowResult, setFlowResult] = useState<TagFlowResult | null>(null);
  const [sankeyLoading, setSankeyLoading] = useState(true);
  const [sankeyError, setSankeyError] = useState<string | null>(null);

  // --- Fetch heatmap data ---
  useEffect(() => {
    let cancelled = false;
    setHeatmapLoading(true);
    setHeatmapError(null);

    getTagCooccurrence(jurisdiction as JurisdictionCode, fieldA, fieldB).then(result => {
      if (cancelled) return;
      setHeatmapLoading(false);
      if (result.success) {
        setCooccurrence(result.data);
      } else {
        setHeatmapError(result.error);
      }
    });

    return () => { cancelled = true; };
  }, [jurisdiction, fieldA, fieldB]);

  // --- Fetch sankey data ---
  useEffect(() => {
    if (sankeyStages.length < 2) return;
    let cancelled = false;
    setSankeyLoading(true);
    setSankeyError(null);

    getTagFlow(jurisdiction as JurisdictionCode, sankeyStages).then(result => {
      if (cancelled) return;
      setSankeyLoading(false);
      if (result.success) {
        setFlowResult(result.data);
      } else {
        setSankeyError(result.error);
      }
    });

    return () => { cancelled = true; };
  }, [jurisdiction, sankeyStages]);

  // --- Heatmap data ---
  const heatmapData = useMemo(() => {
    if (!cooccurrence) return null;
    return toHeatmapData(cooccurrence);
  }, [cooccurrence]);

  // --- Sankey data ---
  const sankeyData = useMemo(() => {
    if (!flowResult || flowResult.nodes.length === 0 || flowResult.links.length === 0) return null;
    return toSankeyData(flowResult);
  }, [flowResult]);

  // --- Stage management ---
  const handleAddStage = useCallback(() => {
    if (sankeyStages.length >= 4) return;
    // Find the first field not already chosen
    const remaining = FIELD_OPTIONS.find(f => !sankeyStages.includes(f.value));
    if (remaining) {
      setSankeyStages(prev => [...prev, remaining.value]);
    }
  }, [sankeyStages]);

  const handleRemoveStage = useCallback((index: number) => {
    setSankeyStages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleStageChange = useCallback((index: number, value: string) => {
    setSankeyStages(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handlePreset = useCallback((preset: SankeyPreset) => {
    setSankeyStages(preset.stages);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top: Heatmap */}
      <Card padding="lg">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              Tag Co-occurrence Heatmap
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              How often values from two tag fields appear on the same document.
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                X-Axis:
              </label>
              <div className="w-48">
                <Select
                  value={fieldA}
                  onValueChange={setFieldA}
                  options={FIELD_OPTIONS}
                  aria-label="X-axis field"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                Y-Axis:
              </label>
              <div className="w-48">
                <Select
                  value={fieldB}
                  onValueChange={setFieldB}
                  options={FIELD_OPTIONS}
                  aria-label="Y-axis field"
                />
              </div>
            </div>
          </div>

          <div className="min-h-[300px]">
            {heatmapLoading ? (
              <div className="text-[var(--color-text-muted)] text-sm py-12 text-center">
                Loading heatmap...
              </div>
            ) : heatmapError ? (
              <EmptyState title="Failed to load heatmap" description={heatmapError} />
            ) : !heatmapData || heatmapData.cells.length === 0 ? (
              <EmptyState title="No co-occurrence data" description="These two fields don't share any documents." />
            ) : (
              <ChartContainer
                aspectRatio={16 / 9}
                minHeight={300}
                maxHeight={500}
                variant="bordered"
                padding="sm"
              >
                {({ width, height }) => (
                  <HeatmapGrid data={heatmapData} width={width} height={height} />
                )}
              </ChartContainer>
            )}
          </div>
        </div>
      </Card>

      {/* Bottom: Sankey */}
      <Card padding="lg">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              Tag Flow (Sankey)
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              How documents flow through stages of tag values.
            </p>
          </div>

          {/* Preset buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--color-text-muted)]">Presets:</span>
            {SANKEY_PRESETS.map(preset => (
              <Button
                key={preset.label}
                variant="secondary"
                size="sm"
                onClick={() => handlePreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Stage dropdowns */}
          <div className="flex items-end gap-3 flex-wrap">
            {sankeyStages.map((stage, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <label className="text-xs text-[var(--color-text-muted)]">
                    Stage {idx + 1}
                  </label>
                  {sankeyStages.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStage(idx)}
                      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] ml-1"
                      aria-label={`Remove stage ${idx + 1}`}
                    >
                      x
                    </button>
                  )}
                </div>
                <div className="w-44">
                  <Select
                    value={stage}
                    onValueChange={(v) => handleStageChange(idx, v)}
                    options={FIELD_OPTIONS}
                    aria-label={`Stage ${idx + 1} field`}
                  />
                </div>
              </div>
            ))}
            {sankeyStages.length < 4 && (
              <Button variant="secondary" size="sm" onClick={handleAddStage}>
                + Stage
              </Button>
            )}
          </div>

          <div className="min-h-[400px]">
            {sankeyLoading ? (
              <div className="text-[var(--color-text-muted)] text-sm py-12 text-center">
                Loading flow data...
              </div>
            ) : sankeyError ? (
              <EmptyState title="Failed to load flow data" description={sankeyError} />
            ) : !sankeyData ? (
              <EmptyState title="No flow data" description="No connections found for these stages." />
            ) : (
              <SankeyZoomable data={sankeyData} />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
