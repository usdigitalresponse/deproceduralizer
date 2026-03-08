export interface FinesPromptLayer {
  content: string;
  tokenEstimate: number;
  cacheStatus: 'global' | 'never-cached';
  placeholdersReplaced?: string[];
  placeholdersRemaining?: string[];
}

export interface FinesContextMetadata {
  documentTitle: string;
  documentCitation: string;
  sourceType: 'regulation' | 'guidance';
  responsibleAgency: string | null;
  nycrTitle: number | null;
  jurisdiction: string;
  matchedPatterns: string[];
  contentLength: number;
  wasWindowed: boolean;
}

export interface FinesComposedPrompt {
  layers: {
    system: FinesPromptLayer;
    template: FinesPromptLayer;
  };
  totalTokenEstimate: number;
  context: FinesContextMetadata;
}

export interface DocumentSearchResult {
  id: number;
  title: string;
  citation: string | null;
  hierarchyPath: string | null;
  jurisdiction: string | null;
}
