# Autonomous Compliance Issue Detection Improvement Loop

You are running an autonomous improvement loop for regulatory compliance issue detection. Your task is to systematically evaluate and improve detection patterns for 41 issue types by testing them against real database examples.

## Your Mission

For EACH issue type, you will:
1. Load the current regex patterns and prompt configuration
2. Query the database for 5-6 random examples matching those patterns
3. Apply the full Tier 2 research procedure to each example
4. Determine the true positive rate for that batch
5. If the rate is low (<70%), explore alternative strategies
6. Document your findings before moving to the next issue type

## State Tracking

Use this file to track progress: `docs/compliance_issue_experiments/IMPROVEMENT_REPORT.md`

Update after each issue type:
- **Completed**: [list issue types completed]
- **Current**: [issue type in progress]
- **Remaining**: [issue types not yet started]
- **Session findings**: [key learnings so far]

## Issue Type Priority Order (lowest precision first)

1. pdf_only (1.5%)
2. fax (8.9%)
3. typewriter (11.8%)
4. in_person_submission (22.2%)
5. witness (30.5%)
6. storage_location (33.5%)
7. mail_only (35.7%)
8. ... remaining types in order of increasing precision from README.md

---

## For Each Issue Type - Execution Steps

### Step 1: Load Configuration

Read the issue type's configuration:
```
docs/compliance_issue_experiments/working-prompts/[issue_type].yaml
```

Extract:
- `patterns`: The regex patterns used for initial detection
- `prompt.system`: The LLM system prompt
- `prompt.template`: The user prompt template
- `description`: What this issue type captures

### Step 2: Find Random Examples

Use `/database` skill to query 5-6 random documents matching patterns:

```sql
WITH pattern_matches AS (
    SELECT
        rd.id,
        rd.title,
        rd.content,
        rd.citation,
        rd.url,
        rd.hierarchy_level,
        rd.parent_id,
        rd.state,
        rd.summary
    FROM regulatory_documents rd
    WHERE rd.content IS NOT NULL
      AND rd.state IN ('NJ', 'NY')
      AND (rd.exclude_from_analysis = FALSE OR rd.exclude_from_analysis IS NULL)
      AND (
          rd.content ~* 'PATTERN_1'
          OR rd.content ~* 'PATTERN_2'
          -- Add all patterns from the YAML
      )
    ORDER BY RANDOM()
    LIMIT 6
)
SELECT * FROM pattern_matches;
```

### Step 3: Gather Full Context (Tier 2 Research)

For EACH example, gather:

**A. Ancestor Chain:**
```sql
WITH RECURSIVE ancestors AS (
    SELECT id, title, hierarchy_level, citation, short_title, parent_id, summary, 1 as depth
    FROM regulatory_documents WHERE id = [DOC_ID]
    UNION ALL
    SELECT rd.id, rd.title, rd.hierarchy_level, rd.citation, rd.short_title, rd.parent_id, rd.summary, a.depth + 1
    FROM regulatory_documents rd
    JOIN ancestors a ON rd.id = a.parent_id
)
SELECT * FROM ancestors ORDER BY depth DESC;
```

**B. Sibling Sections:**
```sql
SELECT id, title, citation, short_title, summary, section_type
FROM regulatory_documents
WHERE parent_id = [PARENT_ID] AND id != [DOC_ID]
ORDER BY citation;
```

**C. Inherited Definitions:**
```sql
SELECT d.term, d.verbatim_text, d.rephrased_definition, d.scope_level, rd.citation as scope_citation
FROM definitions d
JOIN regulatory_documents rd ON d.scope_document_id = rd.id
WHERE d.scope_document_id IN ([ANCESTOR_IDS])
ORDER BY d.scope_level DESC;
```

**D. Cross-References (both directions):**
```sql
-- Outgoing references FROM this document
SELECT cr.raw_text, cr.normalized_citation, t.title as target_title, t.summary as target_summary
FROM cross_references cr
LEFT JOIN regulatory_documents t ON cr.target_document_id = t.id
WHERE cr.source_document_id = [DOC_ID];

-- Incoming references TO this document
SELECT cr.raw_text, s.citation as source_citation, s.title as source_title
FROM cross_references cr
JOIN regulatory_documents s ON cr.source_document_id = s.id
WHERE cr.target_document_id = [DOC_ID];
```

**E. Statute References:**
```sql
SELECT usc_citations, cfr_citations, public_laws, acts, state_title, state_section
FROM statute_references
WHERE document_id = [DOC_ID];
```

### Step 4: Apply Research Procedure

For EACH example, analyze using this structure:

```markdown
## RESEARCH ANALYSIS FOR: [CITATION]

### 1. What is this document ACTUALLY about?
[Read the full content, not just the matched snippet. Summarize the purpose.]

### 2. Who is affected?
[Identify: vulnerable populations, professionals, businesses, government agencies]

### 3. Are there mitigating words?
[Look for: "may", "unless", "or", "alternative", "if desired", "at the option of"]

### 4. Context from ancestor chain:
[What does the chapter/subchapter context tell us about purpose?]

### 5. Sibling analysis:
- Waiver sections found? [Yes/No - details]
- Exemption sections found? [Yes/No - details]
- Alternative procedures mentioned? [Yes/No - details]

### 6. Definition implications:
[Do any defined terms change the interpretation?]

### 7. Cross-reference insights:
[Do references reveal alternatives or related requirements?]

### 8. Federal mandate check:
[Are there USC/CFR citations suggesting federal requirement?]

### 9. CLASSIFICATION:
[ ] UNRELATED - The flag is clearly a false positive because: [reason]
[ ] JUSTIFIED - IS a burden, but has legitimate justification: [reason]
[ ] BURDENSOME - Real burden without adequate justification

### 10. If BURDENSOME, severity calculation:
Baseline: [X] for [issue_type]
+ [modifier] for [reason]
- [modifier] for [reason]
= Final severity: [1-10]

### 11. Why did the regex match but this isn't a true positive? (if applicable)
[Pattern improvement suggestion]
```

### Step 5: Calculate True Positive Rate

After analyzing all 5-6 examples:

```markdown
## BATCH RESULTS FOR: [issue_type]

| # | Citation | Classification | Confidence | Notes |
|---|----------|----------------|------------|-------|
| 1 | [citation] | [classification] | [0.0-1.0] | [brief note] |
| 2 | ... | ... | ... | ... |

**True Positive Rate**: X/6 = XX%
(True Positives = BURDENSOME classifications)

**Interpretation**:
- If TPR >= 70%: Patterns are working well
- If TPR 40-70%: Room for improvement
- If TPR < 40%: Significant issues - explore alternatives
```

### Step 6: Pattern Improvement Analysis (if TPR < 70%)

```markdown
## FALSE POSITIVE ANALYSIS FOR: [issue_type]

### Common False Positive Patterns:

1. **[Pattern type 1]**: [Description]
   - Examples: [citations]
   - Why regex matched: [explanation]
   - Suggested fix: [regex modification or exclusion pattern]

### Regex Improvement Recommendations:

**Current patterns:**
- `pattern_1`
- `pattern_2`

**Proposed modifications:**
1. Change `pattern_1` to `new_pattern_1` because [reason]
2. Add exclusion for `exclusion_pattern` because [reason]
3. Add new pattern `new_pattern` to catch [scenario]

### Prompt Improvement Recommendations:

**Current system prompt issues:**
- [Issue 1]

**Proposed prompt additions:**
- Add to positive indicators: "[new indicator]"
- Add to negative indicators: "[new indicator]"
- Clarify: "[clarification]"
```

### Step 7: Document Findings

Append findings to: `docs/compliance_issue_experiments/IMPROVEMENT_REPORT.md`

```markdown
---

## [issue_type] - [timestamp]

### Configuration
- Display name: [display_name]
- Category: [category]
- Patterns tested: [count]

### Results
- Sample size: 6
- True positives: X
- False positives: Y
- True positive rate: XX%

### Key Findings
1. [Finding 1]
2. [Finding 2]
3. [Finding 3]

### Recommended Changes
#### Regex:
- [Change 1]

#### Prompt:
- [Change 1]

### Sample Evidence
**True Positive Example:**
- Citation: [citation]
- Quote: "[quote]"
- Why burdensome: [reason]

**False Positive Example:**
- Citation: [citation]
- Quote: "[quote]"
- Why NOT burdensome: [reason]

---
```

### Step 8: Move to Next Issue Type

Update the state tracking section and proceed to the next issue type.

---

## Completion Criteria

The loop is complete when:
1. All 41 issue types have been analyzed
2. Each has at least one 5-6 example batch evaluated
3. Findings documented in IMPROVEMENT_REPORT.md
4. Summary statistics compiled

## Final Report Structure

At completion, generate:

```markdown
# Compliance Issue Detection Improvement - Final Report

## Executive Summary
- Total issue types analyzed: 41
- Average true positive rate: XX%
- Issue types needing urgent improvement: [list]
- Issue types performing well: [list]

## Issue Types by Performance

### High Performers (>80% TPR)
| Issue Type | TPR | Sample Size | Notes |

### Moderate Performers (50-80% TPR)
| Issue Type | TPR | Sample Size | Notes |

### Low Performers (<50% TPR)
| Issue Type | TPR | Sample Size | Notes |

## Recommended Priority Changes

### Urgent (implement now)
1. [Issue type]: [specific change]

### Important (implement soon)
1. ...

## Cross-Cutting Learnings
1. [Pattern across multiple issue types]

## Next Steps
1. Implement top-priority regex changes
2. Update prompts in prompts/compliance_issues.yaml
3. Re-run analysis on modified issue types
```

---

## Important Guidelines

1. **Be thorough**: Don't skip steps even if an example seems obvious
2. **Quote verbatim**: Use exact quotes from regulations as evidence
3. **Track state**: Always update progress tracking before switching issue types
4. **Document learnings**: Even negative results are valuable
5. **Stay objective**: Steelman both sides before classifying
6. **Use the /database skill**: For all SQL queries
7. **Save frequently**: Write findings to the report after each issue type

---

## START NOW

Begin with: `pdf_only` (1.5% precision - most urgent improvement needed)

1. Read `docs/compliance_issue_experiments/working-prompts/pdf_only.yaml`
2. Extract the regex patterns
3. Query the database for 6 random matching documents
4. Begin the Tier 2 research procedure on each
