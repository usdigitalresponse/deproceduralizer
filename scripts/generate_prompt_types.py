#!/usr/bin/env python3
"""
Generate TypeScript types from prompts/compliance_issues.yaml.

This script reads the compliance issue definitions and generates:
- ISSUE_TYPES constant (array of all issue type names)
- IssueType type (union of issue type names)
- ISSUE_TYPE_META constant (metadata for each issue type)

Usage:
    python scripts/generate_prompt_types.py

The generated file is written to:
    frontend/packages/database/src/generated/issue-types.ts
"""

import json
from pathlib import Path

import yaml


def generate_issue_types():
    """Generate TypeScript types from compliance_issues.yaml."""
    # Paths relative to project root
    project_root = Path(__file__).parent.parent
    yaml_path = project_root / 'prompts' / 'compliance_issues.yaml'
    output_path = project_root / 'frontend' / 'packages' / 'database' / 'src' / 'generated' / 'issue-types.ts'

    # Load YAML
    with open(yaml_path, 'r') as f:
        data = yaml.safe_load(f)

    # Extract issue types (keys of the YAML dict)
    issue_types = list(data.keys())

    # Build metadata dict
    meta = {}
    for name, config in data.items():
        meta[name] = {
            'displayName': config.get('display_name', name),
            'category': config.get('category', ''),
            'description': config.get('description', ''),
            'dbIssueType': config.get('db_issue_type', name),
            'updatedAt': config.get('updated_at'),
        }

    # Generate TypeScript
    issue_types_array = json.dumps(issue_types, indent=2)

    # Format the meta object manually for better readability
    meta_entries = []
    for name in issue_types:
        m = meta[name]
        updated_at_value = json.dumps(m['updatedAt']) if m['updatedAt'] else 'null'
        entry = f"""  {name}: {{
    displayName: {json.dumps(m['displayName'])},
    category: {json.dumps(m['category'])},
    description: {json.dumps(m['description'])},
    dbIssueType: {json.dumps(m['dbIssueType'])},
    updatedAt: {updated_at_value},
  }}"""
        meta_entries.append(entry)

    meta_object = '{\n' + ',\n'.join(meta_entries) + '\n}'

    output = f'''// =============================================================================
// Auto-generated from prompts/compliance_issues.yaml
// DO NOT EDIT MANUALLY - Run: python scripts/generate_prompt_types.py
// =============================================================================

/**
 * All compliance issue type identifiers.
 * Source: prompts/compliance_issues.yaml
 */
export const ISSUE_TYPES = {issue_types_array} as const;

/**
 * Type for a valid compliance issue type identifier.
 */
export type IssueType = typeof ISSUE_TYPES[number];

/**
 * Metadata for each issue type.
 */
export interface IssueTypeMeta {{
  displayName: string;
  category: string;
  description: string;
  dbIssueType: string;
  updatedAt: string | null;
}}

/**
 * Metadata lookup for all issue types.
 * Source: prompts/compliance_issues.yaml
 */
export const ISSUE_TYPE_META: Record<IssueType, IssueTypeMeta> = {meta_object};

/**
 * Get all issue types in a specific category.
 */
export function getIssueTypesByCategory(category: string): IssueType[] {{
  return ISSUE_TYPES.filter(type => ISSUE_TYPE_META[type].category === category);
}}

/**
 * Get all unique categories.
 */
export function getCategories(): string[] {{
  const categories = new Set(ISSUE_TYPES.map(type => ISSUE_TYPE_META[type].category));
  return Array.from(categories).sort();
}}
'''

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write output
    with open(output_path, 'w') as f:
        f.write(output)

    print(f"Generated {output_path}")
    print(f"  - {len(issue_types)} issue types")
    print(f"  - Categories: {', '.join(sorted(set(m['category'] for m in meta.values())))}")


if __name__ == '__main__':
    generate_issue_types()
