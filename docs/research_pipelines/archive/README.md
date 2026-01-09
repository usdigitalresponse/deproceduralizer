# Research Pipeline Archive

This folder contains historical versions of the research pipeline design and experiments.
These are preserved for reference but are **not actively maintained**.

## Current Version

The active research pipeline is in the parent directory (`docs/research_pipelines/`).
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
- Superseded by the 4-tier progressive disclosure design

## Why Archived?

These versions were superseded by the **Progressive Disclosure Pipeline** which:
- Uses 4 tiers (Match Filtering, Summary Research, Full Context, Web Search)
- Has structured issue configs with `{issue_description}`, `{positive_indicators}`, `{negative_indicators}`
- Supports few-shot learning with `{issue_examples}` template variable
- Implements prompt caching strategy
