import type { SearchOptions } from './search.repository';

type FilterOptions = Pick<SearchOptions,
  'docType' | 'sectionType' | 'hierarchyLevel' | 'hasAnalysis' | 'classification'
>;

export function shouldExcludeStatutes(opts: FilterOptions): boolean {
  return opts.docType === 'regulation'
    || !!opts.sectionType
    || !!opts.hierarchyLevel
    || opts.hasAnalysis === 'true'
    || !!opts.classification;
}

export function shouldExcludeRegulations(opts: Pick<SearchOptions, 'docType'>): boolean {
  return opts.docType === 'statute';
}

export function shouldSkipAnalyses(hasAnalysis?: string | null): boolean {
  return hasAnalysis === 'false';
}
