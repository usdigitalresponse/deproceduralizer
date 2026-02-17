'use server';

import 'server-only';
import { readFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import { type ActionResult, success, failure, getErrorMessage } from './types';

export interface PromptVariable {
  name: string;
  required: boolean;
}

export interface PromptData {
  name: string;
  description: string;
  system: string | null;
  template: string;
  variables: PromptVariable[];
  updatedAt: string | null;
}

interface RawPromptData {
  description?: string;
  system?: string;
  template?: string;
  updated_at?: string;
}

export interface CompliancePromptData {
  name: string;
  displayName: string;
  category: string;
  description: string;
  prompt: {
    system: string;
    template: string;
  } | null;
  patterns: string[];
  updatedAt: string | null;
}

interface RawCompliancePromptData {
  display_name?: string;
  category?: string;
  description?: string;
  prompt?: {
    system?: string;
    template?: string;
  };
  patterns?: string[];
  updated_at?: string;
}

/**
 * Extract variable placeholders from template using regex.
 * Variables are in the format {variable_name}.
 */
function extractVariables(template: string): PromptVariable[] {
  const pattern = /\{(\w+)\}/g;
  const matches = new Set<string>();
  let match;

  while ((match = pattern.exec(template)) !== null) {
    matches.add(match[1]);
  }

  return Array.from(matches).map((name) => ({
    name,
    required: true,
  }));
}

/**
 * Load and parse core prompts from prompts/core.yaml.
 * The file is copied from prompts/core.yaml during build (see prebuild script in package.json).
 */
export async function getPrompts(): Promise<ActionResult<PromptData[]>> {
  try {
    const promptsPath = join(process.cwd(), 'src/data/core.yaml');
    const fileContent = await readFile(promptsPath, 'utf-8');
    const parsed = yaml.load(fileContent) as Record<string, RawPromptData>;

    const prompts: PromptData[] = Object.entries(parsed).map(
      ([name, data]) => {
        const system = data.system?.trim() || null;
        const template = data.template?.trim() || '';
        // Extract variables from both system and template
        const allVariables = extractVariables((system || '') + template);
        return {
          name,
          description: data.description?.trim() || '',
          system,
          template,
          variables: allVariables,
          updatedAt: data.updated_at || null,
        };
      }
    );

    return success(prompts);
  } catch (error) {
    console.error('[getPrompts]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get a single prompt by name.
 */
export async function getPromptByName(
  name: string
): Promise<ActionResult<PromptData | null>> {
  const result = await getPrompts();
  if (!result.success) return result;

  const prompt = result.data.find((p) => p.name === name);
  return success(prompt || null);
}

/**
 * Get list of prompt names only (for quick lookups).
 */
export async function getPromptNames(): Promise<ActionResult<string[]>> {
  const result = await getPrompts();
  if (!result.success) return result;

  return success(result.data.map((p) => p.name));
}

/**
 * Load and parse JenAI prompts from prompts/jenai.yaml.
 * The file is copied during build (see prebuild script in package.json).
 * Same structure as core.yaml: dictionary of prompt names with system/template/description.
 */
export async function getJenAIPrompts(): Promise<ActionResult<PromptData[]>> {
  try {
    const promptsPath = join(process.cwd(), 'src/data/jenai.yaml');
    const fileContent = await readFile(promptsPath, 'utf-8');
    const parsed = yaml.load(fileContent) as Record<string, RawPromptData>;

    const prompts: PromptData[] = Object.entries(parsed).map(
      ([name, data]) => {
        const system = data.system?.trim() || null;
        const template = data.template?.trim() || '';
        const allVariables = extractVariables((system || '') + template);
        return {
          name,
          description: data.description?.trim() || '',
          system,
          template,
          variables: allVariables,
          updatedAt: data.updated_at || null,
        };
      }
    );

    return success(prompts);
  } catch (error) {
    console.error('[getJenAIPrompts]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Load and parse compliance issue prompts from prompts/compliance_issues.yaml.
 * The file is copied during build (see prebuild script in package.json).
 */
export async function getCompliancePrompts(): Promise<ActionResult<CompliancePromptData[]>> {
  try {
    const promptsPath = join(process.cwd(), 'src/data/compliance_issues.yaml');
    const fileContent = await readFile(promptsPath, 'utf-8');
    const parsed = yaml.load(fileContent) as Record<string, RawCompliancePromptData>;

    const prompts: CompliancePromptData[] = Object.entries(parsed).map(
      ([name, data]) => ({
        name,
        displayName: data.display_name || name,
        category: data.category || 'Uncategorized',
        description: data.description || '',
        prompt: data.prompt
          ? {
              system: data.prompt.system?.trim() || '',
              template: data.prompt.template?.trim() || '',
            }
          : null,
        patterns: data.patterns || [],
        updatedAt: data.updated_at || null,
      })
    );

    // Sort by category, then by display name
    prompts.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.displayName.localeCompare(b.displayName);
    });

    return success(prompts);
  } catch (error) {
    console.error('[getCompliancePrompts]', error);
    return failure(getErrorMessage(error));
  }
}
