# Caching Strategy

> **Status: CURRENT**
> 4-layer caching approach for cost optimization.

## Overview

Anthropic's prompt caching works on **PREFIXES** - cached content must be at the TOP of messages, with `cache_control: {"type": "ephemeral"}` marking where the cache ends.

**Key constraint:** Only prefix content can be cached. Content order matters.

## 4-Layer Cache Structure

**How `cache_control` works:** The `cache_control: {"type": "ephemeral"}` marker indicates where the cacheable prefix ENDS. Everything BEFORE the marker is cached together as a single prefix.

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: Issue-Type Framework                                   │
│ Same for ALL documents of this issue type                       │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│ LAYER 2: Tier-Specific Procedure                   ◄── CACHED  │
│ Same for ALL documents in this tier                 TOGETHER   │
│ Combined cache key: (issue_type, tier)                          │
│ Cache hit rate: 100% within (issue_type, tier) batch            │
├──────────────────────────── cache_control {"type": "ephemeral"} ┤
│ LAYER 3: Subchapter Definitions (OPTIONAL SECOND CACHE)         │
│ Same for all sections in same subchapter                        │
│ Cache key: (issue_type, tier, subchapter_id)                    │
│ Cache hit rate: varies (avg ~10 sections/subchapter)            │
├──────────────────────────── cache_control {"type": "ephemeral"} ┤
│ LAYER 4: Document-Specific Content (DYNAMIC)                    │
│ Different for every document                                    │
│ Not cached                                                      │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** Layer 1 and Layer 2 are cached together as a single prefix. The `cache_control` marker on Layer 2 tells Anthropic "cache everything up to this point."

## Message Structure for Maximum Cache Hits

```python
messages = [
    {
        "role": "system",
        "content": [
            # === LAYER 1: Issue-Type Framework ===
            # (Cached together with Layer 2 as a single prefix)
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
- UNRELATED: The matched text does not actually represent this issue type
- JUSTIFIED: The requirement exists but is mandated by statute or clearly necessary
- BURDENSOME: The requirement exists and creates unnecessary burden

## Severity Scoring
Baseline: {severity_baseline}
Modifiers: {severity_modifiers}

## Issue-Specific Examples
{issue_examples}
"""
            },
            # === LAYER 2: Tier-Specific Framework ===
            # (Cache ends here - Layer 1+2 are cached together)
            {
                "type": "text",
                "text": """
# Tier 2: Summary-Based Research Procedure

## 12-Step Analysis Process
1. Read the full section content carefully
2. Check inherited definitions for relevant terms
3. Review sibling section summaries for context
4. Check cross-reference summaries for related requirements
5. Identify the specific requirement language
6. Determine if requirement is mandatory or optional
7. Check for electronic/alternative options mentioned
8. Look for statute citations that might justify
9. Consider if requirement serves legitimate purpose
10. Assess impact on regulated parties
11. Calculate severity using baseline + modifiers
12. Extract verbatim requirement text

## Output Requirements
Return structured JSON with:
- classification
- confidence (0.0-1.0)
- reasoning
- severity (if burdensome)
- verbatim_requirements
- context_requests (if need full text)
""",
                "cache_control": {"type": "ephemeral"}  # <-- CACHE BREAKPOINT: Layer 1+2 cached as prefix
            }
        ]
    },
    {
        "role": "user",
        "content": [
            # === LAYER 3: Subchapter Definitions (SEMI-CACHED) ===
            {
                "type": "text",
                "text": f"""
# Inherited Definitions (Scope: {subchapter_citation})
{definitions_text}
""",
                "cache_control": {"type": "ephemeral"}  # Cache if batching by subchapter
            },
            # === LAYER 4: Document-Specific Content (DYNAMIC) ===
            {
                "type": "text",
                "text": f"""
# Document Under Analysis
Citation: {citation}
Title: {title}

## Full Content
{content}

## Matches to Evaluate
{match_list}

## Context Catalog
{context_catalog}

## Requested Context (from Tier 1)
{requested_context}
"""
            }
        ]
    }
]
```

## Batching Strategy

### Primary Batch Key: issue_type

```python
# Group all documents by issue type first
batches = defaultdict(list)
for item in items:
    batches[item.issue_type].append(item)

# Process each issue type as a batch
for issue_type, issue_items in batches.items():
    # All items in this batch share Layer 1+2 (issue framework + tier procedure)
    process_batch(issue_type, issue_items)
```

### Secondary Batch Key: subchapter_id

```python
# Within an issue_type batch, group by subchapter
def process_batch(issue_type, items):
    subchapter_groups = defaultdict(list)
    for item in items:
        subchapter_groups[item.subchapter_id].append(item)

    # Process each subchapter group
    for subchapter_id, subchapter_items in subchapter_groups.items():
        # All items in this group share definitions
        process_subchapter_batch(issue_type, subchapter_id, subchapter_items)
```

### Optimal Sort Order

```python
# Sort for maximum cache reuse
items.sort(key=lambda x: (x.issue_type, x.subchapter_id, x.document_id))
```

## Tier 3 and Tier 4 Caching

### Tier 3 (Full Context Deep Dive)

Challenge: Tier 3 pulls in full text of specific cross-refs and siblings, which varies per document.

**Caching opportunities:**

1. **Popular cross-references**: Documents referenced 50+ times across corpus
   ```python
   POPULAR_CROSSREFS = {
       "N.J.A.C. 7:13-6.7": get_full_content(...),  # 100 references
       "N.J.A.C. 7:26-3.2": get_full_content(...),  # 96 references
       # ... pre-cache top 50
   }
   ```

2. **Batch docs that share cross-refs:**
   ```python
   # If 10 docs in a batch all request N.J.A.C. 7:13-6.7
   shared_crossrefs = find_shared_requested_crossrefs(batch_items)
   # Include in shared prefix for those docs
   ```

### Tier 4 (Web Search)

- Real-time API (not batch), so caching less critical
- Issue framework can still be cached if processing multiple Tier 4 items sequentially
- Web search results are inherently dynamic and not cached

## Cache Sizing Rules

- **Minimum tokens for cache:** 1,024 (Sonnet), 4,096 (Haiku)
- Layer 1+2 combined should exceed minimum threshold
- If issue description is short, pad with detailed indicators and examples

```python
def ensure_cache_minimum(system_prompt, min_tokens=1024):
    tokens = count_tokens(system_prompt)
    if tokens < min_tokens:
        # Add more detailed examples or indicators
        system_prompt += "\n\n" + get_extended_examples(issue_type)
    return system_prompt
```

## Cost Impact

| Scenario | Multiplier |
|----------|------------|
| Cache write | 1.25x base price |
| Cache read | 0.1x base price |
| TTL | 5 minutes (refreshes on each hit) |

### Example Calculation

For 1000 documents, same issue type:

```
Without caching:
- System prompt (4000 tokens) × 1000 = 4M tokens × $3/M = $12

With caching:
- First request: 4000 tokens × 1.25x = 5000 effective tokens
- Remaining 999: 4000 tokens × 0.1x = 400 effective tokens each
- Total: 5000 + (999 × 400) = 404,600 effective tokens
- Cost: 404,600 × $3/M = $1.21

Savings: 90%
```

### Realistic Estimate (with dynamic content)

```
Cached layers (4000 tokens): 0.1x = 400 effective tokens
Dynamic layers (6000 tokens): 1.0x = 6000 effective tokens
Total per doc: 6400 effective tokens (vs 10000 without caching)

Savings: 36% on input tokens
```

## Issue-Specific Examples in Prompts (Few-Shot)

Each issue type should include concrete examples with JSON outputs:

```yaml
mail_only:
  prompt:
    system: |
      # Positive Indicators (likely burdensome)
      - "shall submit by mail"
      - "must be mailed to the Department"

      # Negative Indicators (likely NOT burdensome)
      - "may submit by mail OR electronically"
      - "mail or hand-deliver"

      ## Example 1: BURDENSOME
      Input: "Applications shall be submitted by mail to the Division office."

      Output:
      ```json
      {
        "classification": "burdensome",
        "confidence": 0.95,
        "reasoning": "Mandatory mail submission with no electronic alternative.",
        "verbatim_requirements": ["Applications shall be submitted by mail"],
        "severity": 5,
        "severity_calculation": "Base 4 + 1 (no alternative) = 5"
      }
      ```

      ## Example 2: NOT BURDENSOME
      Input: "Applications may be submitted by mail or through the online portal."

      Output:
      ```json
      {
        "classification": "unrelated",
        "confidence": 0.92,
        "reasoning": "Electronic alternative explicitly provided.",
        "verbatim_requirements": []
      }
      ```

      ## Example 3: JUSTIFIED
      Input: "Original documents must be mailed as required by N.J.S.A. 52:7-1."

      Output:
      ```json
      {
        "classification": "justified",
        "confidence": 0.85,
        "reasoning": "Mail requirement mandated by state statute.",
        "verbatim_requirements": ["Original documents must be mailed"],
        "severity": 3,
        "severity_calculation": "Base 4 - 1 (statutory) = 3"
      }
      ```
```

## Implementation Checklist

- [ ] Structure prompts with cached layers at top
- [ ] Add `cache_control: {"type": "ephemeral"}` at layer boundaries
- [ ] Sort items by (issue_type, subchapter_id) before processing
- [ ] Pre-cache popular cross-references (50+ uses)
- [ ] Ensure system prompt exceeds minimum token threshold
- [ ] Include few-shot examples with JSON outputs in each issue type
