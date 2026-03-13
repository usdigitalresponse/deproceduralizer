# Cross-Reference Pattern Reference

## Pattern Types

### NYCRR (Full-form New York)

**Pattern:** `{1-2 digits} NYCRR {section}`

**Examples:**
- `18 NYCRR 505.14`
- `10 NYCRR 405.3(a)(1)`
- `14 N.Y.C.R.R. 624.6`
- `18 NYCRR, Part 430` — comma after NYCRR (OCR artifact)
- `18 NYCRR Parts 452 and 453` — plural `Parts`
- `18 NYCRR §§487.10(e), 488.10(e)` — double section sign with list

**Extended syntax:** Handles OCR artifacts (commas after NYCRR), plural `Parts`, double section signs `§§`, and `Sections` keyword.

**List expansion:** `expand_nycrr_list()` detects comma/semicolon/and-separated sections after an initial NYCRR citation (e.g., `18 NYCRR 430.12; 431.8` → two refs). Uses `NYCRR_ABBREVIATED_SECTION` regex with negative lookaheads to avoid consuming guidance references.

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

### Guidance References

**Pattern:** `GUIDANCE_REF_PATTERN` (case-sensitive — guidance refs are always uppercase)

Three formats:
- **Format 1 (agency-prefixed):** `{YY}-{AGENCY}-{TYPE}-{NUM}` — e.g., `23-OCFS-ADM-15`, `07-OCFS-LCM-12-R1`
- **Format 2 (short):** `{YY} {TYPE}-{NUM}` — e.g., `90 ADM-31`, `04 INF-22`
- **Format 3 (GIS):** `GIS-{YY}-{STATE}/{NUM}` — e.g., `GIS-20-MA/10`

**Parsing:** `parse_guidance_ref_match()` routes to the correct format based on regex group numbers.

**Resolution (in `content_cross_refs.py`):**
- Direct lookup on normalized reference
- Short-format: tries agency-prefixed variants using `DOC_TYPE_AGENCIES` (OTDA, OCFS)
- Zero-padding: strips leading zeros for variant matching (e.g., `07` → `7`)

## Regex Patterns

### NYCRR Pattern
```python
NYCRR_PATTERN = re.compile(
    r'''
    (\d{1,2})[,\s]*                        # Title number (comma for OCR artifacts)
    (?:NYCRR|N\.Y\.C\.R\.R\.)[,\s]*         # NYCRR prefix
    (?:(?:Parts?|Sections?|§§?)\s*)?        # Optional Parts/Sections/§§ prefix
    ([\d.]+(?:-\d+)?(?:\([a-z]\)(?:\(\d+\))?)?)  # Section with optional subsection
    ''',
    re.IGNORECASE | re.VERBOSE
)
```

### NYCRR Abbreviated Section (List Expansion)
```python
NYCRR_ABBREVIATED_SECTION = re.compile(
    r'''
    ^                                      # Start of remaining text
    (?:[,;]\s*|,?\s+and\s+|,?\s+or\s+)    # Separator
    (?!\d{1,2}\s*(?:NYCRR|N\.Y\.C\.R\.R))  # NOT new NYCRR prefix
    (?!\d{2}-[A-Z]+-(?:ADM|LCM|INF|GIS))  # NOT agency-prefixed guidance ref
    (?!\d{2}\s+(?:ADM|LCM|INF|GIS))       # NOT short-format guidance ref
    (\d+(?:-\d+)?(?:\.\d+)?...)            # Section number
    ''',
    re.IGNORECASE | re.VERBOSE
)
```

### Guidance Reference Pattern
```python
GUIDANCE_REF_PATTERN = re.compile(
    r'''
    (?:(\d{2})-([A-Z]+)-(ADM|LCM|INF|GIS)-(\d+(?:-R\d+)?))  # Format 1
    | (?:(\d{2})\s+(ADM|LCM|INF)-(\d+))                       # Format 2
    | (?:(GIS-\d{2}-[A-Z]{2}/\d+))                             # Format 3
    ''',
    # Case-sensitive: guidance refs are always uppercase in source documents
    re.VERBOSE
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

### Form References (Display Only)

**Pattern:** Government form identifiers

**Examples:**
- `LDSS-4013B`
- `DSS-2267`
- `DSS-3174`

**Resolution:** Not resolved — forms are not stored as documents in the DB. Extracted for display/informational purposes.

### NY Statute References (Display Only)

**Pattern:** `{Statute Name} {section}`

**Examples:**
- `Education Law 3209`
- `Family Court Act 413`
- `Vehicle and Traffic Law 375`
- `Tax Law 452`

**Resolution:** Not resolved — NY statutes are not in the document DB. Extracted for display/informational purposes.

### SSL (Social Services Law) References (Display Only)

**Pattern:** `SSL {section}`

**Examples:**
- `SSL 22`
- `SSL 111-g`
- `SSL 131`
- `SSL 366-c`

**Resolution:** Not resolved — a specific statute type extracted separately due to high frequency in OTDA/OCFS/NYSDOH guidance documents.

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
