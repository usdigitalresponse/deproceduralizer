# Prompt Writing Skill

Use this skill when writing or modifying LLM prompts. Follow these guidelines to create effective, cache-optimized prompts.

## Quick Checklist

Before committing any prompt:
1. Is it **cache-optimized**? (static content first, variables last)
2. Does it use **XML tags** for structure?
3. Is the instruction **clear and specific**?
4. Are there **examples** for complex tasks?

## Reference Files

- **[caching.md](caching.md)** - Cache optimization (CRITICAL for cost/latency)
- **[xml-tags.md](xml-tags.md)** - XML tagging conventions
- **[best-practices.md](best-practices.md)** - Clarity, examples, chain-of-thought

## Prompt Template Structure

```
[STATIC CONTENT - cached]
├── System context/role
├── Instructions (numbered steps)
├── Examples wrapped in <example> tags
├── Reference documents in <document> tags
└── Output format specification

[VARIABLE CONTENT - not cached]
└── User input with {variable_name} placeholders
```

## Minimum Requirements

Every prompt MUST have:
1. **Clear task description** - What exactly should Claude do?
2. **Structured output format** - How should the response be formatted?
3. **XML tags** for any multi-part content

## Integration with prompts.yaml

All prompts in this project go in `/prompts.yaml`. Each prompt has:
- `description`: What the prompt does (shown on /prompts page)
- `template`: The actual prompt with `{variable}` placeholders

```yaml
my_new_prompt:
  description: |
    Brief description of what this prompt analyzes or generates.

  template: |
    [Your prompt here with {variables}]
```
