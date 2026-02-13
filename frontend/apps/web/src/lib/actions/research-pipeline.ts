'use server';

import 'server-only';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import { type ActionResult, success, failure, getErrorMessage } from './types';

// =============================================================================
// Types for Research Pipeline
// =============================================================================

export interface TierPromptData {
  updated_at: string;
  description: string;
  static_core: string;
  issue_block: string;
  batch_context: string;
  document_template: string;
}

export interface ResearchPipelineData {
  tier1: TierPromptData;
  tier2: TierPromptData;
  tier3: TierPromptData;
}

export interface ExampleCase {
  citation: string;
  quote: string;
  reasoning: string;
  classification: 'burdensome' | 'unrelated' | 'justified';
  severity?: number;
}

export interface SeverityModifiers {
  increases: string[];
  decreases: string[];
}

export interface IssueStatistics {
  total_matches: number;
  true_positives: number;
  true_positive_rate: number;
  sample_date: string;
}

export interface IssueConfig {
  name: string;
  display_name: string;
  db_issue_type: string;
  category: string;
  description: string;
  positive_indicators: string[];
  negative_indicators: string[];
  severity_baseline: number;
  severity_modifiers: SeverityModifiers;
  patterns: string[];
  exclusion_patterns: string[];
  statistics: IssueStatistics;
  legal_context?: string;
  examples: {
    true_positives: ExampleCase[];
    false_positives: ExampleCase[];
    justified: ExampleCase[];
  };
  updated_at: string;
}

export interface PromptLayer {
  content: string;
  tokenEstimate: number;
  cacheStatus: 'global' | 'per-issue-type' | 'per-subchapter' | 'never-cached';
  placeholdersReplaced?: string[];
  placeholdersRemaining?: string[];
}

export interface ComposedPrompt {
  tier: 1 | 2 | 3;
  tierName: string;
  tierDescription: string;
  issueType: string;
  layers: {
    static_core: PromptLayer;
    issue_block: PromptLayer;
    batch_context: PromptLayer;
    document_template: PromptLayer;
  };
  totalTokenEstimate: number;
}

// =============================================================================
// Raw YAML Types (for parsing)
// =============================================================================

interface RawTierPrompt {
  updated_at?: string;
  description?: string;
  static_core?: string;
  issue_block?: string;
  batch_context?: string;
  document_template?: string;
}

interface RawResearchPipeline {
  tier1?: RawTierPrompt;
  tier2?: RawTierPrompt;
  tier3?: RawTierPrompt;
}

interface RawIssueConfigEntry {
  updated_at?: string;
  display_name?: string;
  db_issue_type?: string;
  category?: string;
  description?: string;
  positive_indicators?: string[];
  negative_indicators?: string[];
  severity_baseline?: number;
  severity_modifiers?: {
    increases?: string[];
    decreases?: string[];
  };
  patterns?: string[];
  exclusion_patterns?: string[];
  statistics?: {
    total_matches?: number;
    true_positives?: number;
    true_positive_rate?: number;
    sample_date?: string;
  };
  legal_context?: string;
  examples?: {
    true_positives?: ExampleCase[];
    false_positives?: ExampleCase[];
    justified?: ExampleCase[];
  };
}

type RawIssueConfig = Record<string, RawIssueConfigEntry>;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Rough token estimation (~4 chars per token for English)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract placeholder variables from template
 */
function extractPlaceholders(text: string): string[] {
  const pattern = /\{(\w+)\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = pattern.exec(text)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

/**
 * Parse tier data from raw YAML
 */
function parseTierData(raw: RawTierPrompt | undefined, tierName: string): TierPromptData {
  return {
    updated_at: raw?.updated_at || '',
    description: raw?.description || `Tier ${tierName}`,
    static_core: raw?.static_core?.trim() || '',
    issue_block: raw?.issue_block?.trim() || '',
    batch_context: raw?.batch_context?.trim() || '',
    document_template: raw?.document_template?.trim() || '',
  };
}

// =============================================================================
// Server Actions
// =============================================================================

/**
 * Load and parse research pipeline prompts from research_pipeline.yaml
 */
export async function getResearchPipelinePrompts(): Promise<ActionResult<ResearchPipelineData>> {
  try {
    const filePath = join(process.cwd(), 'src/data/research_pipeline.yaml');
    const fileContent = await readFile(filePath, 'utf-8');
    const parsed = yaml.load(fileContent) as RawResearchPipeline;

    const data: ResearchPipelineData = {
      tier1: parseTierData(parsed.tier1, '1'),
      tier2: parseTierData(parsed.tier2, '2'),
      tier3: parseTierData(parsed.tier3, '3'),
    };

    return success(data);
  } catch (error) {
    console.error('[getResearchPipelinePrompts]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Load all issue configs from issue_configs/*.yaml
 */
export async function getIssueConfigs(): Promise<ActionResult<IssueConfig[]>> {
  try {
    const issueConfigsDir = join(process.cwd(), 'src/data/issue_configs');
    const files = await readdir(issueConfigsDir);
    const yamlFiles = files.filter((f) => f.endsWith('.yaml') && !f.startsWith('_'));

    const configs: IssueConfig[] = [];

    for (const file of yamlFiles) {
      const filePath = join(issueConfigsDir, file);
      const fileContent = await readFile(filePath, 'utf-8');
      const parsed = yaml.load(fileContent) as RawIssueConfig;

      // Each file contains one issue config with the issue type as the key
      const issueType = Object.keys(parsed)[0];
      const raw = parsed[issueType];

      if (!raw) continue;

      configs.push({
        name: issueType,
        display_name: raw.display_name || issueType,
        db_issue_type: raw.db_issue_type || issueType,
        category: raw.category || 'Uncategorized',
        description: raw.description || '',
        positive_indicators: raw.positive_indicators || [],
        negative_indicators: raw.negative_indicators || [],
        severity_baseline: raw.severity_baseline || 5,
        severity_modifiers: {
          increases: raw.severity_modifiers?.increases || [],
          decreases: raw.severity_modifiers?.decreases || [],
        },
        patterns: raw.patterns || [],
        exclusion_patterns: raw.exclusion_patterns || [],
        statistics: {
          total_matches: raw.statistics?.total_matches || 0,
          true_positives: raw.statistics?.true_positives || 0,
          true_positive_rate: raw.statistics?.true_positive_rate || 0,
          sample_date: raw.statistics?.sample_date || '',
        },
        legal_context: raw.legal_context,
        examples: {
          true_positives: raw.examples?.true_positives || [],
          false_positives: raw.examples?.false_positives || [],
          justified: raw.examples?.justified || [],
        },
        updated_at: raw.updated_at || '',
      });
    }

    // Sort by category, then by display name
    configs.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.display_name.localeCompare(b.display_name);
    });

    return success(configs);
  } catch (error) {
    console.error('[getIssueConfigs]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get a single issue config by type
 */
export async function getIssueConfigByType(
  issueType: string
): Promise<ActionResult<IssueConfig | null>> {
  const result = await getIssueConfigs();
  if (!result.success) return result;

  const config = result.data.find((c) => c.name === issueType || c.db_issue_type === issueType);
  return success(config || null);
}

/**
 * Compose a prompt for a specific tier and issue type
 * Replaces issue-specific placeholders and shows token breakdown
 */
export async function composePromptForTier(
  tier: 1 | 2 | 3,
  issueType: string
): Promise<ActionResult<ComposedPrompt>> {
  try {
    // Load pipeline prompts
    const pipelineResult = await getResearchPipelinePrompts();
    if (!pipelineResult.success) return pipelineResult;

    // Load issue config
    const configResult = await getIssueConfigByType(issueType);
    if (!configResult.success) return configResult;
    if (!configResult.data) {
      return failure(`Issue config not found: ${issueType}`);
    }

    const pipeline = pipelineResult.data;
    const config = configResult.data;

    // Get tier-specific data
    const tierKey = `tier${tier}` as 'tier1' | 'tier2' | 'tier3';
    const tierData = pipeline[tierKey];

    // Format indicators as bullet lists
    const positiveIndicators = config.positive_indicators
      .map((i) => `- ${i}`)
      .join('\n');
    const negativeIndicators = config.negative_indicators
      .map((i) => `- ${i}`)
      .join('\n');

    // Format severity modifiers
    const severityModifiers = [
      ...config.severity_modifiers.increases,
      ...config.severity_modifiers.decreases,
    ].join('\n');

    // Format examples
    const formatExamples = (examples: ExampleCase[], label: string) => {
      if (examples.length === 0) return '';
      return `**${label}:**\n` + examples
        .map((e) => `- ${e.citation}: "${e.quote}" -> ${e.classification}${e.severity ? ` (severity: ${e.severity})` : ''}\n  Reason: ${e.reasoning}`)
        .join('\n');
    };

    const issueExamples = [
      formatExamples(config.examples.true_positives, 'True Positives'),
      formatExamples(config.examples.false_positives, 'False Positives'),
      formatExamples(config.examples.justified, 'Justified'),
    ].filter(Boolean).join('\n\n');

    // Replace placeholders in issue_block
    const issueBlockContent = tierData.issue_block
      .replace(/\{issue_type\}/g, config.db_issue_type)
      .replace(/\{issue_description\}/g, config.description)
      .replace(/\{positive_indicators\}/g, positiveIndicators)
      .replace(/\{negative_indicators\}/g, negativeIndicators)
      .replace(/\{severity_baseline\}/g, String(config.severity_baseline))
      .replace(/\{severity_modifiers\}/g, severityModifiers)
      .replace(/\{issue_examples\}/g, issueExamples);

    const placeholdersReplaced = [
      'issue_type',
      'issue_description',
      'positive_indicators',
      'negative_indicators',
      'severity_baseline',
      'severity_modifiers',
      'issue_examples',
    ];

    // Get remaining placeholders in batch_context and document_template
    const batchContextPlaceholders = extractPlaceholders(tierData.batch_context);
    const documentTemplatePlaceholders = extractPlaceholders(tierData.document_template);

    // Build layer data
    const staticCoreTokens = estimateTokens(tierData.static_core);
    const issueBlockTokens = estimateTokens(issueBlockContent);
    const batchContextTokens = estimateTokens(tierData.batch_context);
    const documentTemplateTokens = estimateTokens(tierData.document_template);

    const tierNames: Record<number, string> = {
      1: 'Match Filtering + Argument Framing',
      2: 'Full Classification',
      3: 'Web Search Verification',
    };

    const composed: ComposedPrompt = {
      tier,
      tierName: tierNames[tier],
      tierDescription: tierData.description,
      issueType: config.db_issue_type,
      layers: {
        static_core: {
          content: tierData.static_core,
          tokenEstimate: staticCoreTokens,
          cacheStatus: 'global',
        },
        issue_block: {
          content: issueBlockContent,
          tokenEstimate: issueBlockTokens,
          cacheStatus: 'per-issue-type',
          placeholdersReplaced,
        },
        batch_context: {
          content: tierData.batch_context,
          tokenEstimate: batchContextTokens,
          cacheStatus: 'per-subchapter',
          placeholdersRemaining: batchContextPlaceholders,
        },
        document_template: {
          content: tierData.document_template,
          tokenEstimate: documentTemplateTokens,
          cacheStatus: 'never-cached',
          placeholdersRemaining: documentTemplatePlaceholders,
        },
      },
      totalTokenEstimate: staticCoreTokens + issueBlockTokens + batchContextTokens + documentTemplateTokens,
    };

    return success(composed);
  } catch (error) {
    console.error('[composePromptForTier]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get list of issue type names and categories (for quick lookups)
 */
export async function getIssueTypesList(): Promise<
  ActionResult<Array<{ name: string; displayName: string; category: string; precision: number }>>
> {
  const result = await getIssueConfigs();
  if (!result.success) return result;

  const list = result.data.map((c) => ({
    name: c.name,
    displayName: c.display_name,
    category: c.category,
    precision: c.statistics.true_positive_rate,
  }));

  return success(list);
}

/**
 * Get issue configs grouped by category
 */
export async function getIssueConfigsByCategory(): Promise<
  ActionResult<Record<string, IssueConfig[]>>
> {
  const result = await getIssueConfigs();
  if (!result.success) return result;

  const grouped: Record<string, IssueConfig[]> = {};
  for (const config of result.data) {
    if (!grouped[config.category]) {
      grouped[config.category] = [];
    }
    grouped[config.category].push(config);
  }

  return success(grouped);
}
