# Prompt Caching Optimization

**CRITICAL**: Prompts of meaningful length should be optimized for caching. Cache hits cost 90% less than processing and reduce latency significantly.

## How Caching Works

1. Claude caches prompt content from the beginning up to a `cache_control` breakpoint
2. Subsequent requests with identical prefixes get cache hits
3. Cache lifetime options:
   - **5-minute cache** (default): Free refresh on each use, 1.25x write cost
   - **1-hour cache**: 2x write cost, but persists longer for infrequent requests
4. Minimum cacheable length: 1024-4096 tokens depending on model

## Cache Duration Options

### 5-Minute Cache (Default)
```json
"cache_control": {"type": "ephemeral"}
```
- Refreshes automatically when used
- Best for: Frequently accessed prompts (used more often than every 5 min)
- Write cost: 1.25x base input tokens

### 1-Hour Cache
```json
"cache_control": {"type": "ephemeral", "ttl": "1h"}
```
- Best for:
  - Agentic workflows that take >5 minutes
  - Long chat conversations where user may not respond quickly
  - When latency is critical and follow-ups may be >5 min apart
- Write cost: 2x base input tokens
- Read cost: Same as 5-minute (0.10x base)

## Cache-Optimized Prompt Structure

**ALWAYS put static content FIRST, variable content LAST:**

```
┌─────────────────────────────────────┐
│  STATIC (Cached)                    │
│  ├── Tool definitions               │
│  ├── System instructions            │
│  ├── Examples                       │
│  ├── Reference documents            │
│  └── Output format specification    │
├─────────────────────────────────────┤
│  VARIABLE (Not Cached)              │
│  └── User query / input data        │
└─────────────────────────────────────┘
```

## Good vs Bad Examples

### BAD - Variable content first (breaks cache)

```yaml
bad_prompt:
  template: |
    Analyze this text: {user_input}

    You are an expert analyst. Follow these rules:
    1. Identify key themes
    2. Extract entities
    3. Summarize in 3 sentences

    Output as JSON with fields: themes, entities, summary
```

### GOOD - Static content first (cache-friendly)

```yaml
good_prompt:
  template: |
    You are an expert analyst. Follow these rules:
    1. Identify key themes
    2. Extract entities
    3. Summarize in 3 sentences

    Output as JSON with fields: themes, entities, summary

    ---

    Analyze this text: {user_input}
```

## Caching with Long Documents

For prompts with large reference documents:

```yaml
document_analysis:
  template: |
    You are a document analyst. Your task is to answer questions about the provided document.

    <instructions>
    1. Read the document carefully
    2. Find relevant quotes before answering
    3. Cite specific sections
    </instructions>

    <document>
    {document_content}
    </document>

    Question: {user_question}
```

**Note**: The document itself becomes part of the cached prefix if it doesn't change between requests.

## Cache Hierarchy

Cache is checked in this order: `tools` → `system` → `messages`

Changes at any level invalidate that level and all subsequent levels:
- Changing tool definitions → invalidates everything
- Changing system prompt → invalidates system + messages
- Changing only the last user message → keeps tools + system cached

## Cost Comparison

| Operation | Cost vs Base |
|-----------|--------------|
| 5-min cache write | 1.25x |
| 1-hour cache write | 2.00x |
| Cache read (hit) | 0.10x |
| No caching | 1.00x |

**Break-even for 5-min**: If you use a cached prompt 2+ times within 5 minutes, you save money.

## What Invalidates Cache

- Modifying any text before the cache breakpoint
- Adding/removing images
- Changing tool definitions
- Toggling features (citations, web search)
- Changing thinking parameters

## Practical Tips

1. **Keep instructions stable**: Don't embed timestamps or dynamic data in instructions
2. **Use variable placeholders at the end**: `{input}`, `{query}`, `{data}` should come after all static content
3. **Group examples together**: Put all `<example>` blocks in one section before the variable input
4. **For multi-turn conversations**: Cache the system prompt and conversation history, only the latest message is uncached
5. **Choose cache duration wisely**: Use 1-hour for slow workflows, 5-minute for high-frequency use
