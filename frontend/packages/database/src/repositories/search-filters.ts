import type { SearchOptions } from './search.repository';

type FilterOptions = Pick<SearchOptions,
  'docType' | 'sectionType' | 'hierarchyLevel' | 'issueSystem' | 'classification'
>;

export function shouldExcludeStatutes(opts: FilterOptions): boolean {
  return opts.docType === 'regulation'
    || opts.docType === 'guidance'
    || !!opts.sectionType
    || !!opts.hierarchyLevel
    || !!opts.issueSystem;
}

export function shouldExcludeRegulations(opts: Pick<SearchOptions, 'docType'>): boolean {
  return opts.docType === 'statute'
    || opts.docType === 'guidance';
}

export function shouldExcludeGuidance(opts: FilterOptions): boolean {
  return opts.docType === 'regulation'
    || opts.docType === 'statute'
    || !!opts.hierarchyLevel;
}

export function shouldSkipAnalyses(issueSystem?: string | null): boolean {
  return issueSystem === 'none' || issueSystem === 'jenai';
}
