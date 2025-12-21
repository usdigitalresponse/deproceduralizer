# Annotation-Based Extraction Approach

This document explores a unified annotation approach for extracting multiple types of structured data from regulation sections in a single LLM pass.

## Motivation

Instead of running separate extraction passes for definitions, compliance issues, and cross-references, we can extract all annotations in a single pass. This:

- Reduces cost (read each document once)
- Preserves context (see how annotations relate to each other)
- Enables rich frontend rendering (highlight different annotation types)

## Approach: Quote-Based Annotations

The LLM returns **exact quotes** from the source text, and we compute character offsets programmatically.

### Why Not Offsets?

LLMs are unreliable at counting characters - they will hallucinate offsets. Quote-based matching is more reliable because:
- LLMs are better at copying text than counting
- We can fuzzy-match if quotes have minor variations
- Deterministic post-processing handles the offset math

### Output Schema

```json
{
  "definitions": [
    {
      "term": "GVWR",
      "quote": "GVWR means the value specified by the manufacturer as the maximum loaded weight of a single vehicle",
      "scope": "part",
      "type": "formal"
    }
  ],
  "requirements": [
    {
      "type": "in_person",
      "quote": "applicant must appear in person at the district office",
      "context": "Application submission requirement"
    },
    {
      "type": "wet_signature",
      "quote": "bearing the original signature of the owner",
      "context": "Form authentication requirement"
    }
  ],
  "references": [
    {
      "cite": "section 720.2",
      "quote": "office designated in section 720.2",
      "ref_type": "internal"
    },
    {
      "cite": "42 CFR 435.116",
      "quote": "in accordance with 42 CFR 435.116",
      "ref_type": "federal_cfr"
    }
  ]
}
```

### Post-Processing Pipeline

```python
def locate_annotations(content: str, annotations: dict) -> dict:
    """
    Find exact positions of quoted text in source content.
    """
    for annotation_type, items in annotations.items():
        for item in items:
            quote = item.get("quote", "")
            if not quote:
                continue

            # Try exact match first
            start = content.find(quote)

            if start != -1:
                item["start"] = start
                item["end"] = start + len(quote)
                item["match_type"] = "exact"
            else:
                # Fuzzy match fallback
                start, end, similarity = fuzzy_find(content, quote)
                if similarity >= 0.85:
                    item["start"] = start
                    item["end"] = end
                    item["match_type"] = "fuzzy"
                    item["match_similarity"] = similarity
                else:
                    item["match_type"] = "not_found"
                    item["match_similarity"] = similarity

    return annotations
```

## Concern: Quote Hallucination

Even with quote-based extraction, the LLM may:

1. **Minor variations**: Change punctuation, whitespace, or small words
2. **Paraphrasing**: Reword slightly instead of copying verbatim
3. **Truncation**: Return partial quotes
4. **Fabrication**: Invent text that doesn't exist

### Mitigation Strategies

| Strategy | Description |
|----------|-------------|
| **Fuzzy matching** | Use similarity threshold (0.85+) to handle minor variations |
| **Prompt engineering** | Emphasize VERBATIM copying in prompt |
| **Validation** | Flag annotations with match_type != "exact" for review |
| **Confidence scoring** | Track match rates per extraction type |

### Prompt Guidance

```
CRITICAL: Return EXACT quotes from the regulation text.
- Copy text VERBATIM - do not paraphrase or summarize
- Include enough context to uniquely identify the quote (usually 5-15 words)
- If you cannot find an exact quote, do not include the annotation
```

## Cost Comparison

For 7,806 pattern-matched NY sections:

| Approach | Input Cost | Output Cost | Total |
|----------|------------|-------------|-------|
| 3 separate passes | $31 | $26 | ~$57 |
| 1 pass, inline XML | $10 | $52 | ~$63 |
| **1 pass, quote-based JSON** | **$10** | **$17** | **~$28** |

## Pilot Test Plan

Before running on all 7,806 sections, test on a small sample to measure:

### Phase 1: Micro Test (10 sections)

**Goal**: Validate prompt and output schema

1. Select 10 diverse sections:
   - 3 with "Definitions" in title
   - 3 with compliance patterns (in-person, paper, etc.)
   - 2 with cross-references
   - 2 with mixed content

2. Run extraction manually (single API calls)

3. Measure:
   - Exact match rate
   - Fuzzy match rate (>0.85 similarity)
   - Not found rate
   - Obvious hallucinations

**Success criteria**: >80% exact match, <5% not found

### Phase 2: Small Batch (100 sections)

**Goal**: Validate at scale, measure cost

1. Randomly sample 100 sections from pattern-matched set
2. Run batch extraction
3. Measure same metrics + cost per section
4. Manual review of 20 random annotations

**Success criteria**: >75% exact match, cost within estimate

### Phase 3: Full Extraction (7,806 sections)

**Goal**: Production run

1. Run full batch via Anthropic Batch API
2. Post-process with fuzzy matching
3. Store in `document_annotations` table
4. Flag low-confidence matches for review

## Storage Schema

```sql
CREATE TABLE document_annotations (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,

  -- Raw LLM output
  raw_annotations JSONB NOT NULL,

  -- Processed annotations with computed offsets
  processed_annotations JSONB,

  -- Quality metrics
  total_annotations INTEGER DEFAULT 0,
  exact_match_count INTEGER DEFAULT 0,
  fuzzy_match_count INTEGER DEFAULT 0,
  not_found_count INTEGER DEFAULT 0,

  -- Metadata
  model_version VARCHAR(100),
  extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_status VARCHAR(50) DEFAULT 'pending'  -- pending, processed, failed
);

CREATE INDEX idx_doc_annotations_document ON document_annotations(document_id);
CREATE INDEX idx_doc_annotations_status ON document_annotations(processing_status);
```

## Annotation Types

### Definitions

| Field | Type | Description |
|-------|------|-------------|
| term | string | The term being defined |
| quote | string | Verbatim text containing the definition |
| scope | string | section, part, chapter, title |
| type | string | formal, abbreviation |

### Requirements (Compliance Issues)

| Field | Type | Description |
|-------|------|-------------|
| type | string | in_person, wet_signature, paper_form, mailing, notarization |
| quote | string | Verbatim text describing the requirement |
| context | string | Brief description of what this requirement is for |

### References

| Field | Type | Description |
|-------|------|-------------|
| cite | string | The citation (e.g., "section 720.2", "42 CFR 435") |
| quote | string | Verbatim text containing the reference |
| ref_type | string | internal, federal_cfr, federal_usc, state_statute, compact, form |

## Frontend Rendering

Store original content in `regulatory_documents.content`, annotations in `document_annotations.processed_annotations`.

Render with overlapping highlights:

```typescript
interface Annotation {
  start: number;
  end: number;
  type: 'definition' | 'requirement' | 'reference';
  subtype?: string;
  data: Record<string, unknown>;
}

function renderAnnotatedContent(content: string, annotations: Annotation[]) {
  // Sort by start position
  // Handle overlapping spans
  // Apply CSS classes for each type:
  //   - definition: blue underline
  //   - requirement: red/orange highlight
  //   - reference: green link
}
```

## Open Questions

1. **Overlapping annotations**: How to handle when a quote contains multiple annotation types?
2. **Long quotes**: Should we limit quote length to avoid truncation issues?
3. **Versioning**: How to handle re-extraction when prompts improve?
4. **Incremental updates**: Can we extract annotations for new sections without re-running everything?

## Next Steps

1. [ ] Draft the full extraction prompt
2. [ ] Implement fuzzy matching function
3. [ ] Select 10 pilot sections
4. [ ] Run micro test and measure match rates
5. [ ] Iterate on prompt based on results
6. [ ] Proceed to small batch test
