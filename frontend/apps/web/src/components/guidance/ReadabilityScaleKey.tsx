'use client';

const EASE_LEVELS = [
  { range: '0–29', label: 'Very Difficult', color: 'var(--color-danger)', description: 'College graduate+' },
  { range: '30–49', label: 'Difficult', color: 'var(--color-warning)', description: 'College level' },
  { range: '50–59', label: 'Fairly Difficult', color: 'var(--color-warning-muted)', description: '10th–12th grade' },
  { range: '60–69', label: 'Standard', color: 'var(--color-text-muted)', description: '8th–9th grade' },
  { range: '70–100', label: 'Easy', color: 'var(--color-success)', description: '7th grade & below' },
];

const GRADE_LEVELS = [
  { range: '< 8', label: 'Middle school', color: 'var(--color-success)' },
  { range: '8–12', label: 'High school', color: 'var(--color-text-muted)' },
  { range: '13–16', label: 'College', color: 'var(--color-warning)' },
  { range: '17+', label: 'Graduate', color: 'var(--color-danger)' },
];

export function FleschEaseKey() {
  return (
    <div className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-3">
      <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Flesch Reading Ease Scale</p>
      <div className="space-y-1">
        {EASE_LEVELS.map(level => (
          <div key={level.range} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: level.color }}
            />
            <span className="font-medium text-[var(--color-text)] w-10">{level.range}</span>
            <span className="text-[var(--color-text-secondary)]">{level.label}</span>
            <span className="text-[var(--color-text-muted)] ml-auto">{level.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GradeLevelKey() {
  return (
    <div className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-3">
      <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Flesch-Kincaid Grade Level</p>
      <div className="space-y-1">
        {GRADE_LEVELS.map(level => (
          <div key={level.range} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: level.color }}
            />
            <span className="font-medium text-[var(--color-text)] w-10">{level.range}</span>
            <span className="text-[var(--color-text-secondary)]">{level.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
        Corresponds to US school grade needed to understand the text
      </p>
    </div>
  );
}
