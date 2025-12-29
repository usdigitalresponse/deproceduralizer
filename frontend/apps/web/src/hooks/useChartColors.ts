'use client';

import { useMemo } from 'react';
import * as d3Scale from 'd3-scale';
import * as d3Interpolate from 'd3-interpolate';

/**
 * Design token colors resolved to hex values for D3 interpolation.
 * These match the values in styles/tokens.css
 */
const RESOLVED_COLORS = {
  // Semantic colors
  success: '#1e752e',
  successBg: '#dcfce7',
  warning: '#b45309',
  warningBg: '#fef3c7',
  danger: '#b52c2c',
  dangerBg: '#fee2e2',
  info: '#004dd1',
  infoBg: '#dbeafe',

  // Primary palette
  primary: '#154973',
  primaryStrong: '#0e324f',
  primaryStronger: '#081b2b',
  primaryMid: '#457aa5',
  primaryWeak: '#cddde9',
  primaryWeaker: '#eff6fb',

  // Neutrals
  neutral100: '#ededed',
  neutral200: '#d4d4d4',
  neutral300: '#b3b3b3',
  neutral400: '#8c8c8c',
  neutral500: '#6b6b6b',

  // Text
  text: '#1b1b1b',
  textSecondary: '#525252',
  textMuted: '#6b6b6b',
} as const;

/**
 * CSS variable references for use in JSX styles.
 * Use these when you want the browser to resolve the token at runtime.
 */
const CSS_TOKENS = {
  success: 'var(--color-success)',
  successBg: 'var(--color-success-bg)',
  warning: 'var(--color-warning)',
  warningBg: 'var(--color-warning-bg)',
  danger: 'var(--color-danger)',
  dangerBg: 'var(--color-danger-bg)',
  info: 'var(--color-info)',
  infoBg: 'var(--color-info-bg)',
  primary: 'var(--color-primary)',
  primaryStrong: 'var(--color-primary-strong)',
  primaryMid: 'var(--color-primary-mid)',
  primaryWeak: 'var(--color-primary-weak)',
  primaryWeaker: 'var(--color-primary-weaker)',
  neutral100: 'var(--color-neutral-100)',
  neutral200: 'var(--color-neutral-200)',
  text: 'var(--color-text)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
} as const;

/**
 * Hook providing D3 color scales and helpers integrated with design tokens.
 * Use this for all chart coloring to maintain design consistency.
 */
export function useChartColors() {
  return useMemo(() => {
    // Severity scale: 1-3 = success, 4-6 = warning, 7-10 = danger
    const severityScale = d3Scale
      .scaleThreshold<number, string>()
      .domain([4, 7])
      .range([RESOLVED_COLORS.success, RESOLVED_COLORS.warning, RESOLVED_COLORS.danger]);

    // Severity background scale for lighter fills
    const severityBgScale = d3Scale
      .scaleThreshold<number, string>()
      .domain([4, 7])
      .range([RESOLVED_COLORS.successBg, RESOLVED_COLORS.warningBg, RESOLVED_COLORS.dangerBg]);

    // Hierarchy depth scale (for treemap levels)
    const depthScale = d3Scale
      .scaleOrdinal<number, string>()
      .domain([0, 1, 2, 3, 4])
      .range([
        RESOLVED_COLORS.primaryStrong,
        RESOLVED_COLORS.primary,
        RESOLVED_COLORS.primaryMid,
        RESOLVED_COLORS.primaryWeak,
        RESOLVED_COLORS.primaryWeaker,
      ]);

    // Sequential scale for heatmaps (low to high intensity)
    const heatmapScale = d3Scale
      .scaleSequential<string>()
      .domain([0, 10])
      .interpolator(
        d3Interpolate.interpolateRgbBasis([
          RESOLVED_COLORS.primaryWeaker,
          RESOLVED_COLORS.warning,
          RESOLVED_COLORS.danger,
        ])
      );

    // Categorical scale for section types, issue types, etc.
    const categoryScale = d3Scale.scaleOrdinal<string, string>().range([
      RESOLVED_COLORS.primary,
      RESOLVED_COLORS.info,
      RESOLVED_COLORS.success,
      RESOLVED_COLORS.warning,
      '#7c3aed', // violet
      '#0891b2', // cyan
      '#be185d', // pink
      '#65a30d', // lime
      '#ea580c', // orange
      '#6366f1', // indigo
      '#14b8a6', // teal
      '#f59e0b', // amber
      '#8b5cf6', // purple
    ]);

    // Review status colors
    const reviewStatusColors: Record<string, string> = {
      unreviewed: RESOLVED_COLORS.neutral400,
      confirmed: RESOLVED_COLORS.success,
      false_positive: RESOLVED_COLORS.neutral300,
      rejected_clear_fp: RESOLVED_COLORS.neutral300,
      rejected_not_obvious_bad: RESOLVED_COLORS.neutral400,
      needs_context: RESOLVED_COLORS.warning,
      deferred: RESOLVED_COLORS.info,
    };

    return {
      // Scales
      severityScale,
      severityBgScale,
      depthScale,
      heatmapScale,
      categoryScale,
      reviewStatusColors,

      // Direct color access
      colors: RESOLVED_COLORS,
      tokens: CSS_TOKENS,

      // Helper: Get severity color for a value
      getSeverityColor: (severity: number | null | undefined): string => {
        if (severity == null) return RESOLVED_COLORS.neutral400;
        return severityScale(severity);
      },

      // Helper: Get severity background color
      getSeverityBgColor: (severity: number | null | undefined): string => {
        if (severity == null) return RESOLVED_COLORS.neutral100;
        return severityBgScale(severity);
      },

      // Helper: Get severity CSS token (for dynamic styling)
      getSeverityToken: (severity: number | null | undefined): string => {
        if (severity == null) return CSS_TOKENS.neutral200;
        if (severity >= 7) return CSS_TOKENS.danger;
        if (severity >= 4) return CSS_TOKENS.warning;
        return CSS_TOKENS.success;
      },

      // Helper: Get contrasting text color for a background
      getContrastColor: (backgroundColor: string): string => {
        // Simple luminance check for light/dark backgrounds
        const hex = backgroundColor.replace('#', '');
        if (hex.length !== 6) return RESOLVED_COLORS.text;

        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);

        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? RESOLVED_COLORS.text : '#ffffff';
      },

      // Helper: Get pie/donut chart colors for severity distribution
      getSeverityPieColors: () => [
        { label: 'High (7-10)', color: RESOLVED_COLORS.danger },
        { label: 'Medium (4-6)', color: RESOLVED_COLORS.warning },
        { label: 'Low (1-3)', color: RESOLVED_COLORS.success },
        { label: 'Not Analyzed', color: RESOLVED_COLORS.neutral300 },
      ],

      // Helper: Get pie/donut chart colors for review status
      getReviewStatusPieColors: () => [
        { label: 'Unreviewed', color: RESOLVED_COLORS.neutral400 },
        { label: 'Confirmed', color: RESOLVED_COLORS.success },
        { label: 'False Positive', color: RESOLVED_COLORS.neutral300 },
        { label: 'Needs Context', color: RESOLVED_COLORS.warning },
        { label: 'Deferred', color: RESOLVED_COLORS.info },
      ],
    };
  }, []);
}

export type ChartColors = ReturnType<typeof useChartColors>;
