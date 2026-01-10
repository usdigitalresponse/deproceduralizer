# Research Pipeline: Progressive Context Disclosure

> **Status: CURRENT**
> This is the active architecture for the research pipeline.

## Quick Reference

**Processing Unit:** `(document_id, issue_type, [all regex matches])`

**Key Innovation:** Context is revealed progressively - the LLM requests what it needs, we only fetch what's requested.

## Architecture Diagram

```
                           ┌─────────────────────────┐
                           │    Regex Detection      │
                           │  (existing searcher)    │
                           └───────────┬─────────────┘
                                       │
                                       │ Groups matches by (doc_id, issue_type)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TIER 1: MATCH FILTERING                                                    │
│                                                                             │
│  Sees: Document metadata + match snippets + CONTEXT CATALOG                 │
│        (sibling titles, cross-ref citations, definition terms - NO content) │
│                                                                             │
│  Outputs:                                                                   │
│    • Which matches are relevant (filters false positives)                   │
│    • Classification: all_false_positives | needs_research                   │
│    • Context requests: "I need sibling X summary, cross-ref Y summary"      │
│                                                                             │
│  Cost: ~1,500 tokens/doc                                                    │
└───────────────────────────────────────────────────────────────────────────┬─┘
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
            all_false_positives                  needs_research
            (DONE - $0)                                 │
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TIER 2: SUMMARY-BASED RESEARCH                                             │
│                                                                             │
│  Sees: Full document content + definitions + SUMMARIES of requested items   │
│        (sibling summaries, cross-ref summaries - only what Tier 1 asked for)│
│                                                                             │
│  Outputs:                                                                   │
│    • Classification: unrelated | justified | burdensome | needs_full_context│
│    • Severity (1-10) with calculation                                       │
│    • verbatim_requirements: ["quote 1", "quote 2"]                          │
│    • Context requests: "I need full text of cross-ref Z"                    │
│    • ambiguity_type: internal | external | both (for routing)               │
│    • Escalation flags: potentially_controversial, federal_mandate_suspected │
│                                                                             │
│  Cost: ~4,000 tokens/doc                                                    │
└───────────────────────────────────────────────────────────────────────────┬─┘
                                       │
     ┌──────────────────┬──────────────┼────────────────┬──────────────────┐
     ▼                  ▼              ▼                ▼                  ▼
  unrelated      justified/      needs_full_context  needs_full_context  needs_full_context
  (DONE)         burdensome      + ambiguity_type    + ambiguity_type    + ambiguity_type
                 (check sev)     = "internal"        = "external"        = "both"
                      │              │                    │                  │
                      │              ▼                    │                  ▼
                      │         TIER 3 ◄─────────────────┘             TIER 3 ───► TIER 4
                      │              │
                      │              │  (skip Tier 3 for "external")
     ┌────────────────┴──────────────┴───────────────────────────┐
     ▼                                                           ▼
 sev < 5 (DONE)                                            sev >= 5 ───► TIER 4

┌─────────────────────────────────────────────────────────────────────────────┐
│  TIER 3: FULL CONTEXT DEEP DIVE                                             │
│                                                                             │
│  Sees: Everything from Tier 2 + FULL TEXT of specifically requested items  │
│        (full cross-ref content, full sibling content)                       │
│                                                                             │
│  Outputs:                                                                   │
│    • Final classification                                                   │
│    • Final severity with detailed calculation                               │
│    • verbatim_requirements with evidence                                    │
│    • needs_web_search: bool                                                 │
│                                                                             │
│  Cost: ~10,000 tokens/doc (but selective - only ~20% of Tier 2)             │
└───────────────────────────────────────────────────────────────────────────┬─┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           ▼                           ▼                           ▼
    No escalation trigger    Escalation trigger met       justified + controversial
    (DONE)                           │                             │
                                     └─────────────┬───────────────┘
                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TIER 4: WEB SEARCH VALIDATION                                              │
│                                                                             │
│  Sees: Tier 3 analysis + web search results                                 │
│        (federal mandates, industry standards, other states)                 │
│                                                                             │
│  Outputs:                                                                   │
│    • Classification: burdensome | justified | unrelated                     │
│    • Severity adjustment (-3 to +3)                                         │
│    • External evidence citations (web sources)                              │
│                                                                             │
│  Cost: ~5,000 tokens/doc + web search (real-time API, ~20% of Tier 3)       │
└─────────────────────────────────────────────────────────────────────────────┘

## Escalation Trigger Rules (Tier 3/4)

```
needs_web_search = true when ANY of:
  • severity >= 5 AND uncertain about federal mandate
  • confidence < 0.7 despite full context
  • classification == 'justified' AND potentially_controversial == true
  • federal_mandate_suspected == true
  • Statute reference with unclear state discretion
```

**IMPORTANT**: JUSTIFIED items with `potentially_controversial=true` MUST escalate.
This prevents the "Justified Trap" where items exit the pipeline without
external validation of whether the justification is actually adequate.

## Cost Comparison

| Tier | Purpose | Docs | Cost/Doc | Total |
|------|---------|------|----------|-------|
| 1 | Match Filtering | 8,534 | ~$0.002 | ~$17 |
| 2 | Summary Research | 5,974 (70%) | ~$0.006 | ~$36 |
| 3 | Full Context | 1,195 (20%) | ~$0.015 | ~$18 |
| 4 | Web Validation | 239 (20%) | ~$0.025 | ~$6 |
| **Total** | | | | **~$77** |

**With caching (40% savings):** ~$47
**Compared to old approach:** ~$120 (62% savings)

## Key Benefits

1. **Cost Efficiency**: Only fetch context that's actually needed
2. **Better Signal**: LLM identifies what's relevant, not guesswork
3. **Match Grouping**: 19% fewer API calls by evaluating all matches for a doc together
4. **Caching**: Layered caching strategy for 40-60% additional savings
5. **Auditability**: Each tier's reasoning and requests are logged

## Related Documents

- [RESEARCH_PIPELINE_DESIGN.md](./RESEARCH_PIPELINE_DESIGN.md) - Full architecture details
- [CONTEXT_DISCLOSURE.md](./CONTEXT_DISCLOSURE.md) - How progressive disclosure works
- [CACHING_STRATEGY.md](./CACHING_STRATEGY.md) - 4-layer caching approach
- [MATCH_GROUPING.md](./MATCH_GROUPING.md) - Document-level analysis
- [RESEARCH_PIPELINE_MODELS.md](./RESEARCH_PIPELINE_MODELS.md) - Pydantic schemas
- [RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md](./RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md) - Database schema
