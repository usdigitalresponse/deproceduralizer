'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { ChordData } from './types';

// Dynamically import ResponsiveChord to avoid SSR issues
const ResponsiveChord = dynamic(
  () => import('@nivo/chord').then((mod) => mod.ResponsiveChord),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-[var(--color-text-muted)]">Loading chord diagram...</div>
      </div>
    ),
  }
);

// Scope level colors
const LEVEL_COLORS: Record<string, string> = {
  title: '#dc2626',
  chapter: '#f97316',
  part: '#22c55e',
  section: '#3b82f6',
  '1': '#dc2626', // hierarchy level 1 = title
  '2': '#f97316', // hierarchy level 2 = chapter
  '3': '#22c55e', // hierarchy level 3 = part
  '4': '#3b82f6', // hierarchy level 4 = section
  '5': '#8b5cf6', // hierarchy level 5 = subsection
};

// Readable level names
const LEVEL_NAMES: Record<string, string> = {
  title: 'Title',
  chapter: 'Chapter',
  part: 'Part',
  section: 'Section',
  '1': 'Title',
  '2': 'Chapter',
  '3': 'Part/Subchapter',
  '4': 'Section',
  '5': 'Subsection',
};

interface DefinitionChordDiagramProps {
  data: ChordData;
  height: number;
}

export function DefinitionChordDiagram({ data, height }: DefinitionChordDiagramProps) {
  // Transform keys to readable names and get colors
  const chartData = useMemo(() => {
    const keys = data.keys.map((k) => LEVEL_NAMES[k] ?? k);
    const colors = data.keys.map((k) => LEVEL_COLORS[k] ?? 'var(--color-neutral-400)');
    return { keys, colors, matrix: data.matrix };
  }, [data]);

  if (data.keys.length === 0 || data.matrix.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        No scope flow data available
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveChord
        data={chartData.matrix}
        keys={chartData.keys}
        margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
        padAngle={0.02}
        innerRadiusRatio={0.96}
        innerRadiusOffset={0.02}
        arcOpacity={1}
        arcBorderWidth={1}
        arcBorderColor={{
          from: 'color',
          modifiers: [['darker', 0.4]],
        }}
        ribbonOpacity={0.5}
        ribbonBorderWidth={1}
        ribbonBorderColor={{
          from: 'color',
          modifiers: [['darker', 0.4]],
        }}
        colors={chartData.colors}
        enableLabel={true}
        label="id"
        labelOffset={12}
        labelRotation={-90}
        labelTextColor={{
          from: 'color',
          modifiers: [['darker', 1]],
        }}
        isInteractive={true}
        activeArcOpacity={1}
        inactiveArcOpacity={0.25}
        activeRibbonOpacity={0.75}
        inactiveRibbonOpacity={0.25}
        legends={[
          {
            anchor: 'bottom',
            direction: 'row',
            translateY: 30,
            itemWidth: 80,
            itemHeight: 14,
            itemTextColor: 'var(--color-text-secondary)',
            symbolSize: 12,
            symbolShape: 'circle',
          },
        ]}
      />
    </div>
  );
}
