# Research Pipeline V5 Overview

> **Version:** V5 (Proactive Context + Argument Framing)
> **Status:** Implemented

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RESEARCH PIPELINE V5                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │  PRE-TIER 1      │  Deterministic context gathering                      │
│  │  (No LLM)        │  • Preceding + following sibling summaries            │
│  │                  │  • Keyword-filtered sibling/cross-ref summaries       │
│  │                  │  • Max 20 summaries, full catalogs for recommendations│
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │  TIER 1          │  Triage + Argument Framing                            │
│  │  (LLM Call)      │  • Filter false positive matches                      │
│  │                  │  • Generate best_argument for each classification     │
│  │                  │  • Recommend siblings/cross-refs for Tier 2           │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │  TIER 2          │  Full Classification                                  │
│  │  (LLM Call)      │  • Full document + definitions + Tier 1 framing       │
│  │                  │  • Can request additional context → re-run            │
│  │                  │  • Final: classification, severity, verbatim reqs     │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼ (selective triggers)                                            │
│  ┌──────────────────┐                                                       │
│  │  TIER 3          │  External Verification                                │
│  │  (Web Search)    │  Triggers: issue type, federal citation, severity≥8  │
│  │                  │  • Structured flags with evidence                     │
│  │                  │  • superseded_by_law, federal_mandate_confirmed, etc. │
│  └──────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Innovations (vs V4)

| Innovation | V4 Approach | V5 Approach | Why Better |
|------------|-------------|-------------|------------|
| Context gathering | Reactive (LLM requests) | Proactive (keyword filter) | Models don't ask for help |
| Argument framing | Generated in Tier 2 | Generated in Tier 1 | Primes Tier 2 thinking |
| Verification | Tier 3 (full context) + Tier 4 (web) | Tier 2 re-run + Tier 3 (web only) | Simpler, fewer tiers |
| Summary limit | Unlimited | Max 20 | Predictable token usage |
| Re-run tracking | Not tracked | Logged with count + reasons | Auditability |

## Data Flow Summary

```
Pre-Tier 1 assembles (priority order):
  ├── 1. Preceding sibling summary (unless definitions/TOC/reserved)
  ├── 2. Following sibling summary (unless definitions/TOC/reserved)
  ├── 3. Keyword-matched sibling summaries (exemptions > alternatives > scope)
  ├── 4. Keyword-matched cross-ref summaries
  ├── (Max 20 summaries total across all above)
  ├── Ancestor summaries (all)
  ├── Full sibling catalog (titles only)
  ├── Full cross-ref catalog (citations only)
  └── Definition terms available

Tier 1 outputs:
  ├── Match filtering (relevant_match_indices, dismissed_matches)
  ├── Argument framing (best_argument_burdensome/justified/unrelated)
  └── Context requests (context_requests: [{context_type, identifier, need_level, reason}])

Tier 2 receives:
  ├── Full document content
  ├── Definitions (inherited)
  ├── Tier 1 argument framing
  └── Tier 1 recommendations

Tier 2 can request:
  ├── Additional sibling summaries → re-run with context
  ├── Full text of siblings → re-run with context
  └── (Each re-run logged: rerun_count++, context_requests_made)

Tier 2 outputs:
  ├── Classification (burdensome/justified/unrelated)
  ├── Severity (1-10) with baseline + calculation
  ├── Verbatim requirements (exact quotes)
  ├── Context used (with quotes and relevance)
  ├── Arguments for/against regulation
  └── Routing flags (cites_federal_statute, potentially_controversial)

Tier 3 (if triggered) outputs:
  ├── Structured flags with evidence:
  │   ├── superseded_by_law
  │   ├── federal_mandate_confirmed
  │   ├── state_discretion_found
  │   ├── modernized_alternative_found
  │   └── advocacy_for_change
  └── Web search summary
```

## Cost Estimate

| Component | Volume | Cost/1000 | Total @ 250k |
|-----------|--------|-----------|--------------|
| Tier 1 (batch) | 100% | $0.25 | $63 |
| Tier 2 (batch) | ~70% (after Tier 1 filter) | $1.50 | $263 |
| Tier 2 re-runs (real-time) | ~10% | $3.00 | $75 |
| Tier 3 (real-time + web) | ~15% | $12-15 | $450-563 |
| **Total** | | | **~$850-965** |

**API Strategy:**
- Tier 1 & Tier 2 initial: Batch API (50% cost savings, 24hr latency OK)
- Tier 2 re-runs: Real-time API (cannot wait 24hr between context requests)
- Tier 3: Real-time API (web search is synchronous)

Compared to V4: ~$1,000+ (with Tier 3 + Tier 4 for all items)

## Tier 3 Triggers

Tier 3 (external verification) runs when ANY of:
- High-risk issue type AND severity ≥ 6
  - Issue types: `newspaper`, `notarization`, `wet_signature`, `witness`, `in_person_*`, `mandated_reports`
- `cites_federal_statute = true`
- `claims_no_alternative = true` AND severity ≥ 7
- Severity ≥ 8 AND classification = "burdensome"
- `potentially_controversial = true` AND classification = "justified"
- `federal_mandate_suspected = true`

## Tier 3 Implementation (Single-Call Web Search)

Tier 3 uses a **single-call approach** with Claude's `web_search` tool:

1. **Single API call**: Claude performs web searches AND outputs analysis together
2. **State-specific location**: `user_location` parameter localizes searches (e.g., Trenton, NJ)
3. **Citation extraction**: Quoted text extracted from Claude's response `citations` array
4. **JSON parsing**: Since `tools` and `response_format` can't be combined, Claude outputs JSON in its text response

```python
# Example configuration
web_search_tool = {
    "type": "web_search_20250305",
    "name": "web_search",
    "max_uses": 5,
    "user_location": {
        "type": "approximate",
        "city": "Trenton",
        "region": "New Jersey",
        "country": "US"
    }
}
```

Evidence is stored in `tier3_flags` column (not merged into `context_used`) to preserve Tier 2's context while adding web sources.

## Quick Reference: Output Fields

### Tier 1 Output
- `relevant_match_indices`, `dismissed_matches`
- `classification` (all_false_positives | needs_research)
- `best_argument_burdensome`, `best_argument_justified`, `best_argument_unrelated`
- `context_requests` (array of `{context_type, identifier, need_level, reason}`)

### Tier 2 Output
- `classification` (burdensome | justified | unrelated)
- `severity`, `severity_baseline`, `severity_calculation`
- `argument_for_regulation`, `argument_against_regulation`
- `verbatim_requirements` (list of exact quotes)
- `context_used` (list with type, identifier, quote, relevance)
- `rerun_count`, `context_requests_made`
- `cites_federal_statute`, `federal_citation`, `potentially_controversial`

### Tier 3 Output (if triggered)
- `classification`, `severity_adjustment`, `final_severity`
- `superseded_by_law`, `federal_mandate_confirmed`, `state_discretion_found`, `modernized_alternative_found`, `advocacy_for_change`
- `evidence_gap` (true if search found nothing)
- `context_used` (web sources with quotes)
- `web_search_summary`

## Frontend Display (Pipeline Detail Page)

The pipeline detail page (`/[state]/pipeline/[documentId]/[issueType]`) surfaces the following data:

### Tier 1 Section
- Classification and confidence
- Reasoning
- Relevant vs dismissed match counts
- **Argument Framing**: Full display of all three best arguments (burdensome, justified, unrelated)
- Context requests (expandable)
- Routing decision

### Tier 2 Section
- Classification and confidence
- Reasoning
- Steelman arguments (for/against regulation) - side by side
- Severity with calculation breakdown
- **Verbatim Requirements** - yellow highlighted box with exact quotes
- **Context Used** - grouped by type (definitions, cross-refs, statutes, web) with quotes and relevance
- Routing flags (federal statute cited, claims no alternative, etc.)
- **Web Search Topics** - if Tier 2 suggested topics for Tier 3
- Context requests made during re-runs (expandable)
- Routing decision

### Tier 3 Section
- Classification and confidence
- Reasoning
- Web search summary
- Federal mandate / state discretion badges
- Severity adjustment with reasoning
- **Structured Flags** - expandable badges showing:
  - `superseded_by_law`
  - `federal_mandate_confirmed`
  - `state_discretion_found`
  - `modernized_alternative_found`
  - Each flag shows evidence with **clickable URLs**, quotes, and relevance

### Data Flow Notes
- URLs in Tier 3 flags may be stored in `identifier` or `url` field (frontend handles both)
- Web evidence is stored in `tier3_flags.*.evidence[]` with source URLs

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Full technical specification
- [CONTEXT_STRATEGY.md](./CONTEXT_STRATEGY.md) - Proactive context gathering details
- [DATA_MODELS.md](./DATA_MODELS.md) - Pydantic model specifications
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - What's implemented vs planned
- [MATCH_GROUPING.md](./MATCH_GROUPING.md) - Match grouping strategy (unchanged from V4)

## V4 Documentation (Archived)

Previous 4-tier architecture documentation is archived in:
`./archive/v4-progressive-disclosure/`
