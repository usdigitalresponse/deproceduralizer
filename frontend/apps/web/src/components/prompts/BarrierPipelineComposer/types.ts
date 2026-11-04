export interface BarrierPromptLayer {
  content: string;
  tokenEstimate: number;
  cacheStatus: 'global' | 'per-subchapter' | 'never-cached';
  placeholdersReplaced?: string[];
  placeholdersRemaining?: string[];
}

export interface BarrierContextMetadata {
  ancestorChain: Array<{ level: string; citation: string; title: string }>;
  siblingCount: number;
  definitionCount: number;
  crossRefCount: number;
  documentTitle: string;
  documentCitation: string;
  documentHierarchyLevel: string;
  jurisdiction: string;
}

export interface BarrierComposedPrompt {
  layers: {
    system: BarrierPromptLayer;
    batch_context: BarrierPromptLayer;
    template: BarrierPromptLayer;
  };
  totalTokenEstimate: number;
  context: BarrierContextMetadata;
}

export interface SectionSearchResult {
  id: number;
  title: string;
  citation: string | null;
  hierarchyPath: string | null;
  jurisdiction: string | null;
}
