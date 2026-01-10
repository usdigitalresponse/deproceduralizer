export const SCOPE_LEVELS = [
  { value: 'none', label: 'Not specified' },
  { value: 'section', label: 'Section' },
  { value: 'subpart', label: 'Subpart' },
  { value: 'part', label: 'Part' },
  { value: 'subchapter', label: 'Subchapter' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'subtitle', label: 'Subtitle' },
  { value: 'title', label: 'Title' },
];

export const DEFINITION_TYPES = [
  { value: 'formal', label: 'Formal' },
  { value: 'abbreviation', label: 'Abbreviation' },
];

export const REFERENCE_COMPLETENESS_OPTIONS = [
  { value: 'none', label: 'Not specified' },
  { value: 'pure_pointer', label: 'Pure Pointer' },
  { value: 'hybrid', label: 'Hybrid' },
];

export const REFERENCE_TARGET_OPTIONS = [
  { value: 'none', label: 'Not specified' },
  { value: 'same_corpus', label: 'Same Corpus (NJ/NY)' },
  { value: 'federal', label: 'Federal (CFR/USC)' },
  { value: 'external_standard', label: 'External Standard' },
  { value: 'other', label: 'Other' },
];
