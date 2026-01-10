see i# Compliance Issue Detection Improvement Report

> Generated: 2025-12-31
> Methodology: `RALPH_LOOP_PROMPT.md` - Tier 2 research procedure applied to random samples

## Executive Summary

### Overall Findings

**Critical Discovery**: The lowest-precision issue types share a common failure mode - **patterns match ANY mention of terminology, not MANDATORY requirements**.

| Issue Type | Reported Precision | Sample TPR | Root Cause |
|------------|-------------------|------------|------------|
| pdf_only | 1.5% | **0%** | Pattern `\.pdf\b` matches URLs |
| fax | 8.9% | 33% | Catches contact info, options |
| typewriter | 11.8% | **0%** | "typewritten" = not handwritten (legacy term) |
| in_person_submission | 22.2% | **0%** | Catches "or" options, rights, prohibitions |
| witness | 30.5% | **0%** → **90%** | "attested" = certified; but `shall be witnessed` = 90% |
| storage_location | 33.5% | ~25% | Broad patterns, legitimate uses |
| mail_only | 35.7% | ~17% | Catches outbound mail, alternatives |
| certified_mail | ~15-25%* | ~15-25% | 78% have alternatives, legal service context |
| in_person_hearing | ~5%* | <5% | Matches hearing mentions, not attendance reqs |
| in_person_pickup | ~5%* | <5% | "pick up" matches casino/audio/physical contexts |
| **notarization** | **90.9%** | **~85-90%** | ✓ Terminology inherently implies requirement |
| physical_forms | ~40%* | ~25-50% | Small volume, many have online alternatives |
| wet_signature | ~55%* | ~50-60% | Catches exceptions "in place of handwritten" |
| original_document | ~45%* | ~40-50% | "original" in non-doc contexts; copies allowed |

**Average True Positive Rate across low-precision samples: ~11%**
*Precision estimated from pattern analysis

### Common Failure Patterns

1. **Optional language missed**: "X or Y" patterns where X is the issue type but Y is an alternative
2. **Directionality ignored**: "shall be mailed TO" (outbound) vs "shall mail" (submission requirement)
3. **Word boundary issues**: "teletypewriter" matches typewriter, URLs match `.pdf`
4. **Informational mentions**: Contact info ("fax number"), certification ("attested to")
5. **Legal necessities**: Witness requirements for wills/guardianship are legitimate

### Recommended Priority Actions

| Priority | Action | Issue Types |
|----------|--------|-------------|
| **URGENT** | Remove/fix catastrophic patterns | pdf_only (remove `\.pdf\b`), in_person_pickup |
| **HIGH** | Add mandatory language + "or" exclusion | in_person_submission, witness, fax |
| **MEDIUM** | Add exclusion rules for alternatives | mail_only, storage_location, certified_mail |
| **LOW** | Consider deprecating or narrowing significantly | typewriter, in_person_hearing |
| **REFERENCE** | Study as high-precision template | notarization (90.9%) |

### Cross-Cutting Pattern Improvement Strategy

Based on notarization (90.9% precision) vs low-precision types:

1. **Use passive/past participle forms**: `shall be notarized` > `notary public`; `must be witnessed` > `witness required`
2. **Avoid terms with common alternative contexts**: "fax number", "or mail", "pick up" have many non-requirement uses
3. **Require mandatory language prefix**: `(shall|must|required).{0,20}[action]`
4. **Add "or" exclusion logic**: Most issue types drop 50-80% of false positives by excluding "or [alternative]"

### Key Insight for Research Pipeline

The current regex-based detection is fundamentally flawed for most issue types. The **Tier 2 research procedure** (full context with definitions, cross-refs, siblings) is essential because:

1. Regex alone cannot detect the difference between requirements and options
2. Context from sibling sections often reveals alternatives (waiver provisions, electronic options)
3. Mandatory language ("shall", "must") alone is insufficient - need to check for "or" alternatives

**Recommendation**: The research pipeline should treat Tier 1 as a **candidate finder** only, with very high recall tolerance. Let Tier 2 do the actual classification with full context.

## Progress Tracking

- **Completed**: ALL 44 working prompts analyzed (see Session 4 for final 15)
- **HIGH-PRECISION (100% TPR)**: binding_required, multiple_copies, surety_bond, newspaper, physical_log, letterhead
- **Session findings**:
  - Low-precision types share common failure: patterns match ANY mention, not MANDATORY requirements
  - High-precision types (notarization) work because the terminology inherently implies requirements
  - "or" alternatives detection is critical for most issue types

---

## Issue Type Analysis

---

## pdf_only - 2025-12-31

### Configuration
- Display name: PDF Only Format
- Category: Technology
- Patterns tested: 4 (`pdf format`, `submit as pdf`, `adobe pdf`, `\.pdf\b`)

### Results
- Sample size: 6
- True positives: 0
- False positives: 6
- **True positive rate: 0%**

### Key Findings

1. **Pattern `\.pdf\b` is catastrophically over-matching**: All 6 samples matched URLs ending in `.pdf` (e.g., `http://www.cdc.gov/mmwr/pdf/rr/rr6007.pdf`). These are links to PDF documents, NOT requirements to submit in PDF format.

2. **No actual PDF-only requirements found**: None of the 6 samples required PDF as the ONLY submission format - they were all references to where PDF documents are available online.

3. **Regulations commonly link to PDF resources**: Government regulations frequently incorporate by reference or cite documents available as PDFs on agency websites. The pattern catches ALL of these.

### False Positive Categories Identified

| Category | Description | Example |
|----------|-------------|---------|
| URL endings | Links to .pdf files on websites | `www.nj.gov/.../orgchart.pdf` |
| IBR PDFs | Incorporated documents available as PDF | CDC guidelines PDF link |
| Complaint forms | Links to downloadable complaint forms | Consumer Affairs PDF |

### Recommended Changes

#### Pattern Analysis Results

After testing various patterns against the database:

| Pattern Tested | Matches | True Positives | Notes |
|---------------|---------|----------------|-------|
| `\.pdf\b` (original) | ~195 | 0 | Almost all are URLs |
| `pdf format` | 16 | 0 | All have "or other formats" |
| `(shall\|must).{0,30}pdf` | 3 | **1** | 22 NYCRR 1245.11 |
| `pdf/a\|pdf archival` | 25 | 1 | Same regulation |

**Key Finding**: TRUE PDF-only requirements are extremely rare. Out of ~258 documents mentioning PDF, only 1-2 actually require PDF exclusively.

#### Regex Improvements

**REMOVE immediately:**
- `\.pdf\b` - Matches URLs (76% of all PDF mentions are URL-based)

**REPLACE with targeted patterns:**
```yaml
patterns:
  # Mandatory PDF format language
  - (shall|must).{0,20}(be )?(in |submit.{0,10})?pdf
  - pdf.{0,10}format.{0,10}(is |shall be )?required
  - (electronic|e-?fil).{0,30}pdf.{0,10}(format|only)

  # Court e-filing PDF/A requirements (the main true positive category)
  - shall.{0,20}pdf.?a
  - pdf archival.{0,10}format
  - comply.{0,20}pdf
```

**ADD exclusion logic (post-match filtering):**
- Exclude if `or` appears within 30 chars of PDF (indicates alternatives)
- Exclude if URL patterns present: `https?://`, `www\.`, `\.gov/`, `\.org/`
- Exclude if "available" or "download" appears (availability, not requirement)
- Exclude if "Word", "other format", "acceptable format" appears nearby

#### Prompt Improvements

Add to negative indicators:
- "If PDF is mentioned only as a download location or URL, this is NOT a compliance issue"
- "If 'or other formats', 'or Word', 'or acceptable formats' appears, NOT a compliance issue"
- "References to PDF documents available on websites are NOT PDF-only requirements"
- "Incorporations by reference to PDF documents are not format requirements"

Add to positive indicators:
- "Court e-filing rules requiring PDF/A format specifically ARE compliance issues"
- "Look for 'shall comply with PDF' or 'must be in PDF format' without alternatives"

### Sample Evidence

**TRUE POSITIVE Found:**
- Citation: 22 NYCRR 1245.11
- Quote: "e-filed documents...shall comply with text searchable PDF archival format (PDF/A)"
- Why burdensome: Requires specific PDF/A format for court e-filing with no alternative

**False Positive Example 1:**
- Citation: N.J.A.C. 8:42-3.4
- Quote: "which can be found on the CDC website at http://www.cdc.gov/mmwr/pdf/rr/rr6007.pdf"
- Why NOT burdensome: This is a URL to a CDC document, not a requirement to submit in PDF format

**False Positive Example 2:**
- Citation: N.J.A.C. 5:23-2.15B
- Quote: "shall be submitted in PDF format or in other acceptable file formats"
- Why NOT burdensome: Explicitly allows "other acceptable file formats"

### Conclusion

The `pdf_only` issue type needs a complete overhaul. The current patterns detect URLs (76% of matches) rather than actual requirements. True PDF-only requirements are rare (~0.4% of PDF mentions) and mainly exist in court e-filing rules requiring PDF/A format.

**Consider**: Renaming this issue type to `pdf_a_required` and focusing specifically on court e-filing format requirements, or deprecating if the volume is too low to justify.

**Priority: URGENT** - Remove `\.pdf\b` pattern immediately. Replace with targeted patterns.

---

## fax - 2025-12-31

### Configuration
- Display name: Fax Requirements
- Category: Communication
- Patterns tested: 3 (`\bfax\b`, `facsimile`, `telefax`)

### Results
- Sample size: 9 (unique documents)
- True positives: 3
- False positives: 6
- **True positive rate: 33%** (better than reported 8.9%)

### Key Findings

1. **The `\bfax\b` pattern is too broad**: It matches any mention of "fax" including contact information fields, definitions, and optional alternatives.

2. **Most matches are contact info or optional uses**: 6 of 9 matches were just "fax number" in contact info or "fax when provided" optional language.

3. **True positives have mandatory language**: All 3 true positives used "shall...fax" or "must...be faxed" language.

### False Positive Categories Identified

| Category | Description | Example |
|----------|-------------|---------|
| Contact info | "telephone and fax number" | N.J.A.C. 8:43B-2.1 |
| Optional use | "email or fax when provided" | 21 NYCRR 176.4 |
| Device definitions | Lists of devices including fax | N.J.A.C. 10A:31-1.3 |
| Alternative offered | "address or fax number" | N.J.A.C. 7:28-57.1 |
| With electronic option | "fax (or other electronic means)" | N.J.A.C. 17:13-3.3 |

### True Positive Examples

1. **N.J.A.C. 12:121-5.1** (Crane accidents): "the written accident notification **must also be faxed** to the Department"
   - Severity: 6 (Baseline 5 + no alternative +1)

2. **N.J.A.C. 10:90-17.2** (TANF referrals): "The WFNJ agency **shall immediately fax**...a copy of the signed WFNJ/EEI-1"
   - Severity: 7 (Baseline 5 + vulnerable pop +2)

3. **N.J.A.C. 10A:3-2.3** (Inmate transfers): "**Advise by telephone and fax** a copy of Form 173-III"
   - Severity: 4 (Baseline 5 - B2G context -1)

### Recommended Changes

#### Regex Improvements

**ADD mandatory language patterns:**
- `shall.{0,20}fax`
- `must.{0,15}(be )?fax`
- `required.{0,15}fax`
- `fax.{0,15}(is |shall be )?required`

**ADD exclusion patterns** (post-match filtering):
- Exclude if match contains: "fax number", "or fax", "and/or fax", "if.{0,10}fax", "when.{0,10}fax"
- Exclude if "email" or "electronic" appears within 50 chars

**KEEP but score lower:**
- `\bfax\b` pattern - use as candidate finder, but require LLM verification

#### Prompt Improvements

Add to positive indicators:
- "If fax is the ONLY alternative to mail (no email, no online portal), this IS a compliance issue"
- "Look for mandatory language: 'shall fax', 'must be faxed', 'required to fax'"

Add to negative indicators:
- "If 'fax number' appears as contact info collection, NOT a compliance issue"
- "If fax is paired with 'or email', 'or electronic', NOT a compliance issue"
- "If fax is 'when provided' or 'if known', NOT a compliance issue (optional)"
- "Device definitions listing fax machines are NOT compliance issues"

### Sample Evidence

**True Positive Example:**
- Citation: N.J.A.C. 12:121-5.1
- Quote: "the written accident notification must also be faxed to the Department at 609-292-3749"
- Why burdensome: Fax is REQUIRED for crane accident reports with no modern alternative

**False Positive Example:**
- Citation: N.J.A.C. 8:43B-2.1
- Quote: "address, including the county, telephone and fax number, and email address"
- Why NOT burdensome: This is just collecting contact information, not requiring fax use

### Conclusion

The fax issue type performs better than reported (33% vs 8.9% TPR), but still needs improvement. The key distinction is **mandatory fax requirements** vs. **optional/informational fax mentions**. Adding mandatory language patterns and exclusion rules for contact info will significantly improve precision.

**Priority: MEDIUM** - Add mandatory language patterns, implement exclusion rules.

---

## typewriter - 2025-12-31

### Configuration
- Display name: Typewriter Required
- Category: Technology
- Patterns tested: 5 (`\btypewriter\b`, `typewritten`, `type.{0,3}written`, `must be typed`, `shall be typed`)

### Results
- Sample size: 6 (unique documents)
- True positives: 0
- False positives: 6
- **True positive rate: 0%**

### Key Findings

1. **"typewritten" almost always appears as an OPTION, not requirement**: 4 of 6 matches used "or typewritten" or "if typewritten" language - meaning typewritten is optional or conditional.

2. **"teletypewriter" is a different word**: The pattern matched "teletypewriter exchange service" which is a type of communication service, not a typewriter requirement.

3. **No actual typewriter requirements found**: None of the 6 samples required typewriter to the exclusion of computer-generated documents.

### False Positive Categories Identified

| Category | Description | Example |
|----------|-------------|---------|
| Optional format | "or typewritten" among options | 22 NYCRR 1100.2 |
| Conditional | "if typewritten" (formatting rules) | 22 NYCRR 210.4 |
| Word within word | "teletypewriter" | 20 NYCRR 526.5 |
| Multiple options | "ink or typewritten or electronic" | N.J.A.C. 17:12-2.2 |

### Analysis: Why This Issue Type Has Low Precision

Modern regulations rarely REQUIRE typewriters. Instead, they:
1. Offer typewritten as one of several format options
2. Provide formatting rules for typewritten documents IF chosen
3. Accept computer-generated documents as equivalent to typewritten

The regulations that mention "typewritten" are typically OLD regulations that haven't been updated to remove the term, not regulations that exclude computer-generated alternatives.

### Recommended Changes

#### Pattern Analysis Results

After testing improved patterns:

| Pattern | Matches | Estimated TPR | Notes |
|---------|---------|---------------|-------|
| `typewritten` (original) | 92 | ~0% | Catches options/conditionals |
| `or typewritten` | 17 | 0% | Optional format |
| `if typewritten` | 8 | 0% | Conditional formatting |
| `(shall\|must).{0,15}typewritten` | 24 | ~50% | Better but needs exclusions |
| Same, excluding "or" nearby | **2** | **~100%** | Best pattern |

#### Regex Improvements

**REMOVE:**
- `typewritten` - too broad
- `\btypewriter\b` - matches "teletypewriter"

**REPLACE with:**
```yaml
patterns:
  # Mandatory typewritten without alternatives
  - (shall|must).{0,15}(be )?(in )?typewritten

exclusion_logic:
  - Exclude if "or typewritten" appears
  - Exclude if "if typewritten" appears
  - Exclude if "typewritten or" appears
```

**TRUE POSITIVE Found:**
- Citation: 8 NYCRR 281.4
- Quote: "All papers submitted to the commissioner...shall be in typewritten form"
- Analysis: Requires typewritten form with no alternative mentioned

#### Prompt Improvements

Add to negative indicators:
- "If 'typewritten' appears as one option among others, NOT a compliance issue"
- "If 'if typewritten' appears (conditional formatting rules), NOT a compliance issue"
- "The word 'teletypewriter' refers to a communication service, NOT a typewriter"

Add to positive indicators:
- "Look for 'shall be typewritten' or 'must be typewritten' WITHOUT 'or' alternatives"

### Conclusion

With improved patterns (mandatory language + exclusion of alternatives), typewriter reduces from 92 matches to **2 high-precision matches**. The issue type is viable but needs tight pattern constraints.

**Priority: MEDIUM** - Replace patterns with mandatory language + exclusion logic.

---

## in_person_submission - 2025-12-31

### Configuration
- Display name: In-Person Submission
- Category: Physical Presence
- Patterns tested: 5 (`submit.{0,10}in person`, `appear in person`, `in.{0,3}person.{0,10}submission`, `personal appearance`, `hand.{0,3}deliver`)

### Results
- Sample size: 6 (unique documents)
- True positives: 0
- False positives: 6
- **True positive rate: 0%**

### Key Findings

1. **"hand deliver" almost always appears as one OPTION among several**: 4 of 6 matches showed "hand deliver OR mail" or "hand deliver, mail, OR electronic" - not requirements.

2. **"appear in person" often describes a RIGHT, not requirement**: One match was about the "right to appear in person" - granting permission, not mandating.

3. **Some matches are the OPPOSITE of burdensome**: One match (Exec Order 105) was actually ADDING electronic options to reduce in-person requirements. Another (15 NYCRR 82.15) explicitly said "No personal appearances will be allowed."

### False Positive Categories Identified

| Category | Description | Example |
|----------|-------------|---------|
| Optional method | "hand deliver or mail" | N.J.A.C. 13:46-23.6 |
| With electronic | "hand-delivered, mailed, or electronically" | N.J.A.C. 16:1A-4.2 |
| Right not requirement | "right to appear in person" | 19 NYCRR 400.10 |
| Adding alternatives | Orders adding electronic options | Exec Order 105 |
| Prohibition | "No personal appearances allowed" | 15 NYCRR 82.15 |

### Analysis: What Would Be a True Positive?

A true positive would look like:
- "applicant must appear in person" (no alternative)
- "shall be hand-delivered" (no mail/electronic option)
- "required to submit in person" with no alternatives mentioned

The current patterns catch ANY mention of these terms, not MANDATORY uses.

### Recommended Changes

#### Pattern Analysis Results

After testing improved patterns:

| Pattern | Matches | Estimated TPR | Notes |
|---------|---------|---------------|-------|
| `appear in person` (original) | 67 | ~5% | Most are rights/options |
| `right to appear` | 41 | 0% | Granting permission, not requiring |
| `hand.{0,3}deliver` (original) | 131 | ~10% | 66 have "or" alternatives |
| `(must\|shall).{0,15}appear.{0,10}in person` | 14 | ~30% | Better, but includes "allowed" |
| Same, excluding "allowed to appear" | **11** | **~60%** | Much better |
| `in person.{0,10}only` | **1** | **100%** | Very high precision |

#### Regex Improvements

**REMOVE:**
- `appear in person` - too broad, catches rights
- `hand.{0,3}deliver` - almost always optional

**REPLACE with:**
```yaml
patterns:
  # High precision: "in person only"
  - in person.{0,10}only

  # Mandatory appearance (with exclusions)
  - (must|shall|required).{0,15}appear.{0,10}in person

  # Mandatory hand delivery (with exclusions)
  - (must|shall).{0,10}hand.{0,3}deliver

exclusion_logic:
  - Exclude if "allowed to appear" appears
  - Exclude if "right to appear" appears
  - Exclude if "or" appears within 30 chars
  - Exclude if "no" or "not" precedes match
```

**TRUE POSITIVES Found:**
1. **6 NYCRR 63.2**: "may apply **in person only**" - Hunting permits require in-person application
2. **9 NYCRR 52.2**: "The applicant **must appear in person** on the date set forth" - Board hearing requirement

#### Prompt Improvements

Add to negative indicators:
- "If 'allowed to appear' or 'right to appear' is mentioned, NOT a compliance issue"
- "If 'or' follows the in-person term, NOT a compliance issue"
- "If 'no personal appearances' is mentioned, NOT a compliance issue - it's prohibiting"

Add to positive indicators:
- "Look for 'in person only' - very high precision"
- "Look for 'must appear in person' or 'shall appear in person' without alternatives"

### Sample Evidence

**TRUE POSITIVE Example:**
- Citation: 6 NYCRR 63.2
- Quote: "Applicants must possess a valid hunting license and may apply in person only"
- Why burdensome: No mail or electronic alternative for hunting permit application

**False Positive Example:**
- Citation: N.J.A.C. 10A:5-2.6
- Quote: "the inmate shall be allowed to appear in person"
- Why NOT burdensome: This ALLOWS appearance, doesn't require it

### Conclusion

With improved patterns (mandatory language + "in person only" + exclusions), in_person_submission can achieve ~60-100% precision on targeted matches, down from 131+ broad matches to ~12 high-quality matches.

**Priority: HIGH** - Replace patterns with mandatory language + exclusion logic.

---

## witness - 2025-12-31

### Configuration
- Display name: Witness Required
- Category: Signatures
- Patterns tested: 7 (`two witnesses`, `2 witnesses`, `witness.{0,5}signature`, `witnessed by`, `\battested\b`, `attestation`, `in the presence of`)

### Results
- Sample size: 6
- True positives: 0
- False positives: 6
- **True positive rate: 0%**

### Key Findings

1. **"attested" often means verified/certified, not witnessed**: Matches like "population figure attested to in writing by a government official" are about certification, not witness signatures.

2. **"attestation" is often self-attestation**: Servicemember attestation requirements are self-declarations, not witness requirements.

3. **Witness requirements are often JUSTIFIED**: Requirements for witnesses in guardianship (legal necessity), medical decisions (patient protection), or as alternatives to notarization (providing flexibility) are not compliance issues.

### False Positive Categories

| Category | Description | Example |
|----------|-------------|---------|
| Certification | "attested to" meaning verified | 8 NYCRR 90.9 |
| Self-attestation | Person attests about themselves | 8 NYCRR 59.16 |
| Corporate formality | Secretary attests president's signature | N.J.A.C. 11:2-28.2 |
| Legal necessity | Witnesses for guardianship/wills | Form 155220 |
| Alternative offered | Witnesses as alternative to notary | 19 NYCRR 182.5 |

### Recommended Changes

#### Pattern Analysis Results

After testing improved patterns:

| Pattern | Matches | Estimated TPR | Notes |
|---------|---------|---------------|-------|
| `attested` (original) | 124 | ~5% | 93 are "attested to/by" (certification) |
| `two witnesses` | 11 | ~50% | Often for wills/guardianship (justified) |
| `witness.{0,5}signature` | 8 | ~40% | Mixed |
| `(shall\|must).{0,15}(be )?witnessed` | **35** | **~90%** | High precision pattern! |
| `witness.{0,10}required` | 15 | ~70% | Good precision |

#### Regex Improvements

**REMOVE:**
- `\battested\b` - 75% are certification language ("attested to"), not witness requirements
- `attestation` - mostly self-attestation

**REPLACE with:**
```yaml
patterns:
  # High precision: mandatory witnessed
  - (shall|must).{0,15}(be )?witnessed

  # Witness required language
  - witness.{0,10}(is |shall be |are )?required
  - require.{0,15}witness

  # Keep but filter for legal necessity
  - two witnesses
  - witness.{0,5}signature

exclusion_logic:
  - Exclude "attested to" and "attested by" (certification)
  - Exclude "self-attest" (self-declaration)
  - Exclude if "or notary" appears (alternative offered)
```

**TRUE POSITIVES Found (5/5 checked):**
1. **9 NYCRR 7002.4**: "inventory shall be witnessed and signed by a second facility staff member"
2. **N.J.A.C. 7:9A-10.7**: "test shall be witnessed by the administrative authority"
3. **N.J.A.C. 8:37-3.1**: "authorization must be in writing, and must be witnessed in writing"
4. **9 NYCRR 1627-4.1**: "signing of the lease...shall be witnessed by a designated authority employee"
5. **8 NYCRR 247.3**: "request shall be witnessed by two agency employees"

#### Prompt Improvements

Add to negative indicators:
- "If 'attested to' or 'attested by' appears, this is CERTIFICATION language, NOT a witness requirement"
- "If 'self-attest' or 'attestation that [person]' appears, NOT a witness requirement"
- "Witness requirements for wills, guardianship, or medical decisions may be legally mandated - check statute"

Add to positive indicators:
- "Look for 'shall be witnessed' or 'must be witnessed' - high precision pattern"
- "Administrative witness requirements (not for wills/guardianship) are likely compliance issues"

### Conclusion

The witness issue type has the BEST improvement potential. The pattern `(shall|must).{0,15}(be )?witnessed` achieves **~90% precision** on 35 matches. The main fix is removing the overly broad `attested` pattern.

**Priority: MEDIUM** - Replace `attested` with mandatory witnessed patterns.

---

## storage_location - 2025-12-31

### Configuration
- Display name: Specific Storage Location
- Category: Process
- Patterns tested: 7 (`stored at`, `maintained at`, `kept at the premises`, `kept on.{0,10}premises`, `on.{0,3}site.{0,10}storage`, `at the facility`, `records.{0,10}kept`)

### Results
- Sample size: 4
- True positives: 1 (potential)
- False positives: 3
- **True positive rate: ~25%**

### Key Findings

1. **Some on-site storage requirements are legitimate**: Records that need to be accessible during inspections may legitimately need on-site storage.

2. **Pattern "records.{0,10}kept" is too broad**: Catches any mention of record-keeping, not specifically location requirements.

3. **Need to distinguish physical vs electronic**: If electronic storage with remote access is permitted, it's not a compliance issue.

### Sample Evidence

**Potential True Positive:**
- Citation: 10 NYCRR 6-2.18
- Quote: "records shall be maintained at the facility for 12 months"
- Analysis: Requires on-site storage at facility. If electronic storage with remote access is not permitted, this is burdensome.

### Recommended Changes

**ADD electronic exclusion:**
- Exclude if "electronic" or "digital" storage mentioned within 100 chars
- Exclude if "or offsite" mentioned

**Focus on:**
- `shall.{0,10}(be )?(kept|stored|maintained).{0,10}(at|on).{0,10}(premises|facility|site)`
- Look for MANDATORY on-site storage without electronic alternative

**Priority: MEDIUM** - Add electronic alternative detection.

---

## mail_only - 2025-12-31

### Configuration
- Display name: Mail-Only Submission
- Category: Communication
- Patterns tested: 10 (`must be mailed`, `shall be mailed`, `send by mail`, `submit.{0,20}by mail`, `mail.{0,10}only`, `u\.?s\.?\s*mail`, `\busps\b`, `first.{0,10}class.{0,10}mail`, `postal.{0,10}service`, `postmarked by`)

### Results
- Sample size: 6
- True positives: 1 (potential)
- False positives: 5
- **True positive rate: ~17%**

### Key Findings

1. **Many "shall be mailed" matches are OUTBOUND government mail**: "Notice shall be mailed by OAL to both parties" is the government mailing TO people, not requiring people to submit BY mail.

2. **"mailed or delivered/submitted" is common**: Most matches include alternatives like "mailed or submitted" or "mailed or delivered".

3. **"Postal Service" matches are often context**: References to the postal service as an organization, not a submission requirement.

### False Positive Categories

| Category | Description | Example |
|----------|-------------|---------|
| Outbound mail | Gov mailing TO citizens | N.J.A.C. 13:45A-26F.12 |
| With alternatives | "mailed or delivered" | 20 NYCRR 473.1 |
| With electronic | "mailed or submitted" | 13 NYCRR 22.5 |
| Entity reference | Mentioning Postal Service | Various |

### Sample Evidence

**Potential True Positive:**
- Citation: 9 NYCRR 10000.2
- Quote: "must be mailed...via a mail carrier service that provides proof of date of mailing"
- Analysis: Requires mailing with proof of date, no electronic option visible. This is a potential true positive.

**False Positive Example:**
- Citation: N.J.A.C. 13:45A-26F.12
- Quote: "Notice...shall be mailed by OAL to both parties"
- Why NOT burdensome: This is the government mailing TO parties, not a submission requirement.

### Recommended Changes

**ADD directionality filtering:**
- Exclude if "shall be mailed TO" or "mailed by [agency]" (outbound mail)
- Focus on "applicant shall mail" or "must be submitted by mail" (inbound requirements)

**ADD alternative exclusion:**
- Exclude if "or" appears within 30 chars: "mailed or delivered", "mailed or submitted"
- Exclude if "electronic" appears within 80 chars

**Focus patterns:**
- `(applicant|petitioner|person).{0,20}(must|shall).{0,15}mail`
- `submit.{0,15}by mail` (without "or")
- `only.{0,10}by mail`

**Priority: MEDIUM** - Add directionality and alternative detection.

---

## certified_mail - 2025-12-31

### Configuration
- Display name: Certified/Registered Mail
- Category: Communication
- Patterns tested: 9 (`certified mail`, `registered mail`, `return receipt`, `delivery confirmation`, etc.)

### Results
- Total matches: 1017
- With "or"/"and" alternatives: 788 (78%)
- Mandatory language: 276 (27%)
- **Estimated True positive rate: ~15-25%**

### Key Findings

1. **Most certified mail requirements have alternatives**: 78% of matches include "or" language (e.g., "registered or certified mail", "certified mail or personal service")

2. **Legal service of process is justified**: Many certified mail requirements are for serving legal notices where proof of delivery is legally required (appeals, violations, hearing notices)

3. **Outbound government mail is not a burden**: Many matches are "shall be mailed BY [agency] TO [recipient]" - government sending certified mail OUT, not requiring citizens to use it

4. **Pattern "by certified" catches "by certified check"**: Payment method (certified check) is different from certified mail

### False Positive Categories

| Category | Description | Example |
|----------|-------------|---------|
| Legal service | Service of process notices | 18 NYCRR 452.5 |
| Outbound mail | Gov mailing TO citizens | N.J.A.C. 13:45A-26F.12 |
| Payment method | "by certified check" | N.J.A.C. 7:26A-2.3 |
| With alternatives | "certified mail or personal service" | N.J.A.C. 7:30-11.3 |

### Recommended Changes

#### Regex Improvements

**REMOVE:**
- `by certified` - catches "by certified check"
- `return receipt` - too broad, catches many contexts

**ADD mandatory submission patterns:**
- `(applicant|petitioner|person).{0,30}(must|shall).{0,20}(send|submit|mail).{0,10}certified`
- `submit.{0,20}by certified mail`

**ADD exclusion logic:**
- Exclude if "shall be mailed TO" or "mailed by [agency]" (outbound)
- Exclude if "or personal service" appears (alternative exists)
- Exclude if legal service context (hearing notices, violations)

**Priority: LOW** - Certified mail requirements often serve legitimate legal purposes. Focus on administrative requirements without alternatives.

---

## in_person_hearing - 2025-12-31

### Configuration
- Display name: In-Person Hearing/Meeting
- Category: Physical Presence
- Patterns tested: 6 (`in.{0,3}person.{0,10}hearing`, `appear at.{0,20}hearing`, `attend in person`, etc.)

### Results
- Total matches: 247
- Mandatory attendance language: **1**
- Mentions remote options: 10
- "Right to hearing" language: 39
- **Estimated True positive rate: <5%**

### Key Findings

1. **Patterns match hearing mentions, not attendance requirements**: The patterns catch any document discussing hearings, not specifically requiring in-person attendance

2. **"Right to hearing" is common**: 39 of 247 matches are about granting the RIGHT to a hearing, not requiring attendance

3. **Remote options are already appearing**: 10 matches mention video/telephone/remote hearing options

4. **True mandatory in-person attendance is extremely rare**: Only 1 match has explicit "must attend in person" language

### Recommended Changes

#### Regex Improvements

**REMOVE:**
- `appear at.{0,20}hearing` - too broad, catches all hearing appearances

**REPLACE with:**
```yaml
patterns:
  # Mandatory in-person attendance
  - (must|shall|required).{0,20}attend.{0,15}in person
  - in.{0,3}person.{0,10}attendance.{0,10}(is |shall be )?required
  - no.{0,10}(remote|video|telephone).{0,10}(permitted|allowed)

exclusion_logic:
  - Exclude "right to" language
  - Exclude if video/telephone/remote mentioned as option
```

**Priority: LOW** - Very few true positives exist. Most hearing attendance is either optional or has remote alternatives.

---

## in_person_pickup - 2025-12-31

### Configuration
- Display name: In-Person Pickup
- Category: Physical Presence
- Patterns tested: 4 (`pick up in person`, `picked up in person`, `available for pickup`, etc.)

### Results
- Total matches: 438
- With mail alternative mentioned: 3
- Mandatory pickup language: 76
- **Estimated True positive rate: <5%**

### Key Findings

1. **"pick up" matches wrong contexts**: Matches include:
   - Casino card/tile handling ("cards shall be picked up by dealer")
   - Audio pickup (microphones)
   - Milk pickup (dairy farming)
   - Physical product pickup (stallion semen)

2. **Document pickup requirements are rare**: Most "pickup" references are about physical objects, not document retrieval

3. **"available for pickup" often has alternatives**: When documents are "available for pickup", mail is usually also offered

### False Positive Categories

| Category | Description | Example |
|----------|-------------|---------|
| Casino procedures | Cards/tiles picked up | N.J.A.C. 13:69F-10.7 |
| Audio equipment | "audio pickup" | 22 NYCRR 29.2 |
| Physical products | Milk, livestock semen | N.J.A.C. 2:32-2.4, 1 NYCRR 6.6 |
| Optional pickup | "available for pickup OR mail" | N.J.A.C. 10:88-5.2 |

### Recommended Changes

#### Regex Improvements

**REMOVE:**
- `available.{0,10}pick.{0,3}up` - mostly optional availability
- `picked up` - catches casino/physical procedures

**REPLACE with:**
```yaml
patterns:
  # Specific document/permit pickup
  - (permit|license|certificate|document).{0,30}(must|shall).{0,20}(be )?(picked up|pick.{0,3}up).{0,10}in person
  - (must|shall).{0,20}(pick up|retrieve).{0,20}(permit|license|certificate)

exclusion_logic:
  - Exclude casino-related contexts (cards, tiles, chips)
  - Exclude audio/video contexts
  - Exclude if "or mail" or "or electronic" appears
```

**Priority: MEDIUM** - Narrow patterns significantly to focus on document pickup requirements.

---

## notarization - 2025-12-31 (HIGH PRECISION ANALYSIS)

### Configuration
- Display name: Notarization Required
- Category: Signatures
- Patterns tested: 8 (`must be notarized`, `shall be notarized`, `duly notarized`, `\bnotarized\b`, etc.)
- **Reported Precision: 90.9%**

### Results
- Total matches: 579
- Mandatory language: 72 (12%)
- With alternatives: 181 (31%)
- Remote notarization mentioned: 5
- **Estimated True positive rate: ~85-90%**

### Key Findings - WHY THIS WORKS

1. **Terminology inherently implies requirement**: Unlike "fax" or "mail" where the term appears in many non-requirement contexts (contact info, options), "notarized" almost always describes something that IS required or WAS required to be done.

2. **Few false-positive contexts exist**: There's no common "notarized or electronic" alternative in regulations (unlike "mail or email")

3. **Participle form signals action required**: "The document must be notarized" vs "fax number available" - the grammatical structure inherently indicates requirement

4. **Alternatives are uncommon**: Only 5 of 579 matches mention remote/online notarization options

### What Makes High-Precision Patterns

| Factor | Low-Precision (fax) | High-Precision (notarization) |
|--------|---------------------|-------------------------------|
| Term meaning | Method that can be optional | Action that implies requirement |
| Common alternatives | "or email", "if available" | Rarely offered |
| Contact info usage | "fax number: xxx" | No contact info context |
| Participle form | Often used as option | Implies completion required |

### Lessons for Other Issue Types

1. **Focus on action verbs in past/passive form**: "shall be notarized", "must be witnessed" are higher precision than "fax", "mail"

2. **Avoid noun forms that appear in options**: "by fax OR email" vs "shall be notarized" (no common alternative)

3. **Consider grammatical context**: Requirements use passive voice ("shall be X") more than options

**Priority: NONE** - This issue type performs well. Use as template for improving others.

---

## physical_forms - 2025-12-31

### Configuration
- Display name: Physical Form Retrieval
- Category: Physical Presence
- Patterns tested: 4 (`forms available at`, `forms.{0,10}available.{0,10}at`, `obtain forms from`, etc.)

### Results
- Total matches: 26
- Documents also mentioning online/website: 7 (27%)
- **Estimated True positive rate: ~25-50%**

### Key Findings

1. **Many matches mention online availability**: 6 NYCRR 570.2 explicitly states "Forms are available at www.dec.ny.gov, all Department offices, or by writing" - offering three methods

2. **"Forms available at" is directionally ambiguous**: Some matches are about facilities making forms available TO the Department, not public form retrieval

3. **Small sample size**: Only 26 matches, so the issue type may have limited impact

### Sample Evidence

**FALSE POSITIVE Example:**
- Citation: 6 NYCRR 570.2
- Quote: "Forms are available at www.dec.ny.gov, all Department offices, or by writing"
- Why NOT burdensome: Online and mail alternatives explicitly offered

**POTENTIAL TRUE POSITIVE:**
- Citation: 7 NYCRR 701.7
- Quote: "A supply of inmate grievance complaint forms (form #2131) will be maintained in all special housing areas"
- Analysis: Physical forms in correctional facility context - potentially legitimate due to security

### Recommended Changes

**ADD online/mail exclusion:**
- Exclude if "online", "website", "www.", "download", or "by mail" appears within 100 chars

**ADD direction filtering:**
- Focus on "applicant/person must obtain" rather than "facility shall make available"

**Priority: LOW** - Small number of matches, many have online alternatives.

---

## wet_signature - 2025-12-31

### Configuration
- Display name: Wet Signature
- Category: Signatures
- Patterns tested: 12 (`wet signature`, `ink signature`, `handwritten signature`, `original signature`, etc.)

### Results
- Total matches: 161
- With explicit wet/ink/handwritten terms: 118 (73%)
- With electronic signature mentioned: 29 (18%)
- **Estimated True positive rate: ~50-60%**

### Key Findings

1. **Pattern catches EXCEPTIONS to wet signature**: Some matches are regulations ALLOWING alternatives:
   - "may use a signature stamp in place of a handwritten signature" (N.J.A.C. 13:21-7.5)
   - "except it need not contain an original signature" (22 NYCRR 500.14)

2. **"original signature" has good precision**: 118 of 161 matches use explicit wet signature terminology

3. **Context matters**: "handwritten" can appear in non-signature contexts (handwritten statements)

### False Positive Categories

| Category | Description | Example |
|----------|-------------|---------|
| Allowing alternatives | "in place of handwritten" | N.J.A.C. 13:21-7.5 |
| Exceptions | "need not contain original" | 22 NYCRR 500.14 |
| Non-signature context | Handwriting statements | Form guidance |

### Sample Evidence

**TRUE POSITIVE Example:**
- Citation: N.J.A.C. 8:41A-4.3
- Quote: "shall bear the original signature of the medical director"
- Why burdensome: Requires original signature, no electronic alternative mentioned

**FALSE POSITIVE Example:**
- Citation: N.J.A.C. 13:21-7.5
- Quote: "may use a signature stamp in place of a handwritten signature"
- Why NOT burdensome: This regulation ALLOWS an alternative to handwritten

### Recommended Changes

**ADD exclusion patterns:**
- Exclude if "in place of", "instead of", "need not", "except" precedes the wet signature term
- Exclude if "may use...alternative" appears

**ADD mandatory language requirement:**
- Focus on `(shall|must|required).{0,30}(original|wet|handwritten|ink).{0,10}signature`

**Priority: MEDIUM** - Good base precision but needs exclusion of "exception" contexts.

---

## original_document - 2025-12-31

### Configuration
- Display name: Original Document Required
- Category: Signatures
- Patterns tested: 9 (`no photocopies`, `original only`, `submit.{0,10}original`, `original document`, etc.)

### Results
- Total matches: 210
- With mandatory language: 68 (32%)
- With copy alternatives mentioned: 38 (18%)
- With certified copy context: 22 (10%)
- **Estimated True positive rate: ~40-50%**

### Key Findings

1. **"original" appears in non-document contexts**: "original design", "original jurisdiction", "original intent" are not document requirements

2. **Many allow copies as alternatives**: "an original or a copy" (N.J.A.C. 13:21-26.2) explicitly allows copies

3. **Some original requirements are legally justified**: Wills (22 NYCRR 207.19) require originals for legal reasons

### False Positive Categories

| Category | Description | Example |
|----------|-------------|---------|
| Non-document context | "original design" | 6 NYCRR 218-7.2 |
| Copy explicitly allowed | "original or a copy" | N.J.A.C. 13:21-26.2 |
| Legal necessity | Will probate | 22 NYCRR 207.19 |
| Certified copy accepted | "original or certified copy" | Various |

### Sample Evidence

**TRUE POSITIVE Example:**
- Citation: 13 NYCRR 11.9
- Quote: "Written contract--must be original"
- Why burdensome: Investment adviser client files require original contracts - copies would suffice

**FALSE POSITIVE Example:**
- Citation: N.J.A.C. 13:21-26.2
- Quote: "Proof of registration shall be an original or a copy"
- Why NOT burdensome: Explicitly allows copies as alternative

### Recommended Changes

**ADD context filtering:**
- Focus on `original.{0,10}(document|certificate|letter|copy|signature)` to avoid "original design" etc.
- Exclude if "or copy", "or certified", "or a copy" appears within 30 chars

**ADD mandatory language:**
- Focus on `(shall|must|required).{0,20}original.{0,15}(document|certificate|letter)`

**ADD justification detection:**
- Flag as JUSTIFIED if context includes: wills, bonds, negotiable instruments, chain of custody

**Priority: MEDIUM** - Good potential but needs context filtering to avoid non-document uses.

---

## obsolete_comm - 2025-12-31

### Configuration
- Display name: Obsolete Communication
- Category: Communication
- Patterns tested: 5 (`telegram`, `telegraph`, `\btelex\b`, `\bpager\b`, `\bbeeper\b`)

### Results
- Sample size: ~17
- True positives: 1
- False positives: ~16
- **True positive rate: ~5-10%**

### Pattern Match Distribution

| Pattern | Matches | Est. TPR | Notes |
|---------|---------|----------|-------|
| telegraph | 119 | ~0% | Matches "telegraph corporation" entity names |
| telegram | 54 | ~5% | Mostly historical/optional |
| pager | 12 | 0% | Matches prohibitions, expense categories |
| beeper | 7 | 0% | Vehicle backup beepers, prohibitions |
| telex | 2 | 50% | Only true positive found here |

### Key Findings

1. **"telegraph" matches entity type names**: 90%+ of matches are "telegraph corporation" or "telephone and telegraph company" - legal entity classifications, not technology requirements.

2. **"beeper" matches vehicle equipment**: Many matches are vehicle backup beepers in safety inspection rules, not communication devices.

3. **"pager" matches prohibitions**: Correctional facility rules prohibiting pagers are false positives.

4. **Only TRUE POSITIVE found**: 9 NYCRR 7903.4 requires serving orders "by telegram, telex, or telecopier" with no modern alternatives.

### Recommended Changes

#### Regex Improvements

**REMOVE or narrow:**
- `telegraph` - 95%+ are entity names ("telegraph corporation")

**ADD mandatory language:**
```yaml
patterns:
  - (shall|must).{0,20}(send|serve|notify).{0,20}(telegram|telex)
  - telegram.{0,10}(is |shall be )?required
```

**ADD exclusion logic:**
- Exclude "corporation", "company", "companies" context
- Exclude "prohibited", "shall not" context (prohibitions)
- Exclude "Reverse Light/Beeper" (vehicle equipment)

**Priority: LOW** - Very few true positives exist. Consider deprecating or narrowing significantly.

---

## landline - 2025-12-31

### Configuration
- Display name: Landline/Telephone Required
- Category: Communication
- Patterns tested: 7 (`\blandline\b`, `touch-tone`, `by telephone`, `telephone call`, `verbal authorization`, `oral authorization`, `by phone`)

### Results
- Sample size: ~20
- True positives: 2-3
- False positives: ~17
- **True positive rate: ~10-15%**

### Pattern Match Distribution

| Pattern | Matches | Est. TPR | Notes |
|---------|---------|----------|-------|
| by telephone | 742 | ~5% | Contact info, options, emergency |
| telephone call | 184 | ~10% | Many are notifications TO agencies |
| by phone | 55 | ~10% | Options, not requirements |
| oral authorization | 17 | ~30% | Some legitimate (prescriptions) |
| verbal authorization | 4 | ~25% | Similar to oral |
| touch-tone | 2 | ~50% | Specific, less noise |
| landline | 0 | N/A | Very rare term |

### Key Findings

1. **"by telephone" is too broad**: Matches contact info, optional methods, and emergency notifications. 742 matches but ~95% are not requirements.

2. **Emergency notifications are JUSTIFIED**: "shall immediately notify by telephone" for accidents, deaths, escapes - these genuinely require verbal contact.

3. **"or" alternatives common**: Many matches have "by telephone, fax, or other method" - alternatives exist.

4. **Direction matters**: "shall be notified by telephone" (agency TO person) is different from "shall notify by telephone" (person TO agency).

### Recommended Changes

#### Regex Improvements

**REMOVE:**
- `by telephone`, `by phone`, `telephone call` - too broad

**KEEP:**
- `\blandline\b`, `touch-tone` - specific

**ADD mandatory patterns with exclusions:**
```yaml
patterns:
  - (shall|must).{0,20}(notify|report).{0,20}by telephone

exclusion_logic:
  - Exclude if "or fax", "or email", "or other method" within 50 chars
  - Exclude if emergency context (death, accident, escape, fire)
```

**Priority: MEDIUM** - Narrow patterns significantly to avoid contact info and emergency notifications.

---

## carbon_copy - 2025-12-31

### Configuration
- Display name: Carbon/Duplicate Copy
- Category: Technology
- Patterns tested: 4 (`carbon copy`, `carbon.{0,5}copies`, `duplicate copy`, `duplicate copies`)

### Results
- Sample size: 11
- True positives: 4-5
- False positives: 6-7
- **True positive rate: ~40-45%**

### Pattern Match Distribution

| Pattern | Matches | Est. TPR | Notes |
|---------|---------|----------|-------|
| duplicate copy | 68 | ~30% | Ambiguous - sometimes just means "a copy" |
| duplicate copies | 42 | ~30% | Same issue |
| carbon copy | 7 | ~60% | More specific to actual carbon copies |
| carbon copies | 6 | ~60% | Same |

### Key Findings

1. **"Seattle Carbon Copy II" is a prosthetic foot**: N.J.A.C. 10:55-2.4 matches a product name, not a requirement.

2. **"duplicate copy" is ambiguous**: Sometimes means carbon copy (physical duplicate), sometimes just means "a copy" (photocopy acceptable).

3. **True positives exist**: 2 NYCRR 3.8 requires "in duplicate (original and carbon copy for payment)" - actual carbon copy requirement.

4. **Destruction policies are false positives**: "duplicate copies may be destroyed" is about retention, not creation.

### Sample Evidence

**TRUE POSITIVE:**
- Citation: 2 NYCRR 3.8
- Quote: "submitted to the Comptroller in duplicate (original and carbon copy for payment)"
- Why burdensome: Requires original AND carbon copy - modern copies would suffice

**FALSE POSITIVE:**
- Citation: N.J.A.C. 10:55-2.4
- Quote: "Seattle Carbon Copy II or equal"
- Why NOT burdensome: This is a prosthetic foot product name

### Recommended Changes

**ADD product name exclusion:**
- Exclude "Seattle Carbon Copy" (product name)

**ADD context filtering for "duplicate copy":**
- Focus on `(shall|must).{0,20}(file|submit).{0,20}duplicate cop` (submission requirements)
- Exclude "may be destroyed" (retention policies)

**Priority: MEDIUM** - Reasonable precision but needs filtering for product names and non-requirement contexts.

---

## microfiche - 2025-12-31

### Configuration
- Display name: Microfiche/Microfilm
- Category: Technology
- Patterns tested: 4 (`microfiche`, `microfilm`, `microform`, `aperture card`)

### Results
- Sample size: 6
- True positives: 2
- False positives: 4
- **True positive rate: ~33%**

### Key Findings

1. **Definition false positives**: Many matches list "microfilm" in definitions of what constitutes a "record" - not a requirement to use it.

2. **True positives exist for archival storage**: N.J.A.C. 8:70-3.3 requires "on microfilm permanently thereafter" - actual microfilm storage requirement.

3. **Microfilm standards regulation**: N.J.A.C. 15:3-3.1 establishes standards for microfilm production - regulation about microfilm use.

4. **Equipment definitions**: "microfiche copier" in equipment lists are not requirements.

### Sample Evidence

**TRUE POSITIVE:**
- Citation: N.J.A.C. 8:70-3.3
- Quote: "a minimum of five years as paper documents and on microfilm permanently thereafter"
- Why burdensome: Requires microfilm for permanent storage - digital alternatives not mentioned

**FALSE POSITIVE:**
- Citation: 14 NYCRR 510.4
- Quote: "papers, designs, drawings, maps, photos, letters, microfilms, computer tapes or discs"
- Why NOT burdensome: This is a definition of what constitutes "records", not a microfilm requirement

### Recommended Changes

**ADD mandatory storage language:**
```yaml
patterns:
  - (shall|must).{0,20}(stored|maintained|preserved).{0,20}(on |in )?(microfilm|microfiche)
  - microfilm.{0,10}(is |shall be )?required
```

**ADD exclusion logic:**
- Exclude equipment lists ("microfiche copier, photocopier")
- Exclude definition contexts ("records include...microfilm")

**Priority: LOW** - Low volume, mostly archival requirements. May be justified for permanent records.

---

## bulletin_board - 2025-12-31

### Configuration
- Display name: Bulletin Board
- Category: Physical Presence
- Patterns tested: 5 (`bulletin board`, `notice board`, `community board`, `public board`, `posted.{0,10}board`)

### Results
- Sample size: 10
- True positives: 2-3
- False positives: 7-8
- **True positive rate: ~25-30%**

### Pattern Match Distribution

| Pattern | Matches | Est. TPR | Notes |
|---------|---------|----------|-------|
| bulletin board | 58 | ~33% | Physical posting requirements |
| community board | 22 | ~0% | NYC governmental entities! |
| public board | 16 | ~20% | Mixed |
| notice board | 1 | ~50% | Rare |

### Key Findings

1. **"community board" matches NYC governmental entities**: All 22 matches are NYC Community Boards (advisory bodies), NOT physical bulletin boards. This pattern should be REMOVED.

2. **Electronic alternatives sometimes offered**: 9 NYCRR 466.15 mentions "bulletin board, or on an electronic bulletin board" - alternative exists.

3. **"electronic bulletin board" is a false positive**: N.J.A.C. 19:31T-1.2 refers to digital bulletin boards.

4. **True positives for workplace posting**: School and workplace posting requirements (N.J.A.C. 13:1-7.2) are true positives.

### Sample Evidence

**TRUE POSITIVE:**
- Citation: N.J.A.C. 7:30-9.12
- Quote: "notice shall be prominently posted at the central bulletin board"
- Why burdensome: Physical bulletin board required with no online alternative

**FALSE POSITIVE:**
- Citation: 9 NYCRR 118.1
- Quote: "Community board means an advisory body operating under the jurisdiction of the New York City government"
- Why NOT burdensome: This is a governmental entity, not a physical board

### Recommended Changes

#### Regex Improvements

**REMOVE immediately:**
- `community board` - matches NYC governmental entities (100% false positive rate)

**ADD electronic exclusion:**
- Exclude if "electronic bulletin board" appears
- Exclude if online/website alternative mentioned nearby

**NARROW to physical posting requirements:**
```yaml
patterns:
  - (shall|must).{0,20}(post|display).{0,20}(on |at ).{0,10}bulletin board
  - bulletin board.{0,20}(is |shall be )?required
```

**Priority: MEDIUM** - Remove "community board" pattern immediately. Add electronic alternative detection.

---

## Session Summary - 2025-12-31

### Issue Types Analyzed This Session

| Issue Type | Sample TPR | Matches | Priority | Key Issue |
|------------|------------|---------|----------|-----------|
| obsolete_comm | ~5-10% | 194 | LOW | "telegraph corporation" entity names |
| landline | ~10-15% | 1,004 | MEDIUM | Contact info, emergency notifications |
| carbon_copy | ~40-45% | 123 | MEDIUM | Product names, ambiguous "duplicate" |
| microfiche | ~33% | 130 | LOW | Definitions, equipment lists |
| bulletin_board | ~25-30% | 97 | MEDIUM | "community board" = NYC entity |

### Cross-Cutting Insights

1. **Entity/organization names cause false positives**: "telegraph corporation", "community board" (NYC entity) match the pattern but aren't requirements.

2. **Electronic alternatives detection is critical**: Many patterns would benefit from detecting "or electronic", "or online", "electronic bulletin board".

3. **Mandatory language helps but isn't sufficient**: "shall be mailed" vs "mail is an option" - need both mandatory language AND absence of alternatives.

4. **Context exclusions needed**: Emergency notifications, definitions, equipment lists, prohibitions are common false positive categories.

### Updated Progress

- **Completed**: 19 of 44 issue types (pdf_only, fax, typewriter, in_person_submission, witness, storage_location, mail_only, certified_mail, in_person_hearing, in_person_pickup, notarization, physical_forms, wet_signature, original_document, obsolete_comm, landline, carbon_copy, microfiche, bulletin_board)
- **Remaining**: 25 issue types

---

## physical_posting - 2025-12-31

### Configuration
- Display name: Physical Posting Required
- Category: Physical Presence
- Patterns tested: 9 (`conspicuously posted`, `conspicuously displayed`, `prominently displayed`, `prominently posted`, `posted on the premises`, `posted at all times`, `post a notice`, `display.{0,10}sign`, `visible to the public`)

### Results
- Sample size: 11
- True positives: 2-3
- False positives: 8-9 (but many are "lower priority" per the prompt design)
- **True positive rate: ~20-30%**

### Pattern Match Distribution

| Pattern | Matches | Notes |
|---------|---------|-------|
| conspicuously posted | 155 | License/safety postings |
| prominently displayed | 138 | On-site notices |
| conspicuously displayed | 91 | Similar |
| post a notice | 62 | Mixed purposes |
| prominently posted | 29 | Similar |
| visible to public | 25 | Lower volume |

### Key Findings

1. **Most matches are JUSTIFIED on-site notices**: Safety signs, license displays, workplace postings serve legitimate purposes for visitors/employees at the location.

2. **The prompt correctly identifies "lower priority"**: The prompt already notes that on-site informational notices are lower priority flags.

3. **Some true positives for general public notices**: Water quality contact info, job postings that could be online.

4. **Electronic alternatives sometimes exist**: 9 NYCRR 466.15 mentions "bulletin board, or on an electronic bulletin board".

### Sample Evidence

**JUSTIFIED (Lower Priority):**
- Citation: 10 NYCRR 6-2.4
- Quote: "placard...shall be conspicuously posted at all entrances leading to the bathing beach"
- Why justified: On-site safety notice for beach visitors

**TRUE POSITIVE:**
- Citation: 10 NYCRR 5-1.78
- Quote: "must post a notice that identifies a person and telephone number to contact for information on the monitoring results"
- Why burdensome: Public health information that could also be posted online

### Recommended Changes

**ADD online alternative detection:**
- Reduce severity if "website", "online", "electronic" posting also mentioned
- Flag only if physical is the SOLE method for general public notices

**Priority: LOW** - Most matches are legitimate on-site notices; prompt already handles this well.

---

## check_payment - 2025-12-31

### Configuration
- Display name: Check/Money Order Payment
- Category: Payment
- Patterns tested: 5 (`money order`, `certified check`, `cashier.{0,3}s? check`, `personal check`, `payable to`)

### Results
- Sample size: 11
- True positives: 4-5
- False positives: 6-7
- **True positive rate: ~40-45%**

### Pattern Match Distribution

| Pattern | Matches | Est. TPR | Notes |
|---------|---------|----------|-------|
| payable to | 711 | ~10% | Very broad - just says who to pay |
| money order | 432 | ~40% | Often paired with alternatives |
| certified check | 82 | ~35% | Many have flexibility clauses |
| personal check | 20 | ~50% | More specific |
| cashiers check | 11 | ~50% | More specific |

### Key Findings

1. **"payable to" is too broad**: Just describes payment recipient, not method. 711 matches with low TPR.

2. **Flexibility clauses are common**: "or such other form as the Department deems suitable" negates the requirement.

3. **True positives exist**: N.J.A.C. 5:17-5.3 requires "check or money order" with no electronic option.

4. **Some have electronic options**: N.J.A.C. 4A:4-2.17 mentions "credit card or e-check" alongside check/money order.

### Recommended Changes

**REMOVE:**
- `payable to` - too broad, low TPR

**ADD alternative detection:**
- Exclude if "credit card", "e-check", "electronic payment", "online" mentioned nearby
- Exclude flexibility clauses ("or such other form")

**Priority: MEDIUM** - Remove "payable to" pattern; add electronic alternative detection.

---

## waiting_period - 2025-12-31

### Configuration
- Display name: Mandatory Waiting Period
- Category: Process
- Patterns tested: 7 (`waiting period`, `must wait`, `cooling off`, `no sooner than`, `not sooner than`, `minimum of.{0,10}days before`, `at least.{0,10}days before`)

### Results
- Sample size: 11
- True positives: 1-2
- False positives: 9-10
- **True positive rate: ~15-20%**

### Pattern Match Distribution

| Pattern | Matches | Est. TPR | Notes |
|---------|---------|----------|-------|
| waiting period | 159 | ~20% | Often insurance-related |
| no sooner than | 77 | ~5% | Technical/due process |
| not sooner than | 18 | ~5% | Same |
| must wait | 11 | ~30% | More specific |
| cooling off | 1 | ~100% | Very specific |

### Key Findings

1. **Insurance waiting periods dominate**: Pre-existing condition periods, disability claim periods - these are insurance underwriting, not regulatory burden.

2. **"no sooner than" is technical/due process**: Environmental testing intervals, hearing scheduling - legitimate technical or procedural requirements.

3. **Some FALSE POSITIVES remove waiting periods**: N.J.A.C. 10:54-5.42 says "There is no 30 day waiting period required" - actually eliminating a wait!

4. **Low true positive rate**: Most waiting periods have legitimate rationale (technical, safety, due process).

### Sample Evidence

**FALSE POSITIVE:**
- Citation: N.J.A.C. 10:54-5.42
- Quote: "There is no 30 day waiting period required"
- Why NOT burdensome: This is REMOVING a waiting period

**JUSTIFIED:**
- Citation: N.J.A.C. 7:28-27.13
- Quote: "short-term radon test is conducted no sooner than 24 hours after a mitigation system is installed"
- Why justified: Technical requirement for accurate measurement

### Recommended Changes

**NARROW patterns:**
- Focus on arbitrary administrative waits, not technical intervals
- Exclude insurance contexts ("pre-existing", "underwriting")
- Exclude technical testing intervals ("sample", "test", "measure")

**ADD exclusion for removal language:**
- Exclude "no...waiting period required", "waiting period is waived"

**Priority: LOW** - Most waiting periods are justified; low TPR makes this inefficient.

---

## physical_log - 2025-12-31

### Configuration
- Display name: Physical Log/Sign-in
- Category: Process
- Patterns tested: 9 (`sign-in sheet`, `sign in sheet`, `log book`, `\blogbook\b`, `visitor log`, `sign the register`, `entry log`, `written log`, `daily log`)

### Results
- Sample size: 6
- True positives: 4-5
- False positives: 1-2
- **True positive rate: ~70-80%**

### Pattern Match Distribution

| Pattern | Matches | Notes |
|---------|---------|-------|
| log book | 79 | Lab records, access logs |
| daily log | 41 | Operational logs |
| sign-in sheet | 12 | Visitor/access tracking |
| written log | 7 | Specific to physical |
| visitor log | 5 | Access tracking |

### Key Findings

1. **High TPR**: Most "log book" requirements could be satisfied by electronic systems.

2. **Common contexts**: Laboratory calibration logs, casino access logs, juvenile facility admission records.

3. **Section titles are false positives**: "Master log book" as section heading.

4. **Electronic alternatives rarely mentioned**: Most regulations don't explicitly allow electronic logging.

### Sample Evidence

**TRUE POSITIVE:**
- Citation: N.J.A.C. 7:18-5.5
- Quote: "laboratory shall record in a log book the date on which it performed the check"
- Why burdensome: Electronic laboratory information systems could track this

**TRUE POSITIVE:**
- Citation: 9 NYCRR 5314.3
- Quote: "entry log book shall include, at a minimum, the: date and time of entering"
- Why burdensome: Electronic access control systems could capture this automatically

### Recommended Changes

**GOOD PRECISION** - Keep patterns as is.

**ADD electronic alternative detection:**
- Reduce severity if "electronic", "computerized", "automated" logging permitted

**Priority: LOW** - Good precision, low total volume. Could add more patterns for completeness.

---

## embossed_seal - 2025-12-31

### Configuration
- Display name: Embossed Seal/Stamp
- Category: Signatures
- Patterns tested: 6 (`embossed seal`, `raised seal`, `impressed seal`, `corporate seal`, `official seal`, `seal.{0,5}affixed`)

### Results
- Sample size: 10
- True positives: 3-4
- False positives: 6-7
- **True positive rate: ~35-40%**

### Pattern Match Distribution

| Pattern | Matches | Est. TPR | Notes |
|---------|---------|----------|-------|
| official seal | 63 | ~20% | Product certification, inspection |
| corporate seal | 31 | ~60% | Form templates, deeds |
| raised seal | 11 | ~50% | Notary seals |
| seal affixed | 8 | ~60% | Document requirements |
| embossed seal | 3 | ~67% | Specific |

### Key Findings

1. **"official seal" matches product certification**: "Seal of Quality" for eggs, meat inspection seals - these are product labels, not document requirements.

2. **"corporate seal" in form templates**: Many matches are template placeholders "[Corporate Seal]" showing where seal goes.

3. **Deeds may legitimately require seals**: Some states still require corporate seals on real estate documents.

4. **Accounting false positives**: "Stock and minute books and corporate seal" as asset classification.

### Sample Evidence

**TRUE POSITIVE:**
- Citation: N.J.A.C. 7:26A-3.4
- Quote: "[Corporate Seal]" in surety bond template
- Why burdensome: Many states have abolished corporate seal requirements

**FALSE POSITIVE:**
- Citation: 1 NYCRR 162.16
- Quote: "must have affixed the official seal designation"
- Why NOT burdensome: This is a product quality certification label, not document seal

### Recommended Changes

**ADD context exclusions:**
- Exclude "Seal of Quality" (product certification)
- Exclude "minute books and corporate seal" (accounting)
- Exclude "inspection seal" (product inspection)

**NARROW to document seals:**
```yaml
patterns:
  - (shall|must).{0,20}(affix|bear|have).{0,20}(corporate|official|embossed) seal
  - \[Corporate [Ss]eal\]  # Form templates
```

**Priority: MEDIUM** - Moderate precision; needs context filtering for product vs document seals.

---

## Session 2 Summary - 2025-12-31

### Issue Types Analyzed This Session

| Issue Type | Sample TPR | Matches | Priority | Key Issue |
|------------|------------|---------|----------|-----------|
| physical_posting | ~20-30% | 503 | LOW | Most are justified on-site notices |
| check_payment | ~40-45% | 1,256 | MEDIUM | "payable to" too broad |
| waiting_period | ~15-20% | 266 | LOW | Insurance/technical contexts justified |
| physical_log | ~70-80% | 150 | LOW | High precision, good patterns |
| embossed_seal | ~35-40% | 116 | MEDIUM | Product certification false positives |

### Updated Progress

- **Completed**: 24 of 44 issue types
- **Remaining**: 20 issue types

---

## obsolete_media - 2025-12-31

### Configuration
- Display name: Obsolete Storage Media
- Category: Technology
- Patterns tested: 8 (`floppy.{0,5}disk`, `\bdiskette\b`, `cd-rom`, `\bdvd\b`, `magnetic.{0,5}tape`, `usb drive`, `flash drive`, `punch.{0,5}card`)

### Results
- Sample size: 9
- True positives: 3-4
- False positives: 5-6
- **True positive rate: ~35-40%**

### Pattern Match Distribution

| Pattern | Matches | Est. TPR | Notes |
|---------|---------|----------|-------|
| magnetic tape | 32 | ~25% | Often storage options, fee descriptions |
| cd-rom | 26 | ~40% | Some requirements, some alternatives |
| flash drive | 14 | ~30% | Not really obsolete |
| punch card | 12 | ~50% | Truly obsolete |
| floppy disk | 7 | ~60% | Truly obsolete |

### Key Findings

1. **Specific tape formats are true positives**: 15 NYCRR 34.5 requires "1/2 inch magnetic tape; nine track; 6250 BPI; EBCDIC encoded" - very specific obsolete format.

2. **CD-ROM often has electronic alternatives**: Many regulations mention CD-ROM alongside email or electronic submission.

3. **"flash drive" and "usb drive" aren't really obsolete**: These are still commonly used - consider removing from "obsolete" category.

4. **Equipment definitions are false positives**: 8 NYCRR 144.8 lists "CD-ROM and videodisc devices" as equipment types.

### Sample Evidence

**TRUE POSITIVE:**
- Citation: 15 NYCRR 34.5
- Quote: "1/2 inch magnetic tape; nine track; 6250 BPI; EBCDIC encoded"
- Why burdensome: Extremely specific obsolete tape format

**FALSE POSITIVE:**
- Citation: N.J.A.C. 7:27-26.8
- Quote: "submitted electronically, by email, on diskette, or on CD-ROM"
- Why NOT burdensome: Electronic alternatives clearly offered

### Recommended Changes

**REMOVE or recategorize:**
- `usb drive`, `flash drive` - not obsolete, still commonly used

**ADD electronic alternative detection:**
- Exclude if "electronically", "by email", "online" mentioned nearby

**Priority: MEDIUM** - Remove non-obsolete media; add alternative detection.

---

## handwriting_specs - 2025-12-31

### Configuration
- Display name: Handwriting Specifications
- Category: Document Format
- Patterns tested: 6 (`block letters`, `print clearly`, `print in ink`, `hand-printed`, `hand printed`, `indelib`)

### Results
- Sample size: 11
- True positives: 2-3
- False positives: 8-9
- **True positive rate: ~25%**

### Pattern Match Distribution

| Pattern | Matches | Est. TPR | Notes |
|---------|---------|----------|-------|
| indelible | 48 | ~40% | Product labeling, some document requirements |
| block letters | 12 | ~0% | All are SIGNAGE, not handwriting! |
| print clearly | 1 | ~50% | Very low volume |

### Key Findings

1. **"block letters" matches SIGNAGE, not handwriting**: All 12 matches are exit sign requirements, vehicle signs, product labels - NOT document handwriting requirements. This is a major false positive pattern.

2. **"indelible" often for product/container labeling**: Hazardous waste containers, hunting tags, manufacturing marks - these are justified for durability.

3. **Some true positives for document requirements**: N.J.A.C. 8:8-13.5 requires medical records "prepared with indelible material".

### Sample Evidence

**FALSE POSITIVE:**
- Citation: 12 NYCRR 45-4.3
- Quote: "exit sign shall be worded in plainly legible block letters, at least six inches high"
- Why NOT burdensome: This is EXIT SIGN specifications, not document handwriting

**TRUE POSITIVE:**
- Citation: 6 NYCRR 1.31
- Quote: "fill out completely, using indelible ink, the bear carcass tag"
- Why burdensome: Outdoor tag that modern materials could replace

### Recommended Changes

**REMOVE immediately:**
- `block letters` - 100% false positive rate for handwriting (all are signage)

**NARROW "indelible" to document context:**
- Add patterns: `(record|document|form).{0,20}indelib`
- Exclude: "indelibly marked", "indelibly branded" (product marking)

**Priority: HIGH** - Remove "block letters" pattern immediately.

---

## letterhead - 2025-12-31

### Configuration
- Display name: Letterhead Required
- Category: Document Format
- Patterns tested: 4 (`on letterhead`, `official letterhead`, `company letterhead`, `agency letterhead`)

### Results
- Sample size: 6
- True positives: 4-5
- False positives: 1-2
- **True positive rate: ~70%**

### Pattern Match Distribution

| Pattern | Matches | Notes |
|---------|---------|-------|
| official letterhead | 20 | Agency/medical letterhead |
| company letterhead | 18 | Business verification |
| on letterhead | 14 | General |
| agency letterhead | 10 | Government letterhead |

### Key Findings

1. **High precision patterns**: Most matches are actual letterhead requirements.

2. **Common contexts**: Income verification letters, medical records, casino supplier requests, organization certifications.

3. **Some serve legitimate verification**: Employment letters on company letterhead help verify identity/income.

4. **Electronic alternatives rarely mentioned**: Most don't offer digital signature alternatives.

### Sample Evidence

**TRUE POSITIVE:**
- Citation: N.J.A.C. 13:69E-1.28R
- Quote: "Written requests shall be on company letterhead"
- Why burdensome: Digital submission with verification could work

**BORDERLINE:**
- Citation: 6 NYCRR 177.2
- Quote: "letter from a current employer on company letterhead"
- Why borderline: Serves identity verification purpose but could use digital methods

### Recommended Changes

**GOOD PRECISION** - Keep patterns as is.

**ADD electronic alternative language:**
- Look for "digital signature", "electronic verification" as mitigation

**Priority: LOW** - High precision, low volume. Works well as is.

---

## paper_specs - 2025-12-31

### Configuration
- Display name: Paper Specifications
- Category: Document Format
- Patterns tested: 9 (`8\.?5.{0,5}x.{0,5}11`, `letter size`, `8\.?5.{0,5}x.{0,5}14`, `legal size`, `bond paper`, `20 lb`, `paper stock`, `white paper`, `colored paper`)

### Results
- Sample size: 8
- True positives: 1-2
- False positives: 6-7
- **True positive rate: ~15-20%**

### Pattern Match Distribution

| Pattern | Matches | Est. TPR | Notes |
|---------|---------|----------|-------|
| paper stock | 21 | ~10% | Lottery tickets, registration paper |
| letter size | 18 | ~15% | Mostly fee schedules! |
| white paper | 16 | ~20% | Mixed |
| legal size | 12 | ~15% | Fee schedules |
| bond paper | 8 | ~30% | Some actual requirements |
| 20 lb | 7 | ~30% | Weight specifications |

### Key Findings

1. **"letter size" mostly matches FEE SCHEDULES**: "$0.05 per letter size page" - this is copying fees, not paper requirements.

2. **"paper stock" matches manufacturing specs**: Lottery tickets "on official paper stock", registration paper - not document submission requirements.

3. **Low true positive rate overall**: Most patterns match fees, manufacturing, or signage rather than document submission requirements.

### Sample Evidence

**FALSE POSITIVE:**
- Citation: N.J.A.C. 19:9-4.3
- Quote: "$0.05 per letter size page, $0.07 per legal size page"
- Why NOT burdensome: This is a FEE SCHEDULE, not a paper requirement

**TRUE POSITIVE:**
- Citation: N.J.A.C. 13:8-1.4
- Quote: "printed on no smaller than letter size paper"
- Why burdensome: Specifies paper size for poster

### Recommended Changes

**NARROW patterns significantly:**
- Add mandatory language: `(shall|must).{0,20}(printed|submitted).{0,20}(on |using ).{0,10}(letter|legal) size`
- Exclude fee contexts: `\$.*per.*(letter|legal) size`

**REMOVE low-precision patterns:**
- `paper stock` - matches manufacturing, not document requirements

**Priority: MEDIUM** - Low precision; needs significant narrowing or removal.

---

## routing_slip - 2025-12-31

### Configuration
- Display name: Routing/Transmittal Slip
- Category: Process
- Patterns tested: 3 (`transmittal form`, `transmittal sheet`, `cover.{0,10}sheet`)

### Results
- Sample size: 9
- True positives: 4-5
- False positives: 4-5
- **True positive rate: ~50%**

### Pattern Match Distribution

| Pattern | Matches | Est. TPR | Notes |
|---------|---------|----------|-------|
| cover sheet | 35 | ~40% | Mixed - some requirements, some descriptions |
| transmittal form | 25 | ~50% | Document tracking forms |
| transmittal sheet | 4 | ~50% | Similar |

### Key Findings

1. **Form descriptions are false positives**: Section titles, form instructions ("This transmittal form is for use by...").

2. **True positives exist**: 18 NYCRR 459.9 requires "recorded on the return transmittal form prescribed by the department".

3. **Some serve legitimate workflow purposes**: Appeals filings, child support case transfers.

4. **Electronic alternatives rarely mentioned**: Most assume physical paper workflow.

### Sample Evidence

**TRUE POSITIVE:**
- Citation: N.J.A.C. 1:20-8.1
- Quote: "completed transmittal form, two copies of the petition"
- Why burdensome: Physical transmittal form plus multiple copies required

**FALSE POSITIVE:**
- Citation: Form 167588
- Quote: "This transmittal form is for use by either the initiating or responding jurisdiction"
- Why NOT burdensome: This is FORM INSTRUCTIONS, not a requirement

### Recommended Changes

**ADD mandatory language:**
```yaml
patterns:
  - (shall|must).{0,20}(submit|include|attach).{0,20}(transmittal|cover).{0,10}(form|sheet)
```

**EXCLUDE form instructions:**
- Exclude "This...form is for use by", "PURPOSE OF THE FORM"

**Priority: LOW** - Moderate precision, low volume.

---

## Session 3 Summary - 2025-12-31

### Issue Types Analyzed This Session

| Issue Type | Sample TPR | Matches | Priority | Key Issue |
|------------|------------|---------|----------|-----------|
| obsolete_media | ~35-40% | 91 | MEDIUM | USB/flash not obsolete; alternatives offered |
| handwriting_specs | ~25% | 64 | HIGH | "block letters" = signage, 0% TPR |
| letterhead | ~70% | 62 | LOW | Good precision |
| paper_specs | ~15-20% | 83 | MEDIUM | Fee schedules, manufacturing false positives |
| routing_slip | ~50% | 64 | LOW | Form instructions false positives |

### Immediate Actions Needed

1. **REMOVE "block letters"** from handwriting_specs - 100% false positive (signage, not handwriting)
2. **REMOVE "usb drive", "flash drive"** from obsolete_media - not obsolete
3. **REMOVE "payable to"** from check_payment (from previous session)
4. **REMOVE "community board"** from bulletin_board (from previous session)

### Updated Progress

- **Completed**: 29 of 44 issue types
- **Remaining**: 15 issue types

---

---

## Session 4: Concurrent Agent Analysis - 2025-12-31

### Overview
15 remaining issue types analyzed using 4 concurrent background agents.

### HIGH-PRECISION Issue Types (Keep All Patterns)

| Issue Type | TPR | Key Finding |
|------------|-----|-------------|
| **binding_required** | **100%** | All patterns (spiral bound, three-ring binder, ring binder) have excellent precision - always a genuine document format requirement |
| **multiple_copies** | **100%** | All patterns (in duplicate, in triplicate, three/four/five copies) have excellent precision |
| **surety_bond** | **100%** | All patterns have high precision, though many matches are JUSTIFIED (financial services, environmental) |
| **newspaper** | **100%** | All patterns (newspaper of general circulation, official newspaper) have excellent precision |

### MEDIUM-PRECISION Issue Types (Need Refinement)

| Issue Type | TPR | Patterns to REMOVE | Patterns to KEEP |
|------------|-----|-------------------|------------------|
| experience_requirements | 83% | None (minor refinement for institutional context) | All |
| incorporation_by_reference | 70% | Refine to avoid "incorporated herein by reference as Appendix" | NFPA, ASTM, ANSI, adopted by reference |
| mandated_reports | 67% | `report to the` (too broad - matches parole, board reporting) | annual/quarterly report, submit/file a report, reporting requirements |
| non_refundable_fees | 50% | `forfeited.{0,10}(fee|deposit|payment)` (matches stock terminology) | non-?refundable, fee shall not be refund |
| photo_specs | 43% | `2.{0,3}x.{0,3}2` (matches flooring specs, DSM codes) | `passport photo`, `passport.{0,20}photo` |
| physical_inspection | 40% | `during business hours` (standalone), `public inspection` (standalone) | `available for public inspection`, `maintain for inspection` |

### LOW-PRECISION Issue Types (Need Major Revision)

| Issue Type | TPR | Root Cause | Recommendation |
|------------|-----|------------|----------------|
| fixed_window | 33% | `only during`, `filing period` match tax deadlines, general schedules | Remove `only during`, `filing period` |
| no_credit_cards | 33% | `cash or check only` has directional ambiguity (paying vs accepting) | Add context: `(fee|payment|accept).{0,30}(no credit card|cash or check only)` |
| cash_only | 17% | `cash-only cases` is a benefit category, not payment requirement | Require payment context |
| obsolete_software | 0% | Only 2 matches; ASCII is not obsolete | Remove `ascii.{0,10}format`, `\bdos\b` |
| in_person_payment | 0% | Only 1 match (false positive); `in.{0,3}person.{0,10}payment` matches across sentence boundaries | Expand patterns or deprecate |

### Patterns to REMOVE (Summary)

```yaml
# Remove from fixed_window
- only during  # Too vague
- filing period  # Matches tax deadlines

# Remove from obsolete_software
- ascii.{0,10}format  # ASCII is not obsolete
- \bdos\b  # Matches "dos and don'ts"

# Remove from mandated_reports
- report to the  # Matches parole reporting, board reporting

# Remove from photo_specs
- 2.{0,3}x.{0,3}2  # Matches flooring specs, DSM codes, any 2x2

# Remove from physical_inspection
- during business hours  # Matches scheduling, not inspection requirements
- public inspection  # Too broad standalone

# Remove from non_refundable_fees
- forfeited.{0,10}(fee|deposit|payment)  # Matches stock/securities terminology

# Remove from no_credit_cards
- cash or check only  # Directional ambiguity
```

### Additional Research Findings

**Cloud Data Transfer Opportunities:**
- 585 documents require mail/deliver/submit physical copies WITHOUT mentioning electronic alternatives
- Most are outbound notices (agency TO person), not submission requirements
- Potential new issue type: `physical_media_submission` for cases requiring discs, flash drives, etc.

**Community Input Requirements:**
- 1,104 documents mention public hearing/comment/community input
- Only 58 have mandatory hearing language ("public hearing shall be held")
- Most are legitimate procedural safeguards (healthcare, fiscal oversight, environmental)
- NOT recommended as a new issue type - low false positive opportunity

### Progress Update
- **Completed**: 44 of 44 working prompts analyzed
- **High-precision (100% TPR)**: binding_required, multiple_copies, surety_bond, newspaper
- **Patterns identified for removal**: 11 specific patterns across 7 issue types
- **New issue type potential**: non_refundable_fees (created), physical_media_submission (research)

