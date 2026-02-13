# Cross-Reference Pattern Reference

## Pattern Types

### NYCRR (Full-form New York)

**Pattern:** `{1-2 digits} NYCRR {section}`

**Examples:**
- `18 NYCRR 505.14`
- `10 NYCRR 405.3(a)(1)`
- `14 N.Y.C.R.R. 624.6`

**Resolution:** Direct lookup using `nycrr_title` + `nycrr_section`

### NJAC (Full-form New Jersey)

**Pattern:** `N.J.A.C. {title}:{chapter}-{section}`

**Examples:**
- `N.J.A.C. 8:43-1.2`
- `N.J.A.C. 7:50-6.84(a)`
- `NJAC 11:15-4.6`
- `N.J.A.C. 7:26J-2.2(c)4` — deep subsection with trailing paragraph number
- `N.J.A.C. 7:26J-7.3(a)1vi` — deep subsection with trailing roman numeral

**Deep subsections:** Trailing paragraph numbers (`(c)4`) and roman numerals (`(a)1vi`) after subsection markers are captured. Normalization via `_normalize_njac_section()` extracts the base `digits.digits` form for lookup.

**Range detection:** `N.J.A.C. 7:26J-4.1 through 4.5` is captured as a single range reference with `is_range=True`, `range_end_section`, and `range_end_base` in components.

**Resolution:** Direct lookup using `citation` column

### NY Short-form

**Pattern:** `section {X} of this Part/Title/Subpart`

**Examples:**
- `section 624.8 of this Part`
- `section 52.13 of this Title`
- `section 368-1.4 of this Subpart`

**Resolution:** Requires source document context. Constructs full citation using source's `nycrr_title`.

### Same-section (Internal)

**Pattern:** `paragraph/subdivision/subsection (X) of this section`

**Examples:**
- `paragraph (a) of this section`
- `subdivision (b)(1) above`
- `subparagraph (ii) below`

**Resolution:** Not resolved to another document (internal reference).

### Same-section Range

**Pattern:** `(letter) through/to (letter) above/below/herein`

**Examples:**
- `(b) through (f) below`
- `(a) to (d) above`
- `(c) through (g) herein`

**Resolution:** Not resolved to another document (internal range reference). Stored with `is_range=True`, `range_start`, `range_end` in components. Registered before `SAME_SECTION_PATTERN` so overlap detection prevents partial match on the end of the range. Direction word is required to avoid false positives on prose enumerations like "items (a) through (c)".

## Regex Patterns

### NYCRR Pattern
```python
NYCRR_PATTERN = re.compile(
    r'''
    (\d{1,2})\s*                           # Title number
    (?:NYCRR|N\.Y\.C\.R\.R\.)\s*            # NYCRR prefix
    ([\d.]+(?:\([a-z]\)(?:\(\d+\))?)?)      # Section with optional subsection
    ''',
    re.IGNORECASE | re.VERBOSE
)
```

### NJAC Pattern
```python
NJAC_PATTERN = re.compile(
    r'''
    (?:N\.J\.A\.C\.|NJAC)\s*               # NJAC prefix
    (\d+[A-Za-z]?)                          # Title
    :
    (\d+[A-Za-z]?)                          # Chapter
    (?:-
        (\d+(?:\.\d+)?[a-z]?)               # Subchapter-section
        (?:\([a-z]\)(?:\(\d+\))?)?          # Optional subsection
    )?
    ''',
    re.IGNORECASE | re.VERBOSE
)
```

### NY Short-form Pattern
```python
NY_SHORT_FORM_PATTERN = re.compile(
    r'''
    (?:section|§)\s*
    (\d+(?:-\d+)?(?:\.\d+)?(?:\([a-z]\))?)  # Section number
    \s+of\s+this\s+
    (Part|Subpart|Title)                     # Scope indicator
    ''',
    re.IGNORECASE | re.VERBOSE
)
```

## Fallback Resolution Strategies

### NYCRR Fallbacks
1. Exact match: `18 NYCRR 505.14`
2. Strip subsection: `18 NYCRR 505.14(a)` → `18 NYCRR 505.14`
3. Part level: `18 NYCRR 505.14` → `18 NYCRR 505`

### NJAC Fallbacks
1. Exact match: `N.J.A.C. 8:43-1.2`
2. Strip trailing letter: `N.J.A.C. 8:43-1.2a` → `N.J.A.C. 8:43-1.2`
3. Strip (a) subsection
4. Chapter level: `N.J.A.C. 8:43-1.2` → `N.J.A.C. 8:43`

## Known Limitations

### False Positives
- Federal statute references: `section 1401 of this title` (IDEA)
- Non-regulatory "section" references

### Unresolvable
- References to missing chapters (e.g., Title 19 chapters 43, 45, 51, 54)
- Typos in source documents (e.g., `N.J.A.C. 7:25E-1.15` when section doesn't exist)
- Recodified/repealed sections

## Adding New Patterns

1. Update `patterns.py` with new regex
2. Add `RefType` enum value
3. Update `extractor.py` to detect new pattern
4. Update `resolver.py` with resolution logic
5. Test on sample documents before full run
