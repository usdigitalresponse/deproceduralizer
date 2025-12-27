// =============================================================================
// Auto-generated from prompts/compliance_issues.yaml
// DO NOT EDIT MANUALLY - Run: python scripts/generate_prompt_types.py
// =============================================================================

/**
 * All compliance issue type identifiers.
 * Source: prompts/compliance_issues.yaml
 */
export const ISSUE_TYPES = [
  "mail_only",
  "certified_mail",
  "fax",
  "obsolete_comm",
  "landline",
  "check_payment",
  "cash_only",
  "no_credit_cards",
  "in_person_payment",
  "wet_signature",
  "notarization",
  "witness",
  "embossed_seal",
  "original_document",
  "in_person_submission",
  "in_person_hearing",
  "in_person_pickup",
  "physical_forms",
  "physical_inspection",
  "physical_posting",
  "bulletin_board",
  "obsolete_media",
  "microfiche",
  "obsolete_software",
  "typewriter",
  "pdf_only",
  "carbon_copy",
  "newspaper",
  "multiple_copies",
  "paper_specs",
  "photo_specs",
  "letterhead",
  "handwriting_specs",
  "binding_required",
  "physical_log",
  "routing_slip",
  "storage_location",
  "fixed_window",
  "waiting_period",
  "mandated_reports",
  "incorporation_by_reference"
] as const;

/**
 * Type for a valid compliance issue type identifier.
 */
export type IssueType = typeof ISSUE_TYPES[number];

/**
 * Metadata for each issue type.
 */
export interface IssueTypeMeta {
  displayName: string;
  category: string;
  description: string;
  dbIssueType: string;
  updatedAt: string | null;
}

/**
 * Metadata lookup for all issue types.
 * Source: prompts/compliance_issues.yaml
 */
export const ISSUE_TYPE_META: Record<IssueType, IssueTypeMeta> = {
  mail_only: {
    displayName: "Mail-Only Submission",
    category: "Communication",
    description: "Mail required with no electronic alternative",
    dbIssueType: "mail_only",
    updatedAt: "2025-12-26",
  },
  certified_mail: {
    displayName: "Certified/Registered Mail",
    category: "Communication",
    description: "Certified or registered mail required",
    dbIssueType: "certified_mail",
    updatedAt: "2025-12-26",
  },
  fax: {
    displayName: "Fax Requirements",
    category: "Communication",
    description: "Fax required or only alternative to mail",
    dbIssueType: "fax_required",
    updatedAt: "2025-12-26",
  },
  obsolete_comm: {
    displayName: "Obsolete Communication",
    category: "Communication",
    description: "Telegram, telex, pager references",
    dbIssueType: "obsolete_comm",
    updatedAt: "2025-12-26",
  },
  landline: {
    displayName: "Landline/Telephone Required",
    category: "Communication",
    description: "Telephone/landline required",
    dbIssueType: "landline",
    updatedAt: "2025-12-26",
  },
  check_payment: {
    displayName: "Check/Money Order Payment",
    category: "Payment",
    description: "Check or money order payment required",
    dbIssueType: "check_payment",
    updatedAt: "2025-12-26",
  },
  cash_only: {
    displayName: "Cash Only Payment",
    category: "Payment",
    description: "Cash-only payment required",
    dbIssueType: "cash_only",
    updatedAt: "2025-12-26",
  },
  no_credit_cards: {
    displayName: "No Credit Cards",
    category: "Payment",
    description: "Credit cards explicitly not accepted",
    dbIssueType: "no_credit_cards",
    updatedAt: "2025-12-26",
  },
  in_person_payment: {
    displayName: "In-Person Payment",
    category: "Payment",
    description: "Payment must be made in person",
    dbIssueType: "in_person_payment",
    updatedAt: "2025-12-26",
  },
  wet_signature: {
    displayName: "Wet Signature",
    category: "Signatures",
    description: "Physical wet/ink signature required",
    dbIssueType: "wet_signature",
    updatedAt: "2025-12-26",
  },
  notarization: {
    displayName: "Notarization Required",
    category: "Signatures",
    description: "Notarization required",
    dbIssueType: "notarization",
    updatedAt: "2025-12-26",
  },
  witness: {
    displayName: "Witness Required",
    category: "Signatures",
    description: "Witness signature required",
    dbIssueType: "witness",
    updatedAt: "2025-12-26",
  },
  embossed_seal: {
    displayName: "Embossed Seal/Stamp",
    category: "Signatures",
    description: "Embossed or official seal required",
    dbIssueType: "embossed_seal",
    updatedAt: "2025-12-26",
  },
  original_document: {
    displayName: "Original Document Required",
    category: "Signatures",
    description: "Original document required (no copies)",
    dbIssueType: "original_document",
    updatedAt: "2025-12-26",
  },
  in_person_submission: {
    displayName: "In-Person Submission",
    category: "Physical Presence",
    description: "Physical presence required for submission",
    dbIssueType: "in_person_submission",
    updatedAt: "2025-12-26",
  },
  in_person_hearing: {
    displayName: "In-Person Hearing/Meeting",
    category: "Physical Presence",
    description: "Physical attendance at hearing required",
    dbIssueType: "in_person_hearing",
    updatedAt: "2025-12-26",
  },
  in_person_pickup: {
    displayName: "In-Person Pickup",
    category: "Physical Presence",
    description: "Must pick up in person",
    dbIssueType: "in_person_pickup",
    updatedAt: "2025-12-26",
  },
  physical_forms: {
    displayName: "Physical Form Retrieval",
    category: "Physical Presence",
    description: "Forms must be obtained from physical location",
    dbIssueType: "physical_forms",
    updatedAt: "2025-12-26",
  },
  physical_inspection: {
    displayName: "Physical Inspection Location",
    category: "Physical Presence",
    description: "Documents available for inspection at location",
    dbIssueType: "physical_inspection",
    updatedAt: "2025-12-26",
  },
  physical_posting: {
    displayName: "Physical Posting Required",
    category: "Physical Presence",
    description: "Signs/notices must be physically posted",
    dbIssueType: "physical_posting",
    updatedAt: "2025-12-26",
  },
  bulletin_board: {
    displayName: "Bulletin Board",
    category: "Physical Presence",
    description: "Bulletin board posting required",
    dbIssueType: "bulletin_board",
    updatedAt: "2025-12-26",
  },
  obsolete_media: {
    displayName: "Obsolete Storage Media",
    category: "Technology",
    description: "Floppy disk, CD-ROM, magnetic tape",
    dbIssueType: "obsolete_media",
    updatedAt: "2025-12-26",
  },
  microfiche: {
    displayName: "Microfiche/Microfilm",
    category: "Technology",
    description: "Microfiche or microfilm references",
    dbIssueType: "microfiche",
    updatedAt: "2025-12-26",
  },
  obsolete_software: {
    displayName: "Obsolete Software/Format",
    category: "Technology",
    description: "WordPerfect, Lotus, DOS references",
    dbIssueType: "obsolete_software",
    updatedAt: "2025-12-26",
  },
  typewriter: {
    displayName: "Typewriter Required",
    category: "Technology",
    description: "Typewriter or typewritten document required",
    dbIssueType: "typewriter",
    updatedAt: "2025-12-26",
  },
  pdf_only: {
    displayName: "PDF Only Format",
    category: "Technology",
    description: "PDF format specifically required",
    dbIssueType: "pdf_only",
    updatedAt: "2025-12-26",
  },
  carbon_copy: {
    displayName: "Carbon/Duplicate Copy",
    category: "Technology",
    description: "Carbon copy or duplicate required",
    dbIssueType: "carbon_copy",
    updatedAt: "2025-12-26",
  },
  newspaper: {
    displayName: "Newspaper Publication",
    category: "Technology",
    description: "Newspaper publication required",
    dbIssueType: "newspaper",
    updatedAt: "2025-12-26",
  },
  multiple_copies: {
    displayName: "Multiple Copy Submission",
    category: "Document Format",
    description: "Multiple physical copies required",
    dbIssueType: "multiple_copies",
    updatedAt: "2025-12-26",
  },
  paper_specs: {
    displayName: "Paper Specifications",
    category: "Document Format",
    description: "Specific paper size/type required",
    dbIssueType: "paper_specs",
    updatedAt: "2025-12-26",
  },
  photo_specs: {
    displayName: "Photo Specifications",
    category: "Document Format",
    description: "Specific photo size/format required",
    dbIssueType: "photo_specs",
    updatedAt: "2025-12-26",
  },
  letterhead: {
    displayName: "Letterhead Required",
    category: "Document Format",
    description: "Official letterhead required",
    dbIssueType: "letterhead",
    updatedAt: "2025-12-26",
  },
  handwriting_specs: {
    displayName: "Handwriting Specifications",
    category: "Document Format",
    description: "Specific handwriting requirements",
    dbIssueType: "handwriting_specs",
    updatedAt: "2025-12-26",
  },
  binding_required: {
    displayName: "Binding Required",
    category: "Document Format",
    description: "Document binding required",
    dbIssueType: "binding_required",
    updatedAt: "2025-12-26",
  },
  physical_log: {
    displayName: "Physical Log/Sign-in",
    category: "Process",
    description: "Physical log book or sign-in sheet required",
    dbIssueType: "physical_log",
    updatedAt: "2025-12-26",
  },
  routing_slip: {
    displayName: "Routing/Transmittal Slip",
    category: "Process",
    description: "Routing or transmittal form required",
    dbIssueType: "routing_slip",
    updatedAt: "2025-12-26",
  },
  storage_location: {
    displayName: "Specific Storage Location",
    category: "Process",
    description: "Records must be kept at specific location",
    dbIssueType: "storage_location",
    updatedAt: "2025-12-26",
  },
  fixed_window: {
    displayName: "Fixed Processing Window",
    category: "Process",
    description: "Applications only during fixed periods",
    dbIssueType: "fixed_window",
    updatedAt: "2025-12-26",
  },
  waiting_period: {
    displayName: "Mandatory Waiting Period",
    category: "Process",
    description: "Mandatory waiting period required",
    dbIssueType: "waiting_period",
    updatedAt: "2025-12-26",
  },
  mandated_reports: {
    displayName: "Mandated Reports",
    category: "Reporting",
    description: "Mandated reporting requirements",
    dbIssueType: "mandated_reports",
    updatedAt: "2025-12-26",
  },
  incorporation_by_reference: {
    displayName: "Incorporation by Reference",
    category: "External Standards",
    description: "External standards, codes, or documents incorporated by reference",
    dbIssueType: "incorporation_by_reference",
    updatedAt: "2025-12-26",
  }
};

/**
 * Get all issue types in a specific category.
 */
export function getIssueTypesByCategory(category: string): IssueType[] {
  return ISSUE_TYPES.filter(type => ISSUE_TYPE_META[type].category === category);
}

/**
 * Get all unique categories.
 */
export function getCategories(): string[] {
  const categories = new Set(ISSUE_TYPES.map(type => ISSUE_TYPE_META[type].category));
  return Array.from(categories).sort();
}
