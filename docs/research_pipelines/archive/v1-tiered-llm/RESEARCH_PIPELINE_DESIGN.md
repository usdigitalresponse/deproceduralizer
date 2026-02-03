# Cost-Optimized LLM Research Pipeline for Regulatory Burden Analysis

> **Status: HISTORICAL**
> This document describes the original 3-tier design. See `../../` for current architecture.

## Overview

Create a 3-tier LLM pipeline that applies the regulatory research procedure to compliance issues cost-effectively using Claude Haiku 4.5 Batch API.

**Requirements:**
- Scale: 2000+ items per run
- Latency: 24-hour batch API acceptable (50% cost savings)
- Web search: Claude's built-in (for Tier 3 only, selective)
- Architecture: New script, eventually replaces compliance_issues/searcher.py

## Cost Summary

| Tier | Items (est.) | Cost | Purpose |
|------|--------------|------|---------|
| Tier 1 | 2000 | ~$0.80 | Quick triage: UNRELATED vs NEEDS_RESEARCH |
| Tier 2 | 1000 | ~$3.00 | Full context research with DB data |
| Tier 3 | 100 | ~$0.50 | Web search for selective validation |
| **Total** | 2000 | **~$4.30** | vs ~$8+ without tiering |

---

## Tier 1: Quick Triage

**Goal**: Filter out obvious false positives cheaply using only the matched context.

### Prompt

The system prompt is static (cached). The template includes issue-specific guidance pulled from the config.

```yaml
tier1_triage:
  system: |
    You are a regulatory burden triage assistant. Your job is to quickly classify
    whether a flagged regulatory provision needs full research or is obviously
    not a burden.

    CLASSIFICATION OPTIONS:
    1. UNRELATED - The flag is clearly a false positive:
       - The matched text is about something completely different
       - Clear alternatives exist in the same sentence ("by mail OR electronically")
       - It's a definition, not a requirement
       - The requirement is clearly optional and in a manner that eliminates the burden ("may", "if desired")

    2. NEEDS_RESEARCH - Cannot determine without more context:
       - The requirement appears real but context is unclear
       - May have alternatives elsewhere in the regulation
       - Affects population that's unclear
       - Legal justification is uncertain

    3. OBVIOUS_BURDEN - Clearly problematic, high confidence:
       - Unambiguous requirement with no stated alternatives
       - Affects individuals accessing services
       - Outdated technology with clear modern alternative and no mention of it
       - Language like "shall", "must", "only" with no exceptions
       - Does not appear that there is any context missing

    QUICK SIGNALS TO CHECK:
    - Alternative language: "or", "alternatively", "may also", "electronic", "online"
    - Optional language: "may", "if the applicant chooses", "optional"
    - Professional context: "licensee", "applicant for license", "practitioner"
    - B2B context: "contractor", "vendor", "between agencies"

    Be CONSERVATIVE with OBVIOUS_BURDEN - when in doubt, classify as NEEDS_RESEARCH.

  template: |
    ISSUE TYPE: {issue_type}
    MATCHED PATTERN: {matched_pattern}
    DOCUMENT TITLE: {document_title}

    ## ISSUE-SPECIFIC GUIDANCE

    {issue_description}

    This IS a compliance issue when:
    {issue_positive_indicators}

    This is NOT a compliance issue when:
    {issue_negative_indicators}

    ## CONTEXT FROM SUMMARIES

    This section: {section_summary}

    Hierarchy context:
    {hierarchy_summaries}

    ## MATCHED CONTEXT (±300 chars)

    {matched_context}

    ---
    Classify this as UNRELATED, NEEDS_RESEARCH, or OBVIOUS_BURDEN.
```

### Example: Filled Template for `mail_only`

```
ISSUE TYPE: mail_only
MATCHED PATTERN: submit.{0,20}by mail
DOCUMENT TITLE: Application requirements

## ISSUE-SPECIFIC GUIDANCE

Mail required with no electronic alternative. Determine whether mail is the
ONLY permitted submission method, or whether electronic/online submission
is also offered as an alternative.

This IS a compliance issue when:
- Mail is explicitly required as the ONLY submission method
- No electronic/online alternative is mentioned
- The regulation says things like "must be mailed", "submit by mail only"

This is NOT a compliance issue when:
- Mail is offered as ONE option among several (including electronic)
- The regulation mentions email, online portal, electronic submission as alternatives
- Mail is mentioned for context but not as a requirement

## CONTEXT FROM SUMMARIES

This section: Specifies documentation and submission requirements for
community residence license applications, including forms, fees, and deadlines.

Hierarchy context:
- Subchapter (N.J.A.C. 10:44A-7): Licensing procedures for community residences
  serving individuals with developmental disabilities
- Chapter (N.J.A.C. 10:44A): Standards for community agencies providing
  residential services under DHS oversight

## MATCHED CONTEXT (±300 chars)

...The application and all supporting documents shall be submitted by mail
to the Department at the address specified in N.J.A.C. 10:44A-2.1. Applications
received after the deadline...

---
Classify this as UNRELATED, NEEDS_RESEARCH, or OBVIOUS_BURDEN.
```

### Output

```json
{
  // Classification decision
  "classification": "needs_research",  // "unrelated" | "needs_research" | "obvious_burden"
  "confidence": 0.75,                  // 0.0-1.0, <0.7 triggers Tier 2 even if "unrelated"
  "reasoning": "Requires mail submission but unclear if electronic option exists elsewhere",

  // Quick signals detected
  "has_alternative_language": false,   // Found "or", "may", "electronic"?
  "alternative_found": null,           // Quote if found: "or by electronic submission"
  "affects_professionals_only": true,  // "licensee", "practitioner" context
  "is_b2b_context": false              // Business-to-business/government
}
```

**Expected filtering**: ~40% UNRELATED, ~50% NEEDS_RESEARCH, ~10% OBVIOUS_BURDEN

---

## Tier 2: Full Context Research

**Goal**: Apply the complete research procedure using pre-fetched database context.

### Input Context (Pre-assembled from DB)

```
## FULL DOCUMENT TEXT
CITATION: N.J.A.C. 10:44A-7.3
TITLE: Application requirements
HIERARCHY LEVEL: section
CONTENT: [full regulation text]

## ANCESTOR CHAIN (section → subchapter → chapter → title)
- N.J.A.C. 10:44A-7.3 (section) - Application requirements
- N.J.A.C. 10:44A-7 (subchapter) - Community residences
- N.J.A.C. 10:44A (chapter) - Standards for community agencies
- Title 10 (title) - Human Services

## INHERITED DEFINITIONS (scope-based)
- "applicant" means any person applying for licensure... (scope: chapter)
- "community residence" means a supervised... (scope: chapter)

## SIBLING SECTIONS (same parent)
- N.J.A.C. 10:44A-7.1 - Scope (other)
- N.J.A.C. 10:44A-7.4 - Waivers (waiver)  ← KEY: waiver section exists
- N.J.A.C. 10:44A-7.5 - Exemptions (exemption)

## CROSS-REFERENCES
FROM this section:
- "pursuant to N.J.A.C. 10:44A-2.1" → Definitions section
TO this section:
- Referenced by N.J.A.C. 10:44A-8.2 (enforcement)

## STATUTE REFERENCES
- N.J.S.A. 30:11B-1 et seq. (state statute)
- 42 U.S.C. 1396 (federal - Medicaid)  ← May indicate federal mandate
```

### Prompt

```yaml
tier2_research:
  system: |
    You are a regulatory research analyst applying a systematic procedure to
    determine whether a flagged provision is truly burdensome.

    ## RESEARCH PROCEDURE

    You will receive pre-assembled context from the database. Use ALL provided
    context to make your determination:

    1. **FULL TEXT**: Read the complete regulation section, not just the matched snippet
       - What is this ACTUALLY about? (titles can be misleading)
       - Who is affected, prevented from getting a service, burdened? (vulnerable populations vs. professionals) If the procedures protect vulnerable populations without preventing them or creating a barrier to them getting a service, then that is not a negative. 
       - Are there mitigating words ("up to", "may", "unless", "or")?

    2. **ANCESTOR CHAIN**: Understand the regulatory scheme
       - What chapter/subchapter is this in?
       - What is the overall purpose of this regulatory area?

    3. **INHERITED DEFINITIONS**: Terms may have specific meanings
       - Look for definitions that clarify vague terms
       - Scope-based inheritance means definitions apply from parent sections

    4. **SIBLING SECTIONS**: Related sections at the same level
       - Look for waiver provisions, exemptions, alternative procedures
       - Look for context that could be helpful to understand vagueness in the section

    5. **CROSS-REFERENCES**: What this section cites and what cites it
       - May reveal alternatives or related requirements
       - Incoming refs show how requirement is used in practice

    6. **STATUTE REFERENCES**: Federal or state mandates
       - If CFR or U.S.C. is cited, may be federally mandated
       - Federally mandated = not a state-level burden to fix

    ## STEELMAN BOTH SIDES

    You MUST provide the best argument FOR and AGAINST the regulation:

    **FOR the regulation (why it might be justified):**
    - Safety rationale: Protects vulnerable people or prevents harm without preventing those same individuals from getting critical benefits?
    - Security context: Legitimate security concern?
    - Fraud prevention: Prevents identity fraud, tampering?
    - Legal/evidentiary purpose: Needed for legal notice, court admissibility?
    - Federal compliance: Required by federal law?

    **AGAINST the regulation (why it might be burdensome):**
    - Modern alternatives exist: Electronic methods could work?
    - Disproportionate impact: Burden falls heavily on specific populations?
    - Cost-benefit: Burden proportionate to risk?
    - Outdated purpose: Original justification obsolete?

    ## CLASSIFICATION

    1. **UNRELATED**: Not actually a regulatory burden
       - Misclassified, alternatives exist and clearly stated, optional, irrelevant, exempted

    2. **JUSTIFIED**: IS a burden, but legitimate justification exists
       - Safety-critical, security-justified, federally mandated, proportionate to risk
       - Note: Still document improvement opportunities

    3. **BURDENSOME**: Real burden without adequate justification
       - Assign severity 1-10 using baseline + modifiers

    ## SEVERITY SCORING

    Start with baseline by issue type:
    | Issue Type | Baseline | Rationale |
    |------------|----------|-----------|
    | check_payment, mail_only | 6 | Clear modern alternative exists |
    | in_person_submission, in_person_hearing | 5 | May have valid reasons |
    | notarization, wet_signature | 4 | UETA/E-SIGN may apply |
    | certified_mail, physical_posting | 3 | Often has legal purpose |
    | waiting_period, mandated_reports | 3 | Often has processing purpose |

    INCREASE severity (+1 to +2 each):
    - Affects vulnerable populations (inmates, foster families, benefits applicants)
    - No alternatives exist in regulation ("shall" with no "or")
    - High cost relative to affected population
    - Recurring requirement (not one-time)
    - Blocks access to essential services
    - Cumulative with other burdens

    DECREASE severity (-1 to -2 each):
    - Affects professional licensees (voluntary career choice)
    - B2B/B2G context
    - Alternatives exist in regulation
    - One-time requirement
    - Partial justification exists
    - Low absolute cost

    Document calculation: "Baseline 5 + vulnerable pop (+2) + no alternatives (+2) = 9"

    ## WEB SEARCH FLAG

    Set needs_web_search=true if:
    - Federal mandate is cited but unclear if state has discretion
    - Advocacy concerns might exist (affects vulnerable populations)
    - Unusual requirement that might have documented controversies
    - Confidence in classification is low

  template: |
    ## ISSUE BEING RESEARCHED
    ISSUE TYPE: {issue_type}
    MATCHED PATTERN: {matched_pattern}

    ## ISSUE-SPECIFIC GUIDANCE

    {issue_description}

    This IS a compliance issue when:
    {issue_positive_indicators}

    This is NOT a compliance issue when:
    {issue_negative_indicators}

    Severity baseline for this issue type: {severity_baseline}

    {context}

    ---

    Apply the research procedure. Steelman both sides. Classify and score.
```

### Example: Tier 2 Context for `mail_only`

```
## ISSUE BEING RESEARCHED
ISSUE TYPE: mail_only
MATCHED PATTERN: submit.{0,20}by mail

## ISSUE-SPECIFIC GUIDANCE

Mail required with no electronic alternative. Determine whether mail is the
ONLY permitted submission method, or whether electronic/online submission
is also offered as an alternative.

This IS a compliance issue when:
- Mail is explicitly required as the ONLY submission method
- No electronic/online alternative is mentioned
- The regulation says things like "must be mailed", "submit by mail only"

This is NOT a compliance issue when:
- Mail is offered as ONE option among several (including electronic)
- The regulation mentions email, online portal, electronic submission
- Mail is mentioned for context but not as a requirement

Severity baseline for this issue type: 6 (clear modern alternative exists)

## FULL DOCUMENT TEXT
CITATION: N.J.A.C. 10:44A-7.3
TITLE: Application requirements
...

## ANCESTOR CHAIN
...

## INHERITED DEFINITIONS
...

[rest of context]

---

Apply the research procedure. Steelman both sides. Classify and score.
```

### Output

```json
{
  // CLASSIFICATION
  "classification": "burdensome",      // "unrelated" | "justified" | "burdensome"

  // SEVERITY (only if burdensome)
  "severity": 7,                       // 1-10
  "severity_calculation": "Baseline 6 (mail_only) + no alternatives (+2) - professional licensee (-1) = 7",

  // REASONING - Step-by-step analysis leading to conclusion
  "reasoning": "The regulation explicitly requires mail submission with no electronic alternative mentioned. Checked sibling sections for waivers - N.J.A.C. 10:44A-7.4 provides waivers but only for documentation requirements, not submission method. The ancestor chain shows this is for community residence licensing, affecting service providers not vulnerable populations directly. No federal mandate found in statute references. The mail requirement appears to be an agency choice rather than statutory requirement.",

  // STEELMAN ANALYSIS
  "argument_for_regulation": "Mail submission creates a paper trail for audit purposes and ensures the agency receives original documents for verification. Some applicants may not have reliable internet access.",
  "argument_against_regulation": "Modern electronic submission systems provide better audit trails than mail. Original documents can be scanned. This creates delays and costs for applicants who must purchase postage and visit a post office.",

  // VERBATIM EVIDENCE - Exact quotes from sources with citations
  "evidence": {
    "requirement_quote": {
      "text": "The application and all supporting documents shall be submitted by mail to the Department at the address specified in N.J.A.C. 10:44A-2.1",
      "source": "N.J.A.C. 10:44A-7.3 (this section)"
    },
    "mitigating_factors_checked": [
      {
        "text": "The Department may waive any requirement of this subchapter upon demonstration of hardship",
        "source": "N.J.A.C. 10:44A-7.4 (sibling - Waivers)",
        "applies": false,
        "why": "Waiver applies to documentation requirements, not submission method"
      }
    ],
    "definitions_used": [
      {
        "term": "applicant",
        "relevance": "Clarifies this applies to service providers, not individuals seeking services"
      }
    ],
    "cross_references_used": [
      {
        "citation": "N.J.A.C. 10:44A-2.1",
        "verbatim_text_used": "Lists department address and contact information",
        "relevance": "Referenced for address but does not provide electronic alternative"
      }
    ],
    "statute_references": [
      {
        "citation": "N.J.S.A. 30:11B-4",
        "text": "The Department shall establish standards for community residences...",
        "is_mandate": false,
        "why": "Grants rulemaking authority but does not mandate mail submission"
      }
    ]
  },

  // IF UNRELATED - Why is this not actually a burden?
  "unrelated_reason": null,

  // IF JUSTIFIED - Why is the burden acceptable?
  "justification_reason": null,

  // IMPROVEMENT OPPORTUNITY (even for justified items)
  "improvement_opportunity": "Accept electronic submission via online portal",

  // FEDERAL MANDATE CHECK
  "federally_mandated": false,

  // WEB SEARCH TRIGGER
  "needs_web_search": false,
  "web_search_topics": [],
  "confidence": 0.85
}
```

### Classification → Database Mapping

| classification | requirement_found | severity | Notes |
|---------------|-------------------|----------|-------|
| "unrelated" | false | null | Not a compliance issue |
| "justified" | false | null | Burden exists but justified |
| "burdensome" | true | 1-10 | Real compliance issue |

---

## Tier 3: Web Search Validation

**Goal**: External validation for items where web search would change the assessment.

**Trigger**: `needs_web_search=true` AND (`severity >= 5` OR `confidence < 0.7`)

### Prompt

```yaml
tier3_websearch:
  system: |
    You are validating a regulatory burden assessment using web search.

    You have already analyzed a regulatory provision and classified it as
    potentially burdensome. Now use web search to:

    1. **Verify federal mandates**: If statute citations exist, confirm whether
       states have discretion or must comply

    2. **Find documented concerns**: Search for:
       - Advocacy organization reports
       - Investigative journalism
       - Academic studies on regulatory burden
       - Affected population voices

    3. **Confirm or adjust severity**: Based on what you find:
       - INCREASE severity if advocacy/journalism documents real harm
       - DECREASE severity if the requirement has been relaxed or has workarounds
       - MAINTAIN severity if web search is inconclusive

    ## SEARCH STRATEGY

    For each suggested topic, search and synthesize findings.

    Example effective searches:
    - "[state] [requirement] advocacy concerns"
    - "[federal citation] state discretion requirements"
    - "[affected population] [burden type] barriers"

  template: |
    ## ORIGINAL ASSESSMENT

    ISSUE TYPE: {issue_type}
    DOCUMENT: {citation} - {title}
    CURRENT CLASSIFICATION: {classification}
    CURRENT SEVERITY: {severity}
    CONFIDENCE: {confidence}

    ## ARGUMENTS FOR REGULATION
    {argument_for}

    ## ARGUMENTS AGAINST REGULATION
    {argument_against}

    ## SUGGESTED SEARCH TOPICS
    {web_search_topics}

    ## STATUTE CITATIONS TO VERIFY
    {statute_citations}

    ---

    Perform web searches on the suggested topics. Synthesize findings.
    Recommend severity adjustment if warranted.
```

### Output

```json
{
  // SEARCH RESULTS
  "web_search_summary": "Found advocacy reports from Legal Aid documenting delays in benefits processing due to mail-only requirements. No federal mandate requires mail submission.",
  "sources": [
    {
      "url": "https://example.org/report",
      "title": "Barriers to Benefits Access in New Jersey",
      "source_type": "advocacy",        // "advocacy" | "journalism" | "academic" | "government"
      "relevance": "Documents 2-week delays from mail processing vs same-day electronic",
      "used_in_analysis": true //true or false whether the source was actually used in the analysis
    }
  ],

  // SEVERITY ADJUSTMENT
  "severity_adjustment": 1,             // -3 to +3
  "adjustment_reason": "Advocacy documentation of real-world harm increases severity",

  // UPDATED ASSESSMENT
  "final_severity": 8,                  // Original (7) + adjustment (1), clamped 1-10
  "final_confidence": 0.92,

  // FEDERAL MANDATE VERIFICATION
  "federal_mandate_confirmed": false,   // Did web search confirm federal requirement?
  "state_has_discretion": true          // Can state change this?
}
```

---

## Batch SQL for Context Assembly

Single query fetches all context for 500+ documents efficiently:

```sql
WITH target_docs AS (SELECT unnest($1::bigint[]) as doc_id),

ancestors AS (
    -- Recursive CTE for ancestor chain via parent_id
),
definitions AS (
    -- Scope-based inheritance via ancestors
),
siblings AS (
    -- Same parent_id, flag waiver/exemption sections
),
cross_refs AS (
    -- Both directions with target summaries
),
statute_refs AS (
    -- Federal/state citations
)

SELECT doc_id, ancestors, definitions, siblings, cross_refs, statute_refs
FROM target_docs ...
```

---

## File Structure

```
backend/scripts/research_pipeline/
    __init__.py
    cli.py                    # Entry point
    models.py                 # Pydantic schemas
    context_builder.py        # Batch SQL queries
    tier1_triage.py           # Quick classification
    tier2_research.py         # Full context analysis
    tier3_websearch.py        # Selective web validation
    cost_tracker.py           # Token/cost logging
    db_writer.py              # Save to compliance_issues

prompts/research_pipeline.yaml  # Tier-specific prompts
```

---

## CLI Interface

```bash
# Full pipeline
python -m research_pipeline.cli run --state NJ --issue wet_signature

# Estimate only (no LLM calls)
python -m research_pipeline.cli estimate --state NJ

# Tier 1 only (testing)
python -m research_pipeline.cli run --state NJ --tier1-only

# Resume batch
python -m research_pipeline.cli resume --batch-id msgbatch_xxx

# Skip web search (cost saving)
python -m research_pipeline.cli run --state NJ --skip-tier3
```

---

## Implementation Order

1. **Phase 1: Context Builder** - Batch SQL queries for ancestors, definitions, siblings, cross-refs
2. **Phase 2: Tier 1 Triage** - Pydantic models, prompt, batch integration
3. **Phase 3: Tier 2 Research** - Full research prompt, severity calculation, steelman extraction
4. **Phase 4: Tier 3 Web Search** - Real-time API with web search, severity adjustment
5. **Phase 5: CLI & Integration** - Command-line interface, cost tracking, database writer

---

## Success Metrics

- **Cost**: <$5 per 2000 candidates (vs ~$10+ current approach)
- **Accuracy**: Higher true positive rate due to context
- **Coverage**: All 12 research procedure steps implemented
- **Speed**: Full run completes in <48 hours (2 batch cycles)
