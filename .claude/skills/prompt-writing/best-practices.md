# Prompt Writing Best Practices

## 1. Be Clear and Direct

Think of Claude as a brilliant new employee with no context on your norms or preferences.

### Provide Context
Tell Claude:
- What the results will be used for
- Who the audience is
- Where this task fits in a larger workflow
- What success looks like

### Be Specific
```yaml
# BAD - Vague
bad_prompt: "Analyze this feedback"

# GOOD - Specific
good_prompt: |
  Analyze this customer feedback. For each item:
  1. Categorize as: UI/UX, Performance, Feature Request, or Other
  2. Rate sentiment: Positive, Neutral, or Negative
  3. Assign priority: High, Medium, or Low

  Output as a numbered list with Category, Sentiment, Priority for each.
```

### Use Sequential Steps
Number your instructions:
```yaml
instructions: |
  1. Read the document in <document> tags
  2. Extract all defined terms
  3. For each term, note its definition and scope
  4. Output as JSON array with fields: term, definition, scope
```

## 2. Use Examples (Multishot Prompting)

Examples dramatically improve accuracy and consistency.

### Include 3-5 Diverse Examples
```yaml
prompt_with_examples: |
  Categorize customer feedback into: UI/UX, Performance, Feature Request, Other.

  <examples>
    <example>
      Input: The dashboard loads too slowly
      Category: Performance
    </example>
    <example>
      Input: I wish I could export to PDF
      Category: Feature Request
    </example>
    <example>
      Input: The button colors are hard to see
      Category: UI/UX
    </example>
  </examples>

  Now categorize: {feedback}
```

### Make Examples Relevant and Diverse
- Mirror your actual use case
- Include edge cases
- Vary enough to avoid unintended patterns

## 3. Chain of Thought (Let Claude Think)

For complex tasks, let Claude reason step-by-step.

### Basic CoT
```yaml
simple_cot: |
  Analyze this regulation for compliance issues.
  Think step-by-step before giving your final answer.

  {regulation_text}
```

### Structured CoT with Tags
```yaml
structured_cot: |
  Analyze this regulation for compliance issues.

  <instructions>
  1. First, identify all requirements in <requirements> tags
  2. Then, analyze each requirement for issues in <analysis> tags
  3. Finally, provide your summary in <summary> tags
  </instructions>

  {regulation_text}
```

### When to Use CoT
- Complex reasoning (math, logic, multi-step analysis)
- Decisions with many factors
- Tasks where you need to see the reasoning
- When debugging prompts (see where Claude goes wrong)

### When NOT to Use CoT
- Simple extraction tasks
- When latency is critical
- Straightforward classification

## 4. Long Context Tips

For prompts with large documents (20K+ tokens):

### Put Long Content First
```yaml
# GOOD - Document at top, query at bottom
long_context_prompt: |
  <document>
  {very_long_document}
  </document>

  Based on the document above, answer: {question}
```

### Ground Responses in Quotes
Ask Claude to cite before answering:
```yaml
citation_prompt: |
  <document>
  {document}
  </document>

  Find relevant quotes from the document in <quotes> tags.
  Then answer the question based on those quotes in <answer> tags.

  Question: {question}
```

### Structure Multiple Documents
```yaml
multi_doc_prompt: |
  <documents>
    <document index="1">
      <source>annual_report.pdf</source>
      <document_content>{report}</document_content>
    </document>
    <document index="2">
      <source>competitor_analysis.xlsx</source>
      <document_content>{analysis}</document_content>
    </document>
  </documents>

  Compare the documents and identify strategic advantages.
```

## 5. Output Format Specification

Always specify the expected output format:

### JSON Output
```yaml
json_output_prompt: |
  Analyze the text and return ONLY valid JSON:
  {{
    "issues": [...],
    "severity": 1-10,
    "summary": "..."
  }}
```

### Structured Text Output
```yaml
structured_output_prompt: |
  Format your response as:

  CATEGORY: [category name]
  SEVERITY: [1-10]
  EXPLANATION: [brief explanation]
  RECOMMENDATION: [suggested action]
```

## 6. Prompt Testing Checklist

Before finalizing a prompt:

1. **Clarity Test**: Could a new team member follow these instructions?
2. **Edge Case Test**: What happens with unusual input?
3. **Output Test**: Is the output format consistent and parseable?
4. **Cache Test**: Is static content before variable content?
5. **Length Test**: Is the prompt longer than necessary?

## 7. Common Mistakes to Avoid

- Embedding timestamps or dynamic data in instructions (breaks cache)
- Vague instructions ("analyze this", "help with this")
- Missing output format specification
- Examples that are too similar (Claude picks up wrong patterns)
- Putting the query before the context/instructions
- Over-engineering simple tasks
