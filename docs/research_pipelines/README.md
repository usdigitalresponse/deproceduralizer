# Research Pipeline V5

A 3-tier LLM pipeline for identifying regulatory compliance burdens, with proactive context gathering and argument framing.

## Quick Start

| File | Purpose |
|------|---------|
| [OVERVIEW.md](./OVERVIEW.md) | Architecture diagram and key innovations |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Full technical specification |
| [DATA_MODELS.md](./DATA_MODELS.md) | Pydantic model specifications |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | What's implemented vs planned |

## Pipeline Architecture

```
Pre-Tier 1 (Deterministic) → Tier 1 (Triage) → Tier 2 (Classify) → Tier 3 (External, selective)
```

### Pre-Tier 1: Context Gathering
- Keyword filter on sibling/cross-ref titles (exemption, waiver, electronic, etc.)
- Fetch summaries for matches (max 20)
- Pass full catalogs to Tier 1

### Tier 1: Triage + Argument Framing
- Filter false positive matches
- Generate argument framing (best case for burdensome/justified/unrelated)
- Recommend context for Tier 2

### Tier 2: Full Classification
- Full document + definitions + Tier 1 framing
- Can request additional context (re-run if needed)
- Output: classification, severity, verbatim requirements

### Tier 3: External Verification (Selective)
- Triggers: specific issue types, federal citations, high severity
- Web search validation
- Structured flags with evidence

## Key Documentation

| Document | Description |
|----------|-------------|
| [OVERVIEW.md](./OVERVIEW.md) | High-level architecture and cost estimates |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Detailed tier specifications with prompts |
| [CONTEXT_STRATEGY.md](./CONTEXT_STRATEGY.md) | Proactive context gathering approach |
| [DATA_MODELS.md](./DATA_MODELS.md) | Pydantic models for all tiers |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | Phase-by-phase implementation status |
| [MATCH_GROUPING.md](./MATCH_GROUPING.md) | How regex matches are grouped |

## Source of Truth

| Document | Authority | Purpose |
|----------|-----------|---------|
| `prompts/research_pipeline.yaml` | **PRIMARY** | Defines LLM prompts and output contracts |
| [DATA_MODELS.md](./DATA_MODELS.md) | Secondary | Pydantic models - MUST match YAML schemas |
| Other docs | Descriptive | Explain design, may simplify for readability |

When conflicts exist, `prompts/research_pipeline.yaml` is canonical.

## Issue Configs

The `prompts/compliance_issues.yaml` file contains configurations for all 43 compliance issue types. Each config provides:

- `{issue_description}` - What this issue type means
- `{positive_indicators}` - Signals this IS a compliance issue
- `{negative_indicators}` - Signals this is NOT a compliance issue
- `{severity_baseline}` and `{severity_modifiers}` - Scoring guidance

## Archive

Historical versions are preserved in `archive/`:

| Version | Description |
|---------|-------------|
| `v0-original/` | Original experiments before tiered design |
| `v1-tiered-llm/` | First tiered pipeline iteration |
| `v4-progressive-disclosure/` | V4 4-tier reactive escalation design |

See `archive/README.md` for details.

## V5 Key Innovations (vs V4)

| Innovation | V4 Approach | V5 Approach |
|------------|-------------|-------------|
| Context gathering | Reactive (LLM requests) | Proactive (keyword filter) |
| Argument framing | Generated in Tier 2 | Generated in Tier 1, injected to Tier 2 |
| Verification | Tier 3 (full context) + Tier 4 (web) | Tier 2 re-runs + Tier 3 (web only) |
| Summary limit | Unlimited | Max 20 summaries |
| Re-run tracking | Not tracked | Logged with count + reasons |

## Background

The V5 design was informed by a validation study that found:
- 43.5% error rate in V4 Tier 2 classifications
- 98% of errors were prompt-based, not information-based
- Models don't ask for context even when they need it

The solution: proactive context gathering + argument framing to prime better analysis.

See `docs/compliance_issue_experiments/tier2_validation_study.md` for the full study.
