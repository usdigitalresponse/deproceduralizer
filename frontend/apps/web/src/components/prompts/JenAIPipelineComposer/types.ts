export interface JenAIPromptLayer {
  content: string;
  tokenEstimate: number;
  cacheStatus: 'global' | 'per-subchapter' | 'never-cached';
  placeholdersReplaced?: string[];
  placeholdersRemaining?: string[];
}

export interface JenAIContextMetadata {
  ancestorChain: Array<{ level: string; citation: string; title: string }>;
  siblingCount: number;
  definitionCount: number;
  crossRefCount: number;
  documentTitle: string;
  documentCitation: string;
  documentHierarchyLevel: string;
  jurisdiction: string;
}

export interface JenAIComposedPrompt {
  layers: {
    system: JenAIPromptLayer;
    batch_context: JenAIPromptLayer;
    template: JenAIPromptLayer;
  };
  totalTokenEstimate: number;
  context: JenAIContextMetadata;
}

export interface SectionSearchResult {
  id: number;
  title: string;
  citation: string | null;
  hierarchyLevel: string | null;
  jurisdiction: string | null;
}
