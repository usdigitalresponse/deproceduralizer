# Research Pipeline Schema Proposal

> **Status: HISTORICAL**
> This document describes the original 3-tier design. See `../../` for current architecture.

```jsonc
{
  "table": "compliance_issues",
  "description": "Tracks compliance burden issues found in regulations via regex + LLM analysis",

  "columns": {
    // ═══════════════════════════════════════════════════════════════════
    // EXISTING: Issue Identification (used in all stages)
    // ═══════════════════════════════════════════════════════════════════
    "id": {
      "type": "BIGSERIAL PRIMARY KEY",
      "stage": "all",
      "status": "EXISTS"
    },
    "document_id": {
      "type": "BIGINT NOT NULL",
      "fk": "regulatory_documents(id)",
      "stage": "all",
      "status": "EXISTS",
      "testing": "add tests that all of the issues have a linked document id after regex parsing"
    },
    "issue_type": {
      "type": "VARCHAR(50) NOT NULL",
      "stage": "all",
      "status": "EXISTS",
      "description": "Issue category (wet_signature, mail_only, etc.)",
      "testing": "add tests that all of the issues have a valid type after the parsing. "
    },
    "occurrence_number": {
      "type": "INTEGER NOT NULL DEFAULT 1",
      "stage": "all",
      "status": "EXISTS",
      "description": "For multiple issues of same type in same doc",
      "testing": "add tests that all of the issues have a unique occurrence number in a given document if that document has more than one of the same issue."
    },
    "regex_match_pattern": {
      "type": "VARCHAR(255)",
      "stage": "regex_detection",
      "status": "EXISTS",
      "description": "The regex pattern that triggered detection",
      "testing": "add that the correct regex pattern that it matched against is added after the regex parsing. "
    },
    "regex_match_context": {
      "type": "TEXT NOT NULL",
      "stage": "regex_detection | tier1",
      "status": "EXISTS",
      "description": "±300 chars around regex match - input to Tier 1",
      "testing": "That the field is only updated after the regexparsing with related text, and that this field is actually shown in the ultimate tier one prompt - but never updated after parsing" 
    },
    "url": {
      "type": "TEXT",
      "stage": "all",
      "status": "EXISTS",
      "testing": "that  this is properly populated."
    },
    "state": {
      "type": "VARCHAR(2) NOT NULL",
      "stage": "all",
      "status": "EXISTS",
      "constraint": "CHECK (state IN ('NY', 'NJ'))",
      "testing": "That the constraints are fulfilled. "
    },
    "created_at": {
      "type": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      "stage": "all",
      "status": "EXISTS"
    },

    // ═══════════════════════════════════════════════════════════════════
    // EXISTING: LLM Analysis Results (from current searcher, reused by pipeline)
    // ═══════════════════════════════════════════════════════════════════
    "requirement_found": {
      "type": "BOOLEAN DEFAULT FALSE",
      "stage": "derived",
      "status": "EXISTS",
      "description": "Final determination: is this a real compliance issue? True for both burdensome AND justified items.",
      "derived_from": {
        "logic": [
          "IF tier2_classification = 'burdensome' → true",
          "IF tier2_classification = 'justified' → true (with is_justified=true, severity 1-3)",
          "IF tier2_classification = 'unrelated' → false",
          "IF tier3 reclassifies to 'justified' → true (with is_justified=true)",
          "IF highest_tier_completed = 1 AND tier1_classification = 'unrelated' → false",
          "IF tier1_classification IN ('needs_research', 'obvious_burden') AND tier2 not done → null (pending)"
        ],
        "note": "Set programmatically by pipeline based on classification outcomes, not directly by LLM"
      },
      "testing": "that derivation logic handles all tier outcomes including tier3 reclassification to justified"
    },
    "is_justified": {
      "type": "BOOLEAN DEFAULT FALSE",
      "stage": "derived",
      "status": "NEW",
      "description": "True when burden exists but is acceptable. Used with requirement_found=true, severity 1-3.",
      "derived_from": {
        "logic": [
          "IF tier2_classification = 'justified' → true",
          "IF tier3 reclassifies burdensome → justified → true",
          "Otherwise → false"
        ],
        "note": "Distinguishes justified burdens from real problems. Justified items have requirement_found=true but low severity."
      },
      "testing": "that is_justified=true only when classification is 'justified', and always has severity 1-3 and requirement_found=true"
    },
    "verbatim_supporting_text": {
      "type": "TEXT[]",
      "stage": "tier2 | legacy_searcher",
      "status": "EXISTS",
      "description": "ARRAY of verbatim quotes supporting the finding",
      "testing": "that this is filled one by text in the source document"
    },
    "is_verbatim": {
      "type": "BOOLEAN",
      "stage": "derived",
      "status": "EXISTS",
      "description": "Whether ALL quotes in verbatim_supporting_text are exact from regulation",
      "derived_from": {
        "function": "are_all_verbatim() in validation.py",
        "logic": "all(is_verbatim_match(t) for t in verbatim_supporting_text) - ALL quotes must match source",
        "note": "Computed programmatically by comparing each LLM output text to regulation content"
      },
      "testing": "that this is calculated correctly in the appropriate part of the process"
    },
    "required_by_statute": {
      "type": "BOOLEAN",
      "stage": "tier2 | legacy_searcher",
      "status": "EXISTS",
      "description": "State statute mandates this? (true/false/null)",
      "testing": "that this populates when it is expected to in the right part of the prcoess, and is incorporated in the correct prompts" 
    },
    "statute_citation": {
      "type": "VARCHAR(255)",
      "stage": "tier2",
      "status": "EXISTS",
      "description": "Citation if statute-mandated (e.g., N.J.S.A. 30:11B-4)"
    },
    "severity": {
      "type": "INTEGER",
      "stage": "tier2 | tier3",
      "status": "EXISTS",
      "constraint": "CHECK (severity >= 1 AND severity <= 10)",
      "description": "Final severity after all adjustments"
    },
    "original_severity": {
      "type": "INTEGER",
      "stage": "tier2",
      "status": "EXISTS",
      "description": "LLM's initial severity before reviewer edits"
    },
    "decision_rationale": {
      "type": "TEXT",
      "stage": "tier2 | legacy_searcher",
      "status": "EXISTS",
      "description": "LLM explanation of the decision"
    },

    // ═══════════════════════════════════════════════════════════════════
    // EXISTING: Review Workflow
    // ═══════════════════════════════════════════════════════════════════
    "review_status": {
      "type": "VARCHAR(50) DEFAULT 'unreviewed'",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },
    "reviewed_by": {
      "type": "VARCHAR(255)",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },
    "reviewed_at": {
      "type": "TIMESTAMP",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },
    "justification_notes": {
      "type": "TEXT",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },
    "team_notes": {
      "type": "TEXT",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },
    "impact_type": {
      "type": "VARCHAR(100)",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },

    // ═══════════════════════════════════════════════════════════════════
    // EXISTING: Developer Tracking
    // ═══════════════════════════════════════════════════════════════════
    "developer_status": {
      "type": "VARCHAR(50) DEFAULT 'unresolved'",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },
    "developer_assigned": {
      "type": "VARCHAR(50)",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },
    "developer_notes": {
      "type": "TEXT",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },
    "resolution_type": {
      "type": "VARCHAR(50)",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },
    "resolution_comments": {
      "type": "TEXT",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },
    "developer_question": {
      "type": "TEXT",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },
    "developer_checked_at": {
      "type": "TIMESTAMP",
      "stage": "post_pipeline",
      "status": "EXISTS"
    },

    // ═══════════════════════════════════════════════════════════════════
    // NEW: Tier 1 - Quick Triage
    // ═══════════════════════════════════════════════════════════════════
    "tier1_classification": {
      "type": "VARCHAR(20)",
      "stage": "tier1",
      "status": "NEW",
      "values": ["unrelated", "needs_research", "obvious_burden"],
      "description": "Tier 1 quick classification result",
      "testing": "that only valid enum values are stored, and that classification triggers correct next step (unrelated+high conf → stop, others → tier2)"
    },
    "tier1_confidence": {
      "type": "REAL",
      "stage": "tier1",
      "status": "NEW",
      "description": "Confidence 0.0-1.0. If <0.7, escalate to Tier 2 even if 'unrelated'",
      "testing": "that confidence <0.7 with 'unrelated' still triggers tier2, and value is always 0.0-1.0"
    },
    "tier1_reasoning": {
      "type": "TEXT",
      "stage": "tier1",
      "status": "NEW",
      "description": "Explains classification including any signals detected (alternative language, professional context, etc.)",
      "testing": "that reasoning is always populated when tier1 completes"
    },
    "tier1_completed_at": {
      "type": "TIMESTAMP",
      "stage": "tier1",
      "status": "NEW",
      "description": "When Tier 1 triage completed",
      "testing": "that timestamp is set exactly when tier1 finishes, not before"
    },

    // ═══════════════════════════════════════════════════════════════════
    // NEW: Tier 2 - Full Context Research
    // ═══════════════════════════════════════════════════════════════════
    "tier2_classification": {
      "type": "VARCHAR(20)",
      "stage": "tier2",
      "status": "NEW",
      "values": ["unrelated", "justified", "burdensome"],
      "description": "Tier 2 classification. burdensome/justified→requirement_found=true, unrelated→false",
      "testing": "that classification correctly derives requirement_found and is_justified, and that 'justified' always has severity 1-3"
    },
    "tier2_confidence": {
      "type": "REAL",
      "stage": "tier2",
      "status": "NEW",
      "description": "Confidence 0.0-1.0 in Tier 2 classification",
      "testing": "that low confidence (<0.7) triggers needs_web_search=true"
    },
    "tier2_reasoning": {
      "type": "TEXT",
      "stage": "tier2",
      "status": "NEW",
      "description": "Step-by-step analysis applying the research procedure",
      "testing": "that reasoning follows the 12-step research procedure and references evidence used"
    },
    "argument_for_regulation": {
      "type": "TEXT",
      "stage": "tier2",
      "status": "NEW",
      "description": "Steelman: why burden might be justified (safety, security, fraud prevention)",
      "testing": "that this is always populated for burdensome/justified items"
    },
    "argument_against_regulation": {
      "type": "TEXT",
      "stage": "tier2",
      "status": "NEW",
      "description": "Steelman: why burden is problematic (modern alternatives, disproportionate impact)",
      "testing": "that this is always populated for burdensome/justified items"
    },
    "severity_baseline": {
      "type": "INTEGER",
      "stage": "tier2",
      "status": "NEW",
      "description": "Issue-type baseline (e.g., 6 for mail_only, 5 for in_person)",
      "testing": "that baseline matches the value from prompts/compliance_issues.yaml for the issue_type"
    },
    "severity_calculation": {
      "type": "TEXT",
      "stage": "tier2",
      "status": "NEW",
      "description": "Formula: 'Baseline 6 + no alternatives (+2) - professional licensee (-1) = 7'",
      "testing": "that calculation is parseable and matches: baseline + sum(modifiers) = final severity"
    },
    "context_used": {
      "type": "JSONB",
      "stage": "tier2 | tier3",
      "status": "NEW",
      "description": "Unified array of ALL context sources consulted during analysis - both DB sources (Tier 2) and web sources (Tier 3).",
      "linkage_approach": "hybrid - identifier string always present, source_id populated by post-processing when matchable",
      "schema": [
        {
          "type": "string (required) - self | hierarchy | sibling | definition | cross_reference | statute | web",
          "identifier": "string (required) - term for definitions, citation for statutes, URL for web",
          "source_id": "bigint | null - post-processing links to source table (document_id, definition_id, etc.)",
          "quote": "string | null - verbatim text from source",
          "summary": "string | null - for hierarchy type, the ancestor's summary",
          "relevance": "string (required) - how this context affected the analysis",
          "is_mandate": "boolean | null - for statute/web: does this mandate the requirement?",
          "state_discretion": "string | null - for statute/web with is_mandate=true: 'none' | 'partial' | 'full'",
          "// WEB-SPECIFIC (type='web' only)": "---",
          "url": "string - DERIVED from web search tool response",
          "title": "string - DERIVED from web search tool response",
          "source_type": "string - LLM classifies: advocacy | journalism | academic | government",
          "publication_date": "string | null - DERIVED from web search tool if available (YYYY-MM-DD)"
        }
      ],
      "type_details": {
        "self": "Text from the document being analyzed (alternatives, qualifiers, scope). source_id = document_id",
        "hierarchy": "Ancestor chain (parent section, subchapter, chapter, title). source_id = document_id",
        "sibling": "Other sections with same parent_id. source_id = document_id",
        "definition": "From definitions table. identifier = term, source_id = definitions.id",
        "cross_reference": "Explicit citation from cross_references table. source_id = document_id of target",
        "statute": "State or federal statute. identifier = citation, is_mandate + state_discretion indicate federal mandate status",
        "web": "Tier 3 web search result. url/title/publication_date DERIVED from tool. source_type/quote/relevance/is_mandate/state_discretion from LLM."
      },
      "derived_fields_note": "For type='web': url, title, publication_date come from web search tool response, NOT LLM. LLM provides: source_type, quote, relevance, is_mandate, state_discretion.",
      "testing": "that type is valid enum, identifier always populated, web entries have url/title derived from tool not hallucinated, is_mandate/state_discretion only for statute/web types"
    },
    "needs_web_search": {
      "type": "BOOLEAN DEFAULT FALSE",
      "stage": "tier2",
      "status": "NEW",
      "description": "Flag to trigger Tier 3 web search validation",
      "testing": "that this triggers tier3 processing, and is set when: confidence<0.7 OR severity>=7 OR statute mandate is uncertain"
    },
    "web_search_topics": {
      "type": "TEXT[]",
      "stage": "tier2",
      "status": "NEW",
      "description": "Suggested search topics if needs_web_search=true",
      "testing": "that topics are populated when needs_web_search=true and are actionable search queries"
    },
    "tier2_completed_at": {
      "type": "TIMESTAMP",
      "stage": "tier2",
      "status": "NEW",
      "description": "When Tier 2 research completed",
      "testing": "that timestamp is set exactly when tier2 finishes"
    },

    // ═══════════════════════════════════════════════════════════════════
    // NEW: Tier 3 - Web Search Validation
    // ═══════════════════════════════════════════════════════════════════
    "tier3_classification": {
      "type": "VARCHAR(20)",
      "stage": "tier3",
      "status": "NEW",
      "values": ["unchanged", "justified"],
      "description": "Tier 3 can reclassify 'burdensome' → 'justified' if web search reveals federal mandate or other justification. 'unchanged' means tier2 classification stands.",
      "testing": "that tier3 can only set 'justified' or 'unchanged', and that reclassification properly updates is_justified and severity"
    },
    "tier3_completed_at": {
      "type": "TIMESTAMP",
      "stage": "tier3",
      "status": "NEW",
      "description": "When Tier 3 web search completed. Presence indicates tier3 was performed (replaces tier3_completed boolean)",
      "testing": "that timestamp is set when tier3 completes, and null before"
    },
    "tier3_severity_adjustment": {
      "type": "INTEGER",
      "stage": "tier3",
      "status": "NEW",
      "constraint": "CHECK (tier3_severity_adjustment >= -3 AND tier3_severity_adjustment <= 3)",
      "description": "Adjustment from web search findings",
      "testing": "that adjustment is within -3 to +3 range, that final severity = tier2 severity + adjustment, and adjustment is null when tier3 not performed"
    },
    "tier3_reasoning": {
      "type": "TEXT",
      "stage": "tier3",
      "status": "NEW",
      "description": "Explanation of web search findings and any adjustments",
      "testing": "that reasoning is always populated when tier3 completes, and references specific web sources from context_used"
    },
    "web_search_summary": {
      "type": "TEXT",
      "stage": "tier3",
      "status": "NEW",
      "description": "Summary of web search findings",
      "testing": "that summary is populated when tier3 completes, is concise, and accurately reflects web entries in context_used"
    },

    // ═══════════════════════════════════════════════════════════════════
    // NEW: Pipeline Tracking
    // ═══════════════════════════════════════════════════════════════════
    "pipeline_version": {
      "type": "VARCHAR(20)",
      "stage": "all",
      "status": "NEW",
      "description": "'legacy' | 'research_v1' - which pipeline processed this",
      "testing": "that value is valid enum, that new records use 'research_v1', and that legacy records are properly tagged during migration"
    },
    "highest_tier_completed": {
      "type": "INTEGER",
      "stage": "all",
      "status": "NEW",
      "constraint": "CHECK (highest_tier_completed >= 0 AND highest_tier_completed <= 3)",
      "description": "0=regex only, 1=tier1, 2=tier2, 3=tier3",
      "testing": "that value increments as tiers complete, matches corresponding tier*_completed_at timestamps, and never decreases"
    },
    "classification_tier": {
      "type": "INTEGER",
      "stage": "all",
      "status": "NEW",
      "description": "Which tier made final classification (1, 2, or 3)",
      "testing": "that value matches the tier that determined requirement_found, and is consistent with tier*_classification values"
    },
    "tier1_batch_id": {
      "type": "VARCHAR(100)",
      "stage": "tier1",
      "status": "NEW",
      "description": "Anthropic batch ID for Tier 1 triage",
      "testing": "that batch_id is populated after tier1 batch completes, format matches Anthropic batch ID pattern"
    },
    "tier2_batch_id": {
      "type": "VARCHAR(100)",
      "stage": "tier2",
      "status": "NEW",
      "description": "Anthropic batch ID for Tier 2 research",
      "testing": "that batch_id is populated after tier2 batch completes, enables tracing back to batch results"
    }
  },

  "constraints": {
    "unique": "(document_id, issue_type, occurrence_number)",
    "checks": [
      "state IN ('NY', 'NJ')",
      "severity >= 1 AND severity <= 10",
      "tier3_severity_adjustment >= -3 AND tier3_severity_adjustment <= 3",
      "highest_tier_completed >= 0 AND highest_tier_completed <= 3"
    ]
  },

  "indexes": {
    "existing": [
      "idx_compliance_issues_document ON (document_id)",
      "idx_compliance_issues_state ON (state)",
      "idx_compliance_issues_issue_type ON (issue_type)",
      "idx_compliance_issues_state_issue ON (state, issue_type)",
      "idx_compliance_issues_requirement_found ON (requirement_found)",
      "idx_compliance_issues_severity ON (severity) WHERE severity IS NOT NULL",
      "idx_compliance_issues_review_status ON (review_status)",
      "idx_compliance_issues_developer_status ON (developer_status)",
      "idx_compliance_issues_developer_assigned ON (developer_assigned)"
    ],
    "new": [
      "idx_ci_tier1_classification ON (tier1_classification)",
      "idx_ci_tier2_classification ON (tier2_classification)",
      "idx_ci_needs_tier2 ON (id) WHERE tier1_classification = 'needs_research' AND tier2_classification IS NULL",
      "idx_ci_needs_tier3 ON (id) WHERE needs_web_search = true AND tier3_completed_at IS NULL",
      "idx_ci_pipeline_version ON (pipeline_version)",
      "idx_ci_context_used ON (context_used) USING GIN"
    ]
  },

  "stage_legend": {
    "regex_detection": "Initial pattern matching - creates record",
    "tier1": "Quick triage using summaries - classifies as unrelated/needs_research/obvious_burden",
    "tier2": "Full context research - applies 12-step procedure, steelman analysis, severity scoring",
    "tier3": "Web search validation - adjusts severity based on external sources",
    "legacy_searcher": "Existing searcher.py (to be replaced)",
    "post_pipeline": "Human review and developer tracking",
    "all": "Used across all stages"
  },

  "column_counts": {
    "existing": 30,
    "new_derived": 1,
    "new_derived_note": "is_justified (derived from classification)",
    "new_tier1": 5,
    "new_tier1_note": "includes tier1_batch_id",
    "new_tier2": 12,
    "new_tier2_note": "includes tier2_batch_id, dropped federally_mandated (derivable)",
    "new_tier3": 5,
    "new_tier3_note": "web_search_sources folded into context_used",
    "new_tracking": 3,
    "new_tracking_note": "pipeline_version, highest_tier_completed, classification_tier",
    "total_new": 26,
    "total_after_migration": 56
  },

  "design_decisions": [
    {
      "date": "2025-12-31",
      "decision": "Tier 1 signals → single tier1_reasoning TEXT",
      "rationale": "No use case for querying signals individually. Reasoning text captures everything."
    },
    {
      "date": "2025-12-31",
      "decision": "Use actual DB column names, not schema.sql",
      "rationale": "schema.sql is outdated. Actual: regex_match_pattern, regex_match_context, verbatim_supporting_text[], decision_rationale"
    },
    {
      "date": "2025-12-31",
      "decision": "requirement_found is derived, not set by LLM",
      "rationale": "Computed programmatically from tier classifications to avoid redundancy and ensure consistency."
    },
    {
      "date": "2025-12-31",
      "decision": "Add tier*_completed_at timestamps instead of boolean flags",
      "rationale": "Timestamps provide more info (when) and presence/null replaces boolean (tier3_completed_at IS NOT NULL = completed)."
    },
    {
      "date": "2025-12-31",
      "decision": "is_verbatim is derived, not set by LLM",
      "rationale": "Computed by is_verbatim_match() comparing LLM's verbatim_supporting_text against actual regulation content."
    },
    {
      "date": "2025-12-31",
      "decision": "is_verbatim checks ALL array elements, not just first",
      "rationale": "verbatim_supporting_text is an array. All quotes must be found in source for is_verbatim=true. Fixed in validation.py with are_all_verbatim()."
    },
    {
      "date": "2025-12-31",
      "decision": "Justified items have requirement_found=true with is_justified=true flag",
      "rationale": "Preserves nuance that burden exists but is acceptable. Justified items get requirement_found=true, is_justified=true, and severity 1-3."
    },
    {
      "date": "2025-12-31",
      "decision": "Tier 3 can reclassify burdensome → justified",
      "rationale": "Web search may reveal federal mandate or other justification not found in local context. Added tier3_classification with values 'unchanged' or 'justified'."
    },
    {
      "date": "2025-12-31",
      "decision": "Hybrid evidence linkage: citation always, ID when matchable",
      "rationale": "LLM always provides citation strings. Post-processing script matches citations to existing records and populates *_id fields when found. Queries can use either."
    },
    {
      "date": "2025-12-31",
      "decision": "Unified context_used array replaces separate evidence arrays",
      "rationale": "definitions_used, cross_references_used, statute_references, mitigating_factors all merged into single context_used[] with type discriminator. Simpler schema, captures all context sources (including hierarchy, siblings, and self) uniformly."
    },
    {
      "date": "2025-12-31",
      "decision": "Drop federally_mandated column - derivable from context_used",
      "rationale": "Can be computed from context_used where type='statute' AND is_mandate=true AND identifier matches CFR/USC pattern. No need for redundant storage."
    },
    {
      "date": "2025-12-31",
      "decision": "Fold web_search_sources into context_used with type='web'",
      "rationale": "Unified context array for all sources (DB + web). Web-specific fields (url, title, publication_date) are DERIVED from web search tool, not LLM-generated. Also dropped federal_mandate_confirmed and state_has_discretion columns - derivable from context_used entries with is_mandate and state_discretion fields."
    },
    {
      "date": "2025-12-31",
      "decision": "Separate batch_id columns per tier (tier1_batch_id, tier2_batch_id)",
      "rationale": "Different batches for each tier. Separate columns enable tracing issues back to specific batch runs."
    },
    {
      "date": "2025-12-31",
      "decision": "Keep severity_calculation as TEXT, not JSONB",
      "rationale": "Severity breakdown is for human review, not querying. TEXT is simpler and readable."
    },
    {
      "date": "2025-12-31",
      "decision": "Skip web_search_queries column",
      "rationale": "Queries already captured in web_search_topics (Tier 2 suggestions) and tier3_reasoning. No need for extra column."
    }
  ],

  "open_questions": [],

  "field_sources": {
    "description": "Categorizes each new field by how it gets populated",
    "categories": {
      "llm_output": "Returned by LLM in structured output - include in prompt schema",
      "derived": "Computed programmatically from other fields after LLM returns",
      "metadata": "Set by pipeline code (timestamps, batch IDs, versions)",
      "tool_derived": "Extracted from tool responses (web search URL/title)"
    },
    "tier1_fields": {
      "llm_output": ["tier1_classification", "tier1_confidence", "tier1_reasoning"],
      "metadata": ["tier1_completed_at", "tier1_batch_id"]
    },
    "tier2_fields": {
      "llm_output": [
        "tier2_classification", "tier2_confidence", "tier2_reasoning",
        "argument_for_regulation", "argument_against_regulation",
        "severity", "severity_baseline", "severity_calculation",
        "context_used (partial - see below)", "verbatim_supporting_text",
        "needs_web_search", "web_search_topics"
      ],
      "derived": ["is_justified", "requirement_found", "is_verbatim"],
      "metadata": ["tier2_completed_at", "tier2_batch_id"],
      "post_processed": ["context_used[].source_id - matched after LLM returns"]
    },
    "tier3_fields": {
      "llm_output": [
        "tier3_classification", "tier3_severity_adjustment", "tier3_reasoning",
        "web_search_summary", "context_used (web entries - partial)"
      ],
      "tool_derived": ["context_used[].url", "context_used[].title", "context_used[].publication_date"],
      "derived": ["final severity = tier2 + adjustment"],
      "metadata": ["tier3_completed_at"]
    },
    "tracking_fields": {
      "metadata": ["pipeline_version", "highest_tier_completed", "classification_tier"]
    },
    "context_used_entry_sources": {
      "llm_output": ["type", "identifier", "quote", "summary", "relevance", "is_mandate", "state_discretion", "source_type (web only)"],
      "tool_derived": ["url (web)", "title (web)", "publication_date (web)"],
      "post_processed": ["source_id"]
    }
  }
}
```
