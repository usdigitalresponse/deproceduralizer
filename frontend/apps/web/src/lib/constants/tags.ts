/**
 * Tag Analytics constants — central registry of every tag field in the system.
 *
 * This file is the single source of truth for:
 * - Tag domains (regulation, guidance, fines, compliance, jenai)
 * - Tag types (structured, free_text, issue_type, boolean)
 * - Tag field metadata (table, column, allowed values, display labels)
 * - Tab definitions for the /tags page
 */

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

export const TAG_DOMAINS = ['regulation', 'guidance', 'fines', 'compliance', 'jenai'] as const;
export type TagDomain = (typeof TAG_DOMAINS)[number];

export const TAG_DOMAIN_LABELS: Record<TagDomain, string> = {
  regulation: 'Regulations',
  guidance: 'Guidance',
  fines: 'Fines & Fees',
  compliance: 'Compliance',
  jenai: 'JenAI',
};

export const TAG_DOMAIN_COLORS: Record<TagDomain, string> = {
  regulation: 'bg-indigo-100 text-indigo-800',
  guidance: 'bg-amber-100 text-amber-800',
  fines: 'bg-rose-100 text-rose-800',
  compliance: 'bg-emerald-100 text-emerald-800',
  jenai: 'bg-violet-100 text-violet-800',
};

// ---------------------------------------------------------------------------
// Tag types
// ---------------------------------------------------------------------------

export const TAG_TYPES = ['structured', 'free_text', 'issue_type', 'boolean'] as const;
export type TagType = (typeof TAG_TYPES)[number];

export const TAG_TYPE_LABELS: Record<TagType, string> = {
  structured: 'Structured',
  free_text: 'Free Text',
  issue_type: 'Issue Type',
  boolean: 'Boolean',
};

// ---------------------------------------------------------------------------
// Tag field metadata
// ---------------------------------------------------------------------------

export interface TagFieldMeta {
  /** Unique key for this field (used in URLs, cache keys, etc.) */
  field: string;
  /** Human-readable label */
  label: string;
  /** Which domain this field belongs to */
  domain: TagDomain;
  /** What kind of tag this is */
  type: TagType;
  /** Database table name */
  table: string;
  /** Database column name */
  column: string;
  /** Whether this column stores an array of values */
  isArray: boolean;
  /** For structured enums, the allowed values */
  values?: readonly string[];
}

// Shared enum value arrays
const SECTION_TYPE_VALUES = [
  'definitions', 'requirements', 'procedures', 'prohibitions', 'standards',
  'eligibility', 'penalties', 'fees', 'forms', 'reporting',
  'purpose', 'scope', 'exemptions', 'reserved', 'other',
] as const;

const POLICY_CATEGORY_VALUES = [
  'policy_directive', 'legal_interpretation', 'tax_guidance', 'informational',
  'reference_material', 'non_policy', 'data_dump', 'unclassified',
] as const;

const TARGET_AUDIENCE_VALUES = [
  'families', 'prospective_providers', 'existing_providers', 'government_internal',
  'local_district_staff', 'general_public', 'healthcare_providers', 'childcare_providers',
  'legal_practitioners', 'licensed_professionals', 'small_businesses', 'nonprofits',
  'educators',
] as const;

const AUDIENCE_DIRECTION_VALUES = ['public', 'government', 'both'] as const;

const AUDIENCE_EXPERTISE_VALUES = ['lay', 'specialized', 'mixed'] as const;

const PENALTY_TYPE_VALUES = ['fine', 'fee', 'penalty', 'surcharge', 'forfeiture', 'other'] as const;

const WHO_PAYS_NORMALIZED_VALUES = [
  'licensed_or_permitted', 'applicant', 'individual_or_household', 'vehicle_or_vessel_operator',
  'business_or_corporation', 'insurance_or_financial', 'service_provider_or_operator',
  'healthcare_or_care_facility', 'violator_or_respondent', 'property_owner',
  'government_entity', 'employer_or_employee', 'student_or_educational', 'taxpayer', 'other',
] as const;

const ACTIVITY_CATEGORY_VALUES = [
  'hunting_fishing_wildlife', 'business_licensing', 'manufacturing_industrial',
  'healthcare_facility', 'childcare_provider', 'professional_licensing',
  'environmental_permit', 'construction_building', 'food_service', 'transportation',
  'cannabis_alcohol', 'real_estate_housing', 'education', 'financial_services',
  'social_services', 'utilities_telecom', 'other',
] as const;

const ESTIMATED_ANNUAL_PAYERS_VALUES = [
  'tens', 'hundreds', 'thousands', 'ten_thousands', 'hundred_thousands',
] as const;

const JURISDICTION_LEVEL_VALUES = ['federal', 'state', 'county', 'local', 'other'] as const;

const TIER_CLASSIFICATION_VALUES = [
  'burdensome', 'justified', 'unrelated', 'needs_full_context',
  'all_false_positives', 'needs_research',
] as const;

// ---------------------------------------------------------------------------
// Full field registry
// ---------------------------------------------------------------------------

export const TAG_FIELDS: TagFieldMeta[] = [
  // --- Structured enums ---

  // Regulation
  {
    field: 'reg_section_type',
    label: 'Section Type (Reg)',
    domain: 'regulation',
    type: 'structured',
    table: 'regulatory_documents',
    column: 'section_type',
    isArray: false,
    values: SECTION_TYPE_VALUES,
  },

  // Guidance
  {
    field: 'guid_section_type',
    label: 'Section Type (Guidance)',
    domain: 'guidance',
    type: 'structured',
    table: 'guidance_documents',
    column: 'section_type',
    isArray: false,
    values: SECTION_TYPE_VALUES,
  },
  {
    field: 'policy_category',
    label: 'Policy Category',
    domain: 'guidance',
    type: 'structured',
    table: 'guidance_documents',
    column: 'policy_category',
    isArray: false,
    values: POLICY_CATEGORY_VALUES,
  },
  {
    field: 'target_audience',
    label: 'Target Audience',
    domain: 'guidance',
    type: 'structured',
    table: 'guidance_documents',
    column: 'target_audience',
    isArray: true,
    values: TARGET_AUDIENCE_VALUES,
  },
  {
    field: 'audience_direction',
    label: 'Audience Direction',
    domain: 'guidance',
    type: 'structured',
    table: 'guidance_documents',
    column: 'audience_direction',
    isArray: false,
    values: AUDIENCE_DIRECTION_VALUES,
  },
  {
    field: 'audience_expertise',
    label: 'Audience Expertise',
    domain: 'guidance',
    type: 'structured',
    table: 'guidance_documents',
    column: 'audience_expertise',
    isArray: false,
    values: AUDIENCE_EXPERTISE_VALUES,
  },

  // Fines
  {
    field: 'penalty_type',
    label: 'Penalty Type',
    domain: 'fines',
    type: 'structured',
    table: 'fines_fees_penalties',
    column: 'penalty_type',
    isArray: false,
    values: PENALTY_TYPE_VALUES,
  },
  {
    field: 'who_pays_normalized',
    label: 'Who Pays',
    domain: 'fines',
    type: 'structured',
    table: 'fines_fees_penalties',
    column: 'who_pays_normalized',
    isArray: false,
    values: WHO_PAYS_NORMALIZED_VALUES,
  },
  {
    field: 'activity_category',
    label: 'Activity Category',
    domain: 'fines',
    type: 'structured',
    table: 'fines_fees_penalties',
    column: 'activity_category',
    isArray: false,
    values: ACTIVITY_CATEGORY_VALUES,
  },
  {
    field: 'estimated_annual_payers',
    label: 'Est. Annual Payers',
    domain: 'fines',
    type: 'structured',
    table: 'fines_fees_penalties',
    column: 'estimated_annual_payers',
    isArray: false,
    values: ESTIMATED_ANNUAL_PAYERS_VALUES,
  },
  {
    field: 'jurisdiction_level',
    label: 'Jurisdiction Level',
    domain: 'fines',
    type: 'structured',
    table: 'fines_fees_penalties',
    column: 'jurisdiction_level',
    isArray: false,
    values: JURISDICTION_LEVEL_VALUES,
  },

  // Compliance
  {
    field: 'tier_classification',
    label: 'Tier Classification',
    domain: 'compliance',
    type: 'structured',
    table: 'compliance_issue_analyses',
    column: 'tier2_classification',
    isArray: false,
    values: TIER_CLASSIFICATION_VALUES,
  },

  // --- Free-text arrays ---

  // Regulation
  {
    field: 'reg_keywords',
    label: 'Keywords (Reg)',
    domain: 'regulation',
    type: 'free_text',
    table: 'regulatory_documents',
    column: 'keywords',
    isArray: true,
  },
  {
    field: 'reg_applies_to',
    label: 'Applies To (Reg)',
    domain: 'regulation',
    type: 'free_text',
    table: 'regulatory_documents',
    column: 'applies_to',
    isArray: true,
  },

  // Guidance
  {
    field: 'guid_keywords',
    label: 'Keywords (Guidance)',
    domain: 'guidance',
    type: 'free_text',
    table: 'guidance_documents',
    column: 'keywords',
    isArray: true,
  },
  {
    field: 'guid_applies_to',
    label: 'Applies To (Guidance)',
    domain: 'guidance',
    type: 'free_text',
    table: 'guidance_documents',
    column: 'applies_to',
    isArray: true,
  },

  // JenAI
  {
    field: 'jenai_tags',
    label: 'Tags (JenAI)',
    domain: 'jenai',
    type: 'free_text',
    table: 'jenai_issues',
    column: 'tags',
    isArray: true,
  },

  // --- Issue type taxonomies ---

  {
    field: 'issue_type',
    label: 'Issue Type',
    domain: 'compliance',
    type: 'issue_type',
    table: 'compliance_issues',
    column: 'issue_type',
    isArray: false,
  },
  {
    field: 'jenai_category',
    label: 'JenAI Category',
    domain: 'jenai',
    type: 'issue_type',
    table: 'jenai_issues',
    column: 'category',
    isArray: false,
  },

  // --- Boolean flags ---

  // Regulation
  {
    field: 'reg_has_form',
    label: 'Has Form (Reg)',
    domain: 'regulation',
    type: 'boolean',
    table: 'regulatory_documents',
    column: 'has_form',
    isArray: false,
  },
  {
    field: 'reg_has_ibr',
    label: 'Has IBR (Reg)',
    domain: 'regulation',
    type: 'boolean',
    table: 'regulatory_documents',
    column: 'has_ibr',
    isArray: false,
  },

  // Guidance
  {
    field: 'guid_has_form',
    label: 'Has Form (Guidance)',
    domain: 'guidance',
    type: 'boolean',
    table: 'guidance_documents',
    column: 'has_form',
    isArray: false,
  },
  {
    field: 'guid_has_ibr',
    label: 'Has IBR (Guidance)',
    domain: 'guidance',
    type: 'boolean',
    table: 'guidance_documents',
    column: 'has_ibr',
    isArray: false,
  },
  {
    field: 'is_attachment',
    label: 'Is Attachment',
    domain: 'guidance',
    type: 'boolean',
    table: 'guidance_documents',
    column: 'is_attachment',
    isArray: false,
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Get all tag fields for a specific domain */
export function getFieldsForDomain(domain: TagDomain): TagFieldMeta[] {
  return TAG_FIELDS.filter(f => f.domain === domain);
}

/** Get metadata for a specific field by its key */
export function getFieldMeta(field: string): TagFieldMeta | undefined {
  return TAG_FIELDS.find(f => f.field === field);
}

/** Get multiselect options (field/label pairs) optionally filtered by domains.
 *  Excludes boolean fields by default since true/false values aren't useful in analytics. */
export function getFieldMultiselectOptions(
  domains?: TagDomain[],
  includeBoolean = false,
): Array<{ value: string; label: string }> {
  let fields = domains
    ? TAG_FIELDS.filter(f => domains.includes(f.domain))
    : TAG_FIELDS;
  if (!includeBoolean) {
    fields = fields.filter(f => f.type !== 'boolean');
  }
  return fields.map(f => ({ value: f.field, label: f.label }));
}

/** Get analytics-relevant fields (excludes boolean flags) */
export function getAnalyticsFields(domains?: TagDomain[]): TagFieldMeta[] {
  const fields = domains
    ? TAG_FIELDS.filter(f => domains.includes(f.domain))
    : TAG_FIELDS;
  return fields.filter(f => f.type !== 'boolean');
}

// ---------------------------------------------------------------------------
// Domain hex colors (for charts / SVG — parallels TAG_DOMAIN_COLORS Tailwind)
// ---------------------------------------------------------------------------

export const TAG_DOMAIN_HEX: Record<string, string> = {
  regulation: '#818cf8', // indigo-400
  guidance: '#fbbf24',   // amber-400
  fines: '#fb7185',      // rose-400
  compliance: '#34d399', // emerald-400
  jenai: '#a78bfa',      // violet-400
};

export const TAG_DOMAIN_HEX_LIGHT: Record<string, string> = {
  regulation: '#e0e7ff', // indigo-100
  guidance: '#fef3c7',   // amber-100
  fines: '#ffe4e6',      // rose-100
  compliance: '#d1fae5', // emerald-100
  jenai: '#ede9fe',      // violet-100
};

export function domainColor(domain: string): string {
  return TAG_DOMAIN_HEX[domain] ?? '#94a3b8';
}

export function domainColorLight(domain: string): string {
  return TAG_DOMAIN_HEX_LIGHT[domain] ?? '#f1f5f9';
}

// ---------------------------------------------------------------------------
// Shared display formatting
// ---------------------------------------------------------------------------

/** Format a tag value for display: replace underscores with spaces and title-case */
export function formatTagValue(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Tags page tabs
// ---------------------------------------------------------------------------

export const TAGS_TAB_VALUES = ['overview', 'connections', 'correlations', 'readability'] as const;
export type TagsTabValue = (typeof TAGS_TAB_VALUES)[number];

export const TAGS_TAB_LABELS: Record<TagsTabValue, string> = {
  overview: 'Overview',
  connections: 'Connections',
  correlations: 'Correlations',
  readability: 'Readability',
};
