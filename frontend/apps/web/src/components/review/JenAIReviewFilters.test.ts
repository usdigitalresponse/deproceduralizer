import { describe, it, expect } from 'vitest';
import { formatLabel } from '@/types/regulation';

/**
 * Test the conditional visibility and option-building logic
 * used by JenAIReviewFilters and JenAIDeveloperFilters.
 * Pure logic tests — no rendering.
 */

// Mirrors the isGuidanceOnly check in the filter components
function shouldShowPartFilter(source: string | null): boolean {
  return source !== 'guidance';
}

function shouldShowSectionTypeFilter(source: string | null): boolean {
  return source !== 'guidance';
}

describe('JenAI filter visibility logic', () => {
  it('hides part filter when source is "guidance"', () => {
    expect(shouldShowPartFilter('guidance')).toBe(false);
  });

  it('shows part filter when source is "all"', () => {
    expect(shouldShowPartFilter('all')).toBe(true);
  });

  it('shows part filter when source is "regulation"', () => {
    expect(shouldShowPartFilter('regulation')).toBe(true);
  });

  it('shows part filter when source is null', () => {
    expect(shouldShowPartFilter(null)).toBe(true);
  });

  it('hides section type filter when source is "guidance"', () => {
    expect(shouldShowSectionTypeFilter('guidance')).toBe(false);
  });

  it('shows section type filter when source is "all"', () => {
    expect(shouldShowSectionTypeFilter('all')).toBe(true);
  });

  it('shows section type filter when source is "regulation"', () => {
    expect(shouldShowSectionTypeFilter('regulation')).toBe(true);
  });
});

// Mirrors the part option building logic (with count prop, no inline count in label)
function buildPartOptions(
  parts: { part: string; partName: string | null; count: number }[],
) {
  return parts.map(p => ({
    value: p.part,
    label: p.partName
      ? `${p.partName} (Part ${p.part})`
      : `Part ${p.part}`,
    count: p.count,
  }));
}

describe('JenAI part option building', () => {
  it('builds part options with part name and count prop', () => {
    const parts = [
      { part: '418', partName: 'Child Care', count: 42 },
      { part: '413', partName: 'Family Court', count: 10 },
    ];

    const options = buildPartOptions(parts);

    expect(options).toEqual([
      { value: '418', label: 'Child Care (Part 418)', count: 42 },
      { value: '413', label: 'Family Court (Part 413)', count: 10 },
    ]);
  });

  it('builds part options without part name', () => {
    const parts = [{ part: '99', partName: null, count: 1 }];
    const options = buildPartOptions(parts);

    expect(options[0].label).toBe('Part 99');
    expect(options[0].count).toBe(1);
  });

  it('returns empty array for empty input', () => {
    expect(buildPartOptions([])).toEqual([]);
  });
});

// Mirrors section type option building (with count prop)
function buildSectionTypeOptions(sectionTypes: { sectionType: string; count: number }[]) {
  return sectionTypes.map(st => ({
    value: st.sectionType,
    label: formatLabel(st.sectionType),
    count: st.count,
  }));
}

describe('JenAI section type option building', () => {
  it('builds section type options with formatted labels and count prop', () => {
    const sectionTypes = [
      { sectionType: 'requirements', count: 100 },
      { sectionType: 'penalties', count: 20 },
    ];

    const options = buildSectionTypeOptions(sectionTypes);

    expect(options).toHaveLength(2);
    expect(options[0].value).toBe('requirements');
    expect(options[0]).toHaveProperty('count', 100);
    expect(options[1].value).toBe('penalties');
    expect(options[1]).toHaveProperty('count', 20);
  });

  it('returns empty array for empty input', () => {
    expect(buildSectionTypeOptions([])).toEqual([]);
  });
});

// Mirrors category option building (with count prop)
function buildCategoryOptions(categories: { category: string; count: number }[]) {
  const JENAI_CATEGORY_LABELS: Record<string, string> = {};
  return categories.map(cat => ({
    value: cat.category,
    label: JENAI_CATEGORY_LABELS[cat.category] || formatLabel(cat.category),
    count: cat.count,
  }));
}

describe('JenAI category option building', () => {
  it('builds category options with count prop', () => {
    const categories = [
      { category: 'unnecessary_complexity', count: 50 },
    ];

    const options = buildCategoryOptions(categories);

    expect(options[0]).toHaveProperty('count', 50);
    expect(options[0].value).toBe('unnecessary_complexity');
  });
});
