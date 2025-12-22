'use server';

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
}

interface RawPromptData {
  description?: string;
  system?: string;
  template?: string;
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
 * Load and parse prompts.yaml, returning structured prompt data.
 * The file is copied from project root during build (see prebuild script).
 */
export async function getPrompts(): Promise<ActionResult<PromptData[]>> {
  try {
    const promptsPath = join(process.cwd(), 'src/data/prompts.yaml');
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
