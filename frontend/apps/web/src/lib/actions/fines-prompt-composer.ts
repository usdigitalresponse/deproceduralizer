'use server';

import 'server-only';
import { readFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import { type ActionResult, runAction } from './types';
import { getRegulationById } from './regulations';
import { estimateTokens, extractPlaceholders } from '@/lib/utils/prompt-helpers';
import type {
  FinesComposedPrompt,
  FinesPromptLayer,
  FinesContextMetadata,
} from '@/components/prompts/FinesPipelineComposer/types';

// =============================================================================
// YAML Types
// =============================================================================

interface RawFinesPrompt {
  updated_at?: string;
  display_name?: string;
  description?: string;
  patterns?: string[];
  prompt?: {
    system?: string;
    template?: string;
  };
}

// =============================================================================
// NYCRR Title -> Agency Map (subset for prompt composer)
// =============================================================================

const NYCRR_TITLE_AGENCY_MAP: Record<string, string> = {
  '1': 'Department of Agriculture and Markets',
  '2': 'Department of Audit and Control',
  '3': 'Banking Department',
  '4': 'Department of Civil Service',
  '5': 'Department of Economic Development',
  '6': 'Department of Education',
  '7': 'Temporary State Commission on Banking and Insurance',
  '8': 'Education Department (Professions)',
  '9': 'Executive Department',
  '10': 'Department of Health',
  '11': 'Insurance Department',
  '12': 'Department of Labor',
  '13': 'Department of Law',
  '14': 'Department of Mental Hygiene',
  '15': 'Department of Motor Vehicles',
  '16': 'Department of Public Service',
  '17': 'Department of Social Services',
  '18': 'Department of Social Services (Assistance)',
  '19': 'Department of State',
  '20': 'Department of Taxation and Finance',
  '21': 'Department of Transportation',
  '22': 'Unified Court System',
  '23': 'Division of Housing and Community Renewal',
};

// =============================================================================
// Server Actions
// =============================================================================

/**
 * Compose the full fines extraction prompt for a given document.
 */
export async function composeFinesPrompt(
  documentId: number,
): Promise<ActionResult<FinesComposedPrompt>> {
  return runAction('composeFinesPrompt', async () => {
    // Load YAML template (prebuild copies prompts/compliance_issues.yaml to src/data/)
    const filePath = join(process.cwd(), 'src/data/compliance_issues.yaml');
    const fileContent = await readFile(filePath, 'utf-8');
    const parsed = yaml.load(fileContent) as Record<string, RawFinesPrompt>;
    const finesConfig = parsed.fines_fees_penalties;

    if (!finesConfig?.prompt) {
      throw new Error('No "fines_fees_penalties" prompt found in compliance_issues.yaml');
    }

    const systemTemplate = finesConfig.prompt.system?.trim() || '';
    const documentTemplate = finesConfig.prompt.template?.trim() || '';
    const patterns = finesConfig.patterns || [];

    // Fetch document
    const docResult = await getRegulationById(documentId);
    if (!docResult.success || !docResult.data) {
      throw new Error(`Document ${documentId} not found`);
    }

    const doc = docResult.data;
    const content = doc.content || '';

    // Build document metadata (mirroring fines_scanner.py logic)
    const metadataParts: string[] = [];
    metadataParts.push('Source: Regulation');

    // Get NYCRR title number from document
    const titleStr = doc.nycrrTitle ? String(doc.nycrrTitle) : null;
    if (titleStr && NYCRR_TITLE_AGENCY_MAP[titleStr]) {
      metadataParts.push(`Administering agency: ${NYCRR_TITLE_AGENCY_MAP[titleStr]}`);
    }

    if (doc.title) {
      metadataParts.push(`Document title: ${doc.title}`);
    }
    if (doc.url) {
      metadataParts.push(`URL: ${doc.url}`);
    }

    const documentMetadata = metadataParts.length > 0
      ? metadataParts.join('\n')
      : 'No metadata available';

    // Build regulation context (mirroring fines_scanner.py windowing logic)
    const MAX_CONTENT_CHARS = 15000;
    let regulationContext: string;
    let wasWindowed = false;

    if (content.length <= MAX_CONTENT_CHARS) {
      regulationContext = content;
    } else {
      regulationContext = content.slice(0, MAX_CONTENT_CHARS);
      wasWindowed = true;
    }

    // Find matched patterns
    const matchedPatterns: string[] = [];
    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(content)) {
          matchedPatterns.push(pattern);
        }
      } catch {
        // Skip invalid regex patterns
      }
    }

    // Fill template placeholders
    const templateContent = documentTemplate
      .replace('{document_metadata}', documentMetadata)
      .replace('{regulation_context}', regulationContext || '(no content available)')
      .replace('{statute_context}', 'Statute context not available in composer preview');

    // Extract placeholder info
    const templatePlaceholders = extractPlaceholders(documentTemplate);
    const filledPlaceholders = ['document_metadata', 'regulation_context', 'statute_context'];

    // Build layers
    const systemLayer: FinesPromptLayer = {
      content: systemTemplate,
      tokenEstimate: estimateTokens(systemTemplate),
      cacheStatus: 'global',
    };

    const templateLayer: FinesPromptLayer = {
      content: templateContent,
      tokenEstimate: estimateTokens(templateContent),
      cacheStatus: 'never-cached',
      placeholdersReplaced: filledPlaceholders,
      placeholdersRemaining: templatePlaceholders.filter(
        (p) => !filledPlaceholders.includes(p),
      ),
    };

    // Determine agency
    let responsibleAgency: string | null = null;
    let nycrTitle: number | null = null;
    if (titleStr) {
      nycrTitle = parseInt(titleStr, 10);
      responsibleAgency = NYCRR_TITLE_AGENCY_MAP[titleStr] || null;
    }

    // Build context metadata
    const context: FinesContextMetadata = {
      documentTitle: doc.title || '',
      documentCitation: doc.citation || '',
      sourceType: 'regulation',
      responsibleAgency,
      nycrTitle,
      jurisdiction: doc.jurisdiction || '',
      matchedPatterns,
      contentLength: content.length,
      wasWindowed,
    };

    return {
      layers: {
        system: systemLayer,
        template: templateLayer,
      },
      totalTokenEstimate: systemLayer.tokenEstimate + templateLayer.tokenEstimate,
      context,
    };
  });
}
