# Research Pipeline Archive

This folder contains historical versions of the research pipeline design and experiments.
These are preserved for reference but are **not actively maintained**.

## Current Version

The active research pipeline (V5, 3-tier) is in the parent directory (`docs/research_pipelines/`).
See `../README.md` for the current implementation.

## Archived Versions

### v0-original/
The original compliance issue experiments before the tiered pipeline design.
- Individual issue type prompts using `{regulation_context}` template variable
- Performance data in `IMPROVEMENT_REPORT.md`
- Useful for understanding the evolution of prompts

### v1-tiered-llm/
First iteration of the tiered LLM pipeline.
- Early tiered approach experiments
- Superseded by the V4 progressive disclosure design

### v4-progressive-disclosure/
V4 4-tier progressive disclosure pipeline design.
- Schema proposal and TODO for the 4-tier architecture (Tier 3 deep dive + Tier 4 web search)
- Superseded by V5 which merged these into 3 tiers with proactive context gathering

## Why Archived?

These versions were superseded by the **V5 Pipeline** which:
- Uses 3 tiers (Triage + Argument Framing, Full Classification, Web Search Verification)
- Has proactive context gathering (keyword filtering) instead of reactive (LLM requests)
- Has structured issue configs with `{issue_description}`, `{positive_indicators}`, `{negative_indicators}`
- Implements prompt caching strategy
