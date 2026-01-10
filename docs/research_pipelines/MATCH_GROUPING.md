# Match Grouping: Document-Level Analysis

> **Status: CURRENT (V5)**
> How we group regex matches and analyze at document level.
> Updated for V5 3-tier architecture.

## The Problem

The regex searcher finds multiple matches per document. For example:

```
Document: N.J.A.C. 13:69D-1.34
Issue Type: in_person_appearance

Regex Matches (6 total):
1. "appear in person" at position 234
2. "personal appearance" at position 567
3. "person responsible" at position 891     ← false positive
4. "submit in person" at position 1102
5. "in-person verification" at position 1445
6. "person or entity" at position 1823      ← false positive
```

**Old approach:** Each match processed separately → 6 API calls, redundant context fetching

**New approach:** Group by (document_id, issue_type) → 1 API call, document-level analysis

## Processing Unit

```python
ProcessingUnit = (document_id, issue_type, [all_matches])

# Example
unit = ProcessingUnit(
    document_id=129178,
    issue_type="in_person_appearance",
    matches=[
        Match(id=1, text="appear in person", position=234),
        Match(id=2, text="personal appearance", position=567),
        Match(id=3, text="person responsible", position=891),
        Match(id=4, text="submit in person", position=1102),
        Match(id=5, text="in-person verification", position=1445),
        Match(id=6, text="person or entity", position=1823),
    ]
)
```

## Tier 1: Match Filtering

Tier 1's job is to identify which matches are relevant:

**Input:**
```
## Matches to Evaluate

1. "appear in person" (position 234)
   Context: "...the applicant must appear in person at the Division..."

2. "personal appearance" (position 567)
   Context: "...personal appearance is required for identity verification..."

3. "person responsible" (position 891)
   Context: "...the person responsible for the facility shall maintain..."

4. "submit in person" (position 1102)
   Context: "...all documents must be submit in person during the..."

5. "in-person verification" (position 1445)
   Context: "...in-person verification of credentials is mandatory..."

6. "person or entity" (position 1823)
   Context: "...any person or entity seeking a license must..."
```

**Output (V5):**
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
  "best_argument_burdensome": "Requires applicants to physically appear at Division office...",
  "best_argument_justified": "Identity verification may require in-person for fraud prevention...",
  "best_argument_unrelated": "References may be about responsible parties, not presence...",
  "context_requests": [
    {"context_type": "sibling", "identifier": "N.J.A.C. 13:69D-1.35", "need_level": "full_text", "reason": "May contain waivers"},
    {"context_type": "definition", "identifier": "applicant", "need_level": "summary", "reason": "Clarify scope"}
  ]
}
```

**Key V5 changes:** Tier 1 now outputs argument framing and structured context_requests. The system fetches these items (summary or full_text as specified) and injects them into Tier 2's prompt.

## Tier 2: Document-Level Analysis

After Tier 1 filters, Tier 2 analyzes the **document as a whole** for this issue type, using the argument framing from Tier 1 to consider multiple perspectives.

**Key insight:** We don't evaluate each match separately. We evaluate:
- Does this document have burdensome in-person requirements?
- What is the severity?
- What are the actual requirement texts (verbatim)?

**Output is document-level (V5):**
```json
{
  "classification": "burdensome",
  "confidence": 0.92,
  "reasoning": "This section contains two distinct in-person requirements...",
  "severity": 6,
  "severity_calculation": "Base 5 + 1 (no alternative mentioned) = 6",
  "verbatim_requirements": [
    "the applicant must appear in person at the Division office to submit the application",
    "in-person verification of credentials is mandatory before license issuance"
  ],
  "context_used": [
    {
      "type": "sibling",
      "identifier": "N.J.A.C. 13:69D-1.35",
      "quote": "Waivers may be granted for... but not for identity verification",
      "relevance": "Confirms no waiver available for in-person verification"
    }
  ],
  "rerun_count": 1,
  "context_requests_made": [
    {
      "context_type": "sibling",
      "identifier": "N.J.A.C. 13:69D-1.35",
      "need_level": "full_text",
      "reason": "Need to check if waiver section applies to in-person requirement"
    }
  ]
}
```

**Note:** 6 regex matches → 4 passed Tier 1 → **2 distinct requirements** in final output

The LLM naturally consolidates because it's analyzing the document, not individual matches.

## Why This Works

### 1. Context Efficiency (19% API call reduction)

```
Before: 10,542 individual matches = 10,542 API calls
After:  8,534 unique (document, issue_type) pairs = 8,534 API calls
```

### 2. Holistic Understanding

The LLM can see:
- Multiple mentions of the same requirement
- Relationships between requirements
- Context that spans match locations

### 3. Natural Deduplication

Instead of:
- Match 1: burdensome, severity 6
- Match 2: burdensome, severity 6 (same requirement!)
- Match 4: burdensome, severity 5
- Match 5: burdensome, severity 6 (same as Match 4!)

We get:
- Requirement 1: "appear in person to submit" - severity 6
- Requirement 2: "in-person verification" - severity 6

### 4. Better Evidence

`verbatim_requirements` extracts the actual burden language, not the regex match text.

## Database Storage

### Aggregated Analysis Table (V5)

```sql
CREATE TABLE compliance_issue_analyses (
    id SERIAL PRIMARY KEY,
    document_id BIGINT REFERENCES regulatory_documents(id),
    issue_type VARCHAR(100),

    -- Tier 1 results
    tier1_relevant_match_ids INTEGER[],  -- Which matches passed filter
    tier1_dismissed_match_ids INTEGER[],
    tier1_argument_framing JSONB,  -- V5: best_argument_* fields
    tier1_recommendations JSONB,   -- V5: context_requests [{context_type, identifier, need_level, reason}]
    tier1_completed_at TIMESTAMP,

    -- Tier 2 results (document-level)
    tier2_classification VARCHAR(50),
    tier2_confidence NUMERIC(3,2),
    tier2_severity INTEGER,
    tier2_verbatim_requirements TEXT[],
    tier2_reasoning TEXT,
    tier2_context_used JSONB,         -- V5: Sources with quotes
    tier2_rerun_count INTEGER,        -- V5: How many context request loops
    tier2_context_requests_made JSONB, -- V5: What was requested and why
    tier2_completed_at TIMESTAMP,

    -- Tier 3 results (if triggered)
    tier3_ran BOOLEAN DEFAULT FALSE,
    tier3_classification VARCHAR(50),
    tier3_severity_adjustment INTEGER,
    final_severity INTEGER,  -- Computed: tier2_severity + tier3_adjustment or tier3_override
    tier3_flags JSONB,                -- V5: EvidencedFlags
    tier3_web_search_summary TEXT,
    tier3_completed_at TIMESTAMP,

    UNIQUE(document_id, issue_type)
);
```

### Linking to Original Matches

The original `compliance_issues` table still exists with individual match records:

```sql
-- Original matches (from regex)
SELECT * FROM compliance_issues
WHERE document_id = 129178 AND issue_type = 'in_person_appearance';
-- Returns 6 rows (all matches)

-- Aggregated analysis (from pipeline)
SELECT * FROM compliance_issue_analyses
WHERE document_id = 129178 AND issue_type = 'in_person_appearance';
-- Returns 1 row (document-level analysis)

-- Link: tier1_relevant_match_ids contains the IDs of matches that were evaluated
```

## Match Grouping Query

```sql
-- Group matches by (document_id, issue_type) for pipeline processing
SELECT
    document_id,
    issue_type,
    COUNT(*) as match_count,
    ARRAY_AGG(id) as match_ids,
    ARRAY_AGG(regex_match_context) as match_contexts
FROM compliance_issues
WHERE
    -- Only unprocessed items
    NOT EXISTS (
        SELECT 1 FROM compliance_issue_analyses cia
        WHERE cia.document_id = compliance_issues.document_id
        AND cia.issue_type = compliance_issues.issue_type
    )
GROUP BY document_id, issue_type
ORDER BY document_id, issue_type;
```

## Distribution Data

From production data:

| Matches per (doc, issue_type) | Count | Percent |
|-------------------------------|-------|---------|
| 1 | 6,831 | 80.0% |
| 2 | 1,051 | 12.3% |
| 3 | 417 | 4.9% |
| 4 | 118 | 1.4% |
| 5 | 72 | 0.8% |
| 6+ | 45 | 0.5% |

Most have single matches, but 20% benefit from grouping.

## Implementation

```python
def group_matches_for_pipeline(state: str) -> list[ProcessingUnit]:
    """Group compliance issues by (document_id, issue_type)."""

    query = """
        SELECT
            ci.document_id,
            ci.issue_type,
            ARRAY_AGG(ci.id) as match_ids,
            ARRAY_AGG(ci.regex_match_context) as contexts,
            rd.citation,
            rd.content
        FROM compliance_issues ci
        JOIN regulatory_documents rd ON rd.id = ci.document_id
        WHERE ci.state = %s
            -- Exclude already-processed (document_id, issue_type) pairs
            AND NOT EXISTS (
                SELECT 1 FROM compliance_issue_analyses cia
                WHERE cia.document_id = ci.document_id
                AND cia.issue_type = ci.issue_type
            )
        GROUP BY ci.document_id, ci.issue_type, rd.citation, rd.content
        ORDER BY ci.issue_type, ci.document_id
    """

    results = execute_query(query, [state])

    return [
        ProcessingUnit(
            document_id=row.document_id,
            issue_type=row.issue_type,
            match_ids=row.match_ids,
            match_contexts=row.contexts,
            citation=row.citation,
            content=row.content,
        )
        for row in results
    ]
```
