# XML Tags in Prompts

XML tags are essential for structuring prompts. They improve accuracy, reduce errors, and make outputs easier to parse.

## Why Use XML Tags

- **Clarity**: Clearly separate instructions, examples, context, and queries
- **Accuracy**: Reduce misinterpretation by explicitly marking sections
- **Parseability**: Easy to extract specific parts from Claude's response
- **Flexibility**: Add/remove/modify sections without rewriting everything

## Standard Tag Conventions

### Input Structure Tags

```xml
<instructions>
Step-by-step instructions for the task
</instructions>

<context>
Background information Claude needs
</context>

<examples>
  <example>
    Input: ...
    Output: ...
  </example>
</examples>

<document>
  <source>filename.pdf</source>
  <document_content>
    The actual document text
  </document_content>
</document>

<data>
Data to be processed
</data>
```

### Output Structure Tags

Ask Claude to use tags in its response for easy parsing:

```xml
<thinking>
Claude's reasoning process (for chain-of-thought)
</thinking>

<answer>
The final answer
</answer>

<findings>
Analysis results
</findings>

<recommendations>
Suggested actions
</recommendations>
```

## Best Practices

### 1. Be Consistent
Use the same tag names throughout your prompts. Reference them explicitly:

```
Using the contract in <contract> tags, identify the key clauses.
```

### 2. Nest Tags for Hierarchy

```xml
<documents>
  <document index="1">
    <source>report.pdf</source>
    <document_content>...</document_content>
  </document>
  <document index="2">
    <source>data.csv</source>
    <document_content>...</document_content>
  </document>
</documents>
```

### 3. Use Descriptive Names
Tag names should describe their content:
- Good: `<customer_feedback>`, `<analysis_criteria>`, `<output_format>`
- Bad: `<data1>`, `<section>`, `<content>`

### 4. Combine with Other Techniques

```xml
<examples>
  <example>
    Input: The dashboard is slow and confusing
    Category: UI/UX, Performance
    Sentiment: Negative
    Priority: High
  </example>
</examples>

<thinking>
[Claude's chain-of-thought reasoning]
</thinking>

<answer>
[Structured final response]
</answer>
```

## Common Patterns

### Multi-Document Analysis
```xml
<documents>
  <document index="1">
    <source>{source_1}</source>
    <document_content>{content_1}</document_content>
  </document>
  <document index="2">
    <source>{source_2}</source>
    <document_content>{content_2}</document_content>
  </document>
</documents>

Analyze the documents above and provide your findings in <findings> tags.
```

### Structured Output Request
```xml
<instructions>
Analyze the regulation for implementation issues.
</instructions>

<section>
{section_text}
</section>

Provide your analysis in this format:
- Put your reasoning in <thinking> tags
- Put identified issues in <issues> tags
- Put recommendations in <recommendations> tags
```

### Examples with Edge Cases
```xml
<examples>
  <example type="standard">
    Input: Normal case
    Output: Standard handling
  </example>
  <example type="edge_case">
    Input: Unusual input
    Output: How to handle edge cases
  </example>
</examples>
```

## Tags in prompts/

When writing prompts for this project (in `prompts/core.yaml` or `prompts/compliance_issues.yaml`):

```yaml
my_analysis_prompt:
  system: |
    <instructions>
    1. Read the section carefully
    2. Identify key issues
    3. Rate severity 1-10
    </instructions>

    Return your analysis as JSON with fields: issues, severity, summary

  template: |
    <section>
    {section_text}
    </section>
```

## What NOT to Do

- Don't use XML tags that conflict with actual XML in the content
- Don't nest too deeply (3 levels max is usually sufficient)
- Don't use tags for single-value items (just use clear labels instead)
- Don't mix XML tags with other markup inconsistently
