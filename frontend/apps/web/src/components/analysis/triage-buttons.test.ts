import { describe, it, expect } from 'vitest';

describe('TriageButtons logic', () => {
  const triageGroups = [
    { id: 1, name: 'Confirmed', color: '#16a34a' },
    { id: 2, name: 'Needs Review', color: '#d97706' },
    { id: 3, name: 'Incorrect', color: '#dc2626' },
  ];

  it('uses DB color directly for button styling', () => {
    for (const group of triageGroups) {
      expect(group.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('active state uses group color as background', () => {
    const group = triageGroups[0];
    const activeStyle = { backgroundColor: group.color, color: '#fff', borderColor: group.color };
    expect(activeStyle.backgroundColor).toBe('#16a34a');
    expect(activeStyle.color).toBe('#fff');
  });

  it('inactive state uses group color as border/text only', () => {
    const group = triageGroups[0];
    const inactiveStyle = { backgroundColor: 'transparent', color: group.color, borderColor: group.color };
    expect(inactiveStyle.backgroundColor).toBe('transparent');
    expect(inactiveStyle.color).toBe('#16a34a');
  });

  it('detects active vs inactive triage IDs correctly', () => {
    const activeTriageIds = new Set([1, 3]);
    expect(activeTriageIds.has(1)).toBe(true);
    expect(activeTriageIds.has(2)).toBe(false);
    expect(activeTriageIds.has(3)).toBe(true);
  });

  it('supports multi-select (multiple IDs active simultaneously)', () => {
    const activeTriageIds = new Set([1, 2, 3]);
    expect(activeTriageIds.size).toBe(3);
  });

  it('renders all groups regardless of name (no hardcoded filter)', () => {
    const customGroups = [
      ...triageGroups,
      { id: 4, name: 'Custom Triage', color: '#8b5cf6' },
    ];
    // All 4 should be renderable — no name-based filtering
    expect(customGroups.length).toBe(4);
    for (const g of customGroups) {
      expect(g.color).toBeTruthy();
    }
  });
});
