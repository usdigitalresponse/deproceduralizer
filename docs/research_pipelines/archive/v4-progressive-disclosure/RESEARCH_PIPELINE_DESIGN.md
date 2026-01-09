# Research Pipeline: Progressive Context Disclosure

> **Status: CURRENT**
> This is the active architecture for the research pipeline.

## Overview

A 4-tier LLM pipeline with **progressive context disclosure** and **document-level analysis with match grouping** for cost-effective regulatory burden analysis.

**Key Innovations:**
- **Progressive Disclosure**: Context is revealed incrementally based on LLM requests
- **Match Grouping**: All regex matches for a (document, issue_type) pair are analyzed together
- **Document-Level Output**: Final output is per-document, not per-match
- **4-Layer Caching**: Structured prompts for maximum cache hits

**Requirements:**
- Scale: 10,000+ issue instances per run
- Latency: 24-hour batch API acceptable (Tiers 1-3)
- Web search: Real-time API (Tier 4 only, selective)
- Architecture: New script, eventually replaces compliance_issues/searcher.py

## Processing Model

### Processing Unit

```
ProcessingUnit = (document_id, issue_type, [all_regex_matches])
```

Example:
- Document: N.J.A.C. 13:69D-1.34
- Issue Type: in_person_appearance
- Matches: 6 regex hits → 4 pass Tier 1 → 2 distinct requirements in output

### Benefits

1. **19% fewer API calls**: 10,542 matches → 8,534 unique (doc, issue_type) pairs
2. **Context fetched once per document**, not per match
3. **Natural deduplication**: LLM consolidates multiple mentions of same requirement
4. **Holistic understanding**: LLM sees all matches in context

## Cost Summary

| Tier | Purpose | Docs | Cost/Doc | Total |
|------|---------|------|----------|-------|
| 1 | Match Filtering | 8,534 | ~$0.002 | ~$17 |
| 2 | Summary Research | 5,974 (70%) | ~$0.006 | ~$36 |
| 3 | Full Context | 1,195 (20%) | ~$0.015 | ~$18 |
| 4 | Web Validation | 239 (20%) | ~$0.025 | ~$6 |
| **Total** | | | | **~$77** |

**With caching (40% savings):** ~$46
**Compared to old approach:** ~$120 (62% savings)

---

## Tier Transition Rules

### Tier 2 → Next Tier

| Tier 2 Output | ambiguity_type | Next Tier | Reason |
|---------------|----------------|-----------|--------|
| `unrelated` | - | DONE | False positive |
| `justified` | - | DONE (or Tier 4 if potentially_controversial) | Confirmed legitimate |
| `burdensome`, sev < 5 | - | DONE | Low severity burden |
| `burdensome`, sev >= 5 | - | Tier 4 | High severity, verify mandate |
| `needs_full_context` | `internal` | Tier 3 | Need state regulatory context |
| `needs_full_context` | `external` | Tier 4 | Need federal/external verification |
| `needs_full_context` | `both` | Tier 3 → Tier 4 | Need both |

### Tier 3 → Next Tier

| Tier 3 Output | needs_web_search | Next Tier |
|---------------|------------------|-----------|
| Any | `false` | DONE |
| Any | `true` | Tier 4 |

### Escalation Trigger Rules

`needs_web_search = true` when ANY of:
- `severity >= 5` AND uncertain about federal mandate
- `confidence < 0.7` despite full context
- `classification == 'justified'` AND `potentially_controversial == true`
- `federal_mandate_suspected == true`
- Statute reference with unclear state discretion

---

## Tier 1: Match Filtering

**Goal:** Filter false positives and request context for Tier 2.

### What Tier 1 Sees

**Document metadata + matches + CONTEXT CATALOG (not content):**

```
## Document Under Analysis
Citation: N.J.A.C. 13:69D-1.34
Title: Application procedures

## Matches to Evaluate (6 total)
1. "appear in person" at position 234
   Context: "...the applicant must appear in person at the Division..."
2. "personal appearance" at position 567
   Context: "...personal appearance is required for identity verification..."
3. "person responsible" at position 891
   Context: "...the person responsible for the facility shall maintain..."
4. "submit in person" at position 1102
   Context: "...all documents must be submit in person during the..."
5. "in-person verification" at position 1445
   Context: "...in-person verification of credentials is mandatory..."
6. "person or entity" at position 1823
   Context: "...any person or entity seeking a license must..."

## Immediate Context

### Previous Section: N.J.A.C. 13:69D-1.33 - "Fees and payments"
Summary: Specifies application fees, payment methods, and fee schedules.
Fees are non-refundable and must accompany the application submission.

### Next Section: N.J.A.C. 13:69D-1.35 - "Waivers and exemptions"
Summary: Establishes procedures for requesting waivers from licensing
requirements. Waivers may be granted for good cause shown.

## Context Catalog (Available on Request)

### Sibling Sections (14 total)
- N.J.A.C. 13:69D-1.31 - "General provisions"
- N.J.A.C. 13:69D-1.32 - "Application procedures"
- N.J.A.C. 13:69D-1.35 - "Waivers and exemptions"  ← title suggests relevance
- ... (11 more)

### Cross-References (3 total)
- N.J.A.C. 13:69D-1.2 (Definitions)
- N.J.A.C. 7:13-6.7 (Environmental permits)
- N.J.S.A. 5:12-1 (Casino Control Act)

### Definition Terms Available
- "applicant", "casino", "commission", "department", "license", ...
```

### Tier 1 Output

```json
{
  "relevant_match_indices": [1, 2, 4, 5],
  "dismissed_matches": [
    {
      "match_index": 3,
      "text": "person responsible",
      "reason": "Refers to a responsible party, not in-person appearance"
    },
    {
      "match_index": 6,
      "text": "person or entity",
      "reason": "Refers to legal person/entity, not physical presence"
    }
  ],
  "classification": "needs_research",
  "confidence": 0.85,
  "reasoning": "4 matches appear to be genuine in-person requirements. Need sibling context to check for waivers.",
  "context_requests": [
    {
      "context_type": "sibling",
      "identifier": "N.J.A.C. 13:69D-1.35",
      "need_level": "summary",
      "reason": "Title mentions waivers which may apply to this requirement"
    },
    {
      "context_type": "cross_reference",
      "identifier": "N.J.A.C. 7:13-6.7",
      "need_level": "summary",
      "reason": "Referenced in document, need to understand related requirements"
    }
  ]
}
```

### Expected Outcomes

- ~40% → `all_false_positives` (DONE, no further processing)
- ~60% → `needs_research` (proceed to Tier 2)

---

## Tier 2: Summary-Based Research

**Goal:** Analyze document holistically with summaries of requested context.

### What Tier 2 Sees

**Full document + definitions + SUMMARIES of requested items:**

```
## Document Under Analysis
Citation: N.J.A.C. 13:69D-1.34
Title: Application procedures

## Full Content
[Complete regulation text - ~2,000 chars typical]

## Inherited Definitions (always included)
- "Applicant" means any person who has applied for a casino license...
- "Commission" means the Casino Control Commission...
- "Department" means the Department of Law and Public Safety...

## Requested Context (Summaries)

### Sibling: N.J.A.C. 13:69D-1.35 (Waivers and exemptions)
Summary: This section establishes procedures for requesting waivers from
licensing requirements. Waivers may be granted for good cause shown. The
Commission has discretion to waive documentation requirements but not
identity verification procedures.

### Cross-Reference: N.J.A.C. 7:13-6.7 (Environmental permits)
Summary: Establishes environmental permit requirements for construction
projects. Applicants must submit certified environmental impact statements.
References N.J.A.C. 13:69D-1.34 for casino-specific requirements.
```

### Tier 2 Output

```json
{
  "classification": "burdensome",
  "confidence": 0.88,
  "reasoning": "The regulation requires in-person appearance for both application submission and identity verification. The waiver section (N.J.A.C. 13:69D-1.35) allows waivers for documentation but explicitly excludes identity verification procedures. No electronic alternative is mentioned anywhere in the document.",

  "severity": 6,
  "severity_baseline": 5,
  "severity_calculation": "Base 5 (in_person_submission) + 1 (no waiver for identity verification) = 6",

  "verbatim_requirements": [
    "the applicant must appear in person at the Division office to submit the application",
    "in-person verification of credentials is mandatory before license issuance"
  ],

  "argument_for_regulation": "In-person appearance allows for immediate document verification and prevents identity fraud in casino licensing, which involves significant financial stakes.",

  "argument_against_regulation": "Modern identity verification methods (video conferencing, notarized affidavits, electronic verification systems) could achieve the same security goals without requiring physical presence. This creates barriers for applicants who must travel to the Division office.",

  "context_used": [
    {
      "type": "definition",
      "identifier": "applicant",
      "quote": "any person who has applied for a casino license",
      "relevance": "Clarifies this applies to license applicants, not general public"
    },
    {
      "type": "sibling",
      "identifier": "N.J.A.C. 13:69D-1.35",
      "quote": "The Commission may waive any documentation requirement...",
      "relevance": "Confirms waiver exists for documentation but not for identity verification"
    }
  ],

  "full_text_requests": [],

  "needs_web_search": false,
  "web_search_topics": [],

  "potentially_controversial": false,
  "federal_mandate_suspected": false,
  "ambiguity_type": null
}
```

### When to Request Full Text (proceed to Tier 3)

```json
{
  "classification": "needs_full_context",
  "confidence": 0.65,
  "reasoning": "The waiver section summary mentions exceptions but I need the full text to understand exactly what can be waived...",

  "full_text_requests": [
    {
      "context_type": "sibling",
      "identifier": "N.J.A.C. 13:69D-1.35",
      "need_level": "full_text",
      "reason": "Summary mentions waiver procedures but need full text to determine if this requirement can be waived"
    }
  ]
}
```

### Expected Outcomes

- ~30% → `unrelated` or `justified` (DONE)
- ~50% → `burdensome` with severity < 7 (DONE)
- ~20% → `needs_full_context` OR high severity (proceed to Tier 3)

---

## Tier 3: Full Context Deep Dive

**Goal:** Resolve uncertain cases with full text of specific items.

### What Tier 3 Sees

**Everything from Tier 2 + FULL TEXT of requested items:**

```
## [Everything from Tier 2]

## Requested Full Text

### Sibling: N.J.A.C. 13:69D-1.35 (Waivers and exemptions)
[Full 6,255 character content of this section]

(a) The Commission may waive any documentation requirement of this
subchapter upon demonstration of good cause. The applicant shall submit
a written request describing the hardship and proposed alternative
documentation.

(b) The Commission shall not waive the following requirements:
1. In-person appearance for identity verification pursuant to
   N.J.A.C. 13:69D-1.34(c);
2. Background investigation pursuant to N.J.A.C. 13:69D-1.36;
3. ...
```

### Tier 3 Output

```json
{
  "classification": "burdensome",
  "confidence": 0.95,
  "reasoning": "Full text of waiver section confirms that in-person appearance for identity verification explicitly CANNOT be waived. This is a hard requirement with no exceptions.",

  "severity_adjustment": 2,
  "severity_adjustment_reasoning": "Tier 2 severity was 5. Adding +1 (no waiver available) +1 (explicitly non-waivable) = +2 adjustment. Final severity: 7",

  "verbatim_requirements": [
    "the applicant must appear in person at the Division office to submit the application",
    "in-person verification of credentials is mandatory before license issuance"
  ],

  "argument_for_regulation": "In-person identity verification prevents fraud in high-stakes casino licensing where significant financial interests are at stake.",

  "argument_against_regulation": "Modern identity verification technologies (video conferencing with document verification, notarized affidavits, biometric verification) could achieve equivalent security without requiring travel to a specific government office.",

  "context_used": [
    {
      "type": "sibling",
      "identifier": "N.J.A.C. 13:69D-1.35",
      "quote": "The Commission shall not waive the following requirements: 1. In-person appearance for identity verification",
      "relevance": "Confirms this requirement is explicitly non-waivable"
    }
  ],

  "needs_web_search": true,
  "web_search_topics": [
    "casino licensing remote identity verification",
    "New Jersey casino license application modernization"
  ],

  "potentially_controversial": true,
  "federal_mandate_suspected": false
}
```

### Expected Outcomes

- ~80% → Final classification (DONE)
- ~20% → `needs_web_search` for high-severity items (proceed to Tier 4)

---

## Tier 4: Web Search Validation

**Goal:** External validation for high-severity or uncertain items.

### Trigger Conditions

- `needs_web_search: true` AND
- (`severity >= 5` OR `confidence < 0.7`)

### What Tier 4 Sees

**Tier 3 analysis + web search results:**

```
## Original Assessment
Classification: burdensome
Severity: 7
Citation: N.J.A.C. 13:69D-1.34

## Suggested Search Topics
- casino licensing remote identity verification
- New Jersey casino license application modernization

## Web Search Results
[Results from Claude's web search tool]
```

### Tier 4 Output

```json
{
  "classification": "burdensome",
  "severity_adjustment": 0,
  "final_severity": 7,

  "web_search_summary": "Found no evidence of remote verification programs in NJ casino licensing. Federal regulations (31 CFR 1021.220) require identity verification for casinos but do not mandate in-person verification specifically.",

  "context_used": [
    {
      "type": "web",
      "identifier": "https://www.fincen.gov/resources/statutes-regulations/guidance",
      "quote": "Pursuant to 31 CFR 1021.220, casinos must implement AML programs including identity verification, but the guidance does not specify in-person requirements.",
      "relevance": "Confirms federal AML requirements but no in-person mandate",
      "is_mandate": false,
      "state_discretion": "full"
    }
  ],

  "federal_mandate_found": false,
  "state_has_discretion": true,

  "reasoning": "Web search confirms that while federal AML regulations require identity verification for casino licensing, they do not specifically mandate in-person verification. New Jersey has discretion to implement electronic verification methods. The current in-person requirement appears to be a state policy choice rather than federal mandate."
}
```

---

## Prompt Structure for Caching

### Message Structure

```python
messages = [
    {
        "role": "system",
        "content": [
            # LAYER 1: Issue-Type Framework (CACHED)
            {
                "type": "text",
                "text": f"""
# Issue Analysis: {issue_type}
{issue_description}

## Positive Indicators
{positive_indicators}

## Negative Indicators
{negative_indicators}

## Classification Criteria
- UNRELATED: Not actually this issue type
- JUSTIFIED: Burden exists but legitimate justification
- BURDENSOME: Real burden without adequate justification

## Severity Scoring
Baseline: {severity_baseline}
Modifiers: {severity_modifiers}

## Few-Shot Examples
[Example inputs and JSON outputs]
"""
            },
            # LAYER 2: Tier-Specific Framework (CACHED)
            {
                "type": "text",
                "text": tier_procedure,
                "cache_control": {"type": "ephemeral"}
            }
        ]
    },
    {
        "role": "user",
        "content": [
            # LAYER 3: Subchapter Definitions (SEMI-CACHED)
            {
                "type": "text",
                "text": f"# Definitions\n{definitions}",
                "cache_control": {"type": "ephemeral"}
            },
            # LAYER 4: Document-Specific (DYNAMIC)
            {
                "type": "text",
                "text": f"# Document\n{document_content}\n\n# Matches\n{matches}\n\n# Context\n{context}"
            }
        ]
    }
]
```

### Batching Strategy

```python
# Sort for maximum cache reuse
items.sort(key=lambda x: (x.issue_type, x.subchapter_id, x.document_id))
```

---

## Database Schema

See [RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md](./RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md) for full schema.

### Key New Columns

**Tier tracking:**
- `tier1_classification`, `tier1_context_requests`, `tier1_completed_at`
- `tier2_classification`, `tier2_full_text_requests`, `tier2_completed_at`
- `tier3_classification`, `tier3_completed_at`
- `tier4_severity_adjustment`, `tier4_completed_at`

**Document-level output:**
- `verbatim_requirements TEXT[]` - Extracted requirement quotes
- `context_used JSONB` - Which context influenced analysis
- `grouped_match_count INTEGER` - How many matches were evaluated

---

## File Structure

```
backend/scripts/research_pipeline/
    __init__.py
    cli.py                    # Entry point
    models.py                 # Pydantic schemas
    context_builder.py        # Context catalog and fetching
    context_registry.py       # Deduplication
    tier1_filtering.py        # Match filtering
    tier2_summary.py          # Summary-based research
    tier3_fulltext.py         # Full context deep dive
    tier4_websearch.py        # Web validation
    cost_tracker.py           # Token/cost logging
    db_writer.py              # Save results

prompts/
    research_pipeline.yaml    # Tier-specific prompts
    issue_configs/            # 43 issue-specific configurations
        _index.yaml
        mail_only.yaml
        ... (43 total)
```

---

## CLI Interface

```bash
# Full pipeline
python -m research_pipeline.cli run --state NJ --issue-type wet_signature

# Estimate only (no LLM calls)
python -m research_pipeline.cli estimate --state NJ

# Tier 1 only (testing)
python -m research_pipeline.cli run --state NJ --tier 1

# Resume batch
python -m research_pipeline.cli resume --batch-id msgbatch_xxx

# Skip web search (cost saving)
python -m research_pipeline.cli run --state NJ --max-tier 3
```

---

## Implementation Order

1. **Phase 1: Models & Context** - Pydantic schemas, context catalog, context registry
2. **Phase 2: Tier 1 Filtering** - Match grouping, false positive detection
3. **Phase 3: Tier 2 Summary** - Summary-based research, context requests
4. **Phase 4: Tier 3 Full Text** - Full context deep dive
5. **Phase 5: Tier 4 Web** - Web search integration
6. **Phase 6: CLI & Integration** - Command-line interface, database writer

---

## Related Documents

- [OVERVIEW.md](./OVERVIEW.md) - Quick reference
- [CONTEXT_DISCLOSURE.md](./CONTEXT_DISCLOSURE.md) - Progressive disclosure details
- [CACHING_STRATEGY.md](./CACHING_STRATEGY.md) - 4-layer caching approach
- [MATCH_GROUPING.md](./MATCH_GROUPING.md) - Document-level analysis
- [RESEARCH_PIPELINE_MODELS.md](./RESEARCH_PIPELINE_MODELS.md) - Pydantic schemas
- [RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md](./RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md) - Database schema
