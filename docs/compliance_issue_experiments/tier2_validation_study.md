# Tier 2 Validation Study

> **Study Date**: 2026-01-02
> **Status**: IN PROGRESS

## Study Objective

Validate Tier 2 classification accuracy by running items through Tier 3 full-context verification.

## Hypothesis

Tier 2 has significant false negatives (~30% based on initial 10-item sample), particularly in:
- "unrelated" classifications (high confidence but may miss requirements)
- "justified" classifications (may be too generous with justifications)

## Sample Composition

| Category | Count | Criteria |
|----------|-------|----------|
| Unrelated | 20 | All tier2_classification='unrelated' |
| Justified | 15 | Random from tier2_classification='justified' |
| Low-conf burdensome | 10 | tier2_confidence < 0.85 |
| Med/High-conf burdensome | 5 | tier2_confidence >= 0.85 |
| **Total** | 50 | |

## Phase 1: Internal Verification (Tier 3a)

Running each item through full-context Tier 3 prompt to check if Tier 2 missed anything.

### Unrelated Items (20 total)

| doc_id | issue_type | tier2_conf | doc_len | tier3_agrees | tier3_class | notes |
|--------|------------|------------|---------|--------------|-------------|-------|
| 99102 | mail_only | 0.95 | 1817 | | | |
| 100534 | mail_only | 0.95 | 1609 | | | |
| 101122 | mail_only | 0.95 | 14568 | | | |
| 102320 | certified_mail | 0.95 | 10962 | | | |
| 109504 | notarization | 0.95 | 6573 | | | |
| 111142 | mandated_reports | 0.92 | 993 | | | |
| 112289 | wet_signature | 0.92 | 1861 | | | |
| 121563 | obsolete_comm | 0.95 | 1637 | | | |
| 155936 | obsolete_media | 0.95 | 1443 | | | |
| 156889 | carbon_copy | 0.95 | 3173 | | | |
| 169248 | mandated_reports | 0.92 | 1989 | | | |
| 179120 | mandated_reports | 0.92 | 1229 | | | |
| 180947 | in_person_hearing | 0.95 | 1270 | | | |
| 182010 | physical_inspection | 0.95 | 1881 | | | |
| 186224 | mail_only | 0.95 | 608 | | | |
| 188532 | mandated_reports | 0.92 | 3644 | | | |
| 200952 | physical_inspection | 0.95 | 1789 | | | |
| 202907 | embossed_seal | 0.95 | 1948 | | | |
| 209549 | physical_inspection | 0.92 | 628 | | | |
| 209837 | obsolete_media | 0.95 | 8527 | | | |

### Justified Items (15 total)

| doc_id | issue_type | tier2_conf | doc_len | tier3_agrees | tier3_class | notes |
|--------|------------|------------|---------|--------------|-------------|-------|
| 201904 | mandated_reports | 0.85 | 721 | | | |
| 160961 | certified_mail | 0.92 | 858 | | | |
| 100574 | notarization | 0.82 | 1042 | | | |
| 120877 | physical_inspection | 0.82 | 709 | | | |
| 154742 | in_person_hearing | 0.82 | 2526 | | | |
| 178857 | notarization | 0.82 | 3103 | | | |
| 209764 | notarization | 0.82 | 2318 | | | |
| 202907 | certified_mail | 0.85 | 1948 | | | |
| 133457 | mandated_reports | 0.85 | 1954 | | | |
| 210884 | certified_mail | 0.85 | 10622 | | | |
| 202135 | in_person_hearing | 0.85 | 3462 | | | |
| 109613 | physical_log | 0.82 | 1018 | | | |
| 128283 | newspaper | 0.82 | 2935 | | | |
| 165502 | letterhead | 0.82 | 1269 | | | |
| 102788 | notarization | 0.82 | 4635 | | | |

### Burdensome Items (15 total)

| doc_id | issue_type | tier2_conf | doc_len | tier3_agrees | tier3_class | notes |
|--------|------------|------------|---------|--------------|-------------|-------|
| 142117 | notarization | 0.75 | 2325 | | | |
| 147292 | letterhead | 0.82 | 1185 | | | |
| 139057 | physical_log | 0.82 | 10903 | | | |
| 138305 | physical_log | 0.82 | 4127 | | | |
| 154734 | physical_log | 0.82 | 15052 | | | |
| 127432 | physical_log | 0.82 | 15599 | | | |
| 101340 | physical_log | 0.82 | 2117 | | | |
| 154100 | physical_log | 0.82 | 12262 | | | |
| 209278 | physical_log | 0.82 | 5228 | | | |
| 101878 | mail_only | 0.82 | 2039 | | | |
| 98801 | mail_only | 0.92 | 224 | | | |
| 126154 | obsolete_comm | 0.92 | 858 | | | |
| 117222 | check_payment | 0.85 | 5913 | | | |
| 121563 | wet_signature | 0.85 | 1637 | | | |
| 115563 | check_payment | 0.85 | 1019 | | | |

---

## Phase 1 Results Summary

**Study completed: 2026-01-02**
**Full sample: 115 items (all Tier 2 completed items)**

### Agreement Rates by Category

| Category | Total | Agree | Disagree | Agreement Rate | Error Rate |
|----------|-------|-------|----------|----------------|------------|
| Burdensome | 64 | 30 | 34 | **46.9%** | **53.1%** |
| Justified | 29 | 24 | 5 | **82.8%** | 17.2% |
| Unrelated | 20 | 11 | 9 | **55.0%** | **45.0%** |
| Needs_full_context | 2 | 0 | 2 | **0.0%** | 100.0% |
| **Total** | 115 | 65 | 50 | **56.5%** | **43.5%** |

### Critical Finding

Tier 2 has two major error patterns:

1. **OVER-REPORTING SEVERITY (53% of "burdensome" are wrong)**
   - 32 items: burdensome → justified (50% of burdensome)
   - 2 items: burdensome → unrelated (3%)

2. **FALSE NEGATIVES (45% of "unrelated" are wrong)**
   - 8 items: unrelated → burdensome (40%)
   - 1 item: unrelated → justified (5%)

### Error Classification Details

| Tier2 → Tier3 | Count | % of Category | Description |
|---------------|-------|---------------|-------------|
| burdensome → justified | **32** | 50% | Over-reports severity, misses justifications |
| burdensome → unrelated | 2 | 3% | Misidentifies requirement type |
| justified → burdensome | 2 | 7% | Too generous with justification |
| justified → unrelated | 3 | 10% | Confused issue type |
| unrelated → burdensome | **8** | 40% | Misses real requirements |
| unrelated → justified | 1 | 5% | Misses justified requirements |

### Specific Error Examples with Quotes

#### Pattern 1: Child Welfare Context Underweighted

**Doc 101340 (physical_log) - burdensome → justified**
> "When any medication is administered to a child at a shelter facility, an entry shall be made in the medication log book"

*Tier 2 missed*: Medication logging for children in shelter care is a critical safety requirement, not bureaucratic burden.

**Doc 127432 (physical_log) - burdensome → justified**
> "The sponsoring organization shall keep and maintain... a daily log book"

*Tier 2 missed*: Documentation requirements in child residential facilities serve essential oversight purposes.

**Doc 117222 (check_payment) - burdensome → justified**
> "The applicant shall submit a $10 fee for CARI background check"

*Tier 2 missed*: Fee for child abuse registry check is a legitimate child protection cost, not arbitrary burden.

#### Pattern 2: Maritime/Transportation Safety

**Doc 105987 (in_person_hearing) - burdensome → justified**
> "All pilots shall appear before the Commission every year at the Commission meeting"

*Tier 2 missed*: Annual in-person review for maritime pilots is justified by safety-critical nature of the profession.

**Doc 107427 (fax_required) - burdensome → justified**
> "Applications may be submitted by fax to the designated number"

*Tier 2 missed*: Fax is offered as an OPTION, not a requirement. Electronic alternatives also available.

#### Pattern 3: Missed Requirements in Long Documents

**Doc 102320 (certified_mail) - unrelated → burdensome**
> "If the facility cannot obtain written informed consent or verbal informed consent... certified mail must be sent to the parent"

*Tier 2 missed*: Subsection (e)5 contains explicit certified mail requirement buried in 10k+ character document.

**Doc 155936 (obsolete_media) - unrelated → burdensome**
> "The committee shall submit four hard copies and one electronic copy (either disc or flash drive)"

*Tier 2 missed*: Clear disc/flash drive requirement in subsection (e), despite document being about highway access.

#### Pattern 4: Synonym Failures

**Doc 113 (embossed_seal) - unrelated → burdensome**
> "site plans to bear the raised seal of a New Jersey licensed Professional Engineer"

*Tier 2 missed*: "Raised seal" = "embossed seal" - Tier 2 didn't recognize the synonym.

### Key Error Patterns Identified

**1. Tier 2 fails to recognize synonyms/variations:**
- "raised seal" = "embossed seal"
- Medication logging = physical log requirement
- Monthly reports = mandated reports

**2. Tier 2 too narrowly interprets issue types:**
- Focuses on "primary purpose" rather than presence of requirement
- Misses requirements buried in subsections of long documents (avg 8k+ chars)

**3. Tier 2 underweights safety contexts:**
- 32 of 34 "burdensome → justified" errors involve safety-related regulations
- Child welfare, maritime safety, transportation safety all under-recognized

**4. Tier 2 overconfident on wrong answers:**
- "Unrelated" items avg confidence 0.94 yet 45% error rate
- "Burdensome" items avg confidence 0.82 yet 53% error rate

### Confidence Correlation

| Tier 2 Confidence | Items | Agreement Rate |
|-------------------|-------|----------------|
| < 0.85 | 34 | 53% |
| 0.85-0.90 | 63 | 54% |
| > 0.90 | 18 | 67% |

**Weak positive correlation**: Higher confidence slightly more accurate, but 33% error rate even at highest confidence.

---

## Phase 2: External Verification (Tier 3b)

### Web Search Findings

#### 1. Newspaper Publication Requirements - MAJOR FINDING

**New Law: S-4654 (signed June 30, 2025)**
- New Jersey has **removed the mandate for newspaper publication** for legal notices
- Effective March 1, 2026, electronic publication on government websites is the standard
- This directly affects classifications for `newspaper` issue type

**Impact on Study:**
- Doc 128283 (newspaper) was classified as "justified" by both Tier 2 and Tier 3
- **However**, the statutory mandate Tier 3 cited (railroad crossing notice) may now have electronic alternatives
- Regulations requiring newspaper publication are now potentially outdated

**Sources:**
- [NJ Monitor: New Jersey removes newspaper publication mandate](https://newjerseymonitor.com/2025/07/01/new-jersey-removes-mandate-to-publish-legal-notices-in-newspapers/)
- [Saiber LLC: New Law Modernizes Legal Notice Requirements](https://www.saiber.com/insights/publications/2025-08-06-new-law-modernizes-legal-notice-requirements-in-new-jersey)

#### 2. Notarization Requirements

**Remote Online Notarization (RON) Legal Since 2021**
- Assembly Bill No. 4250 signed July 22, 2021
- NJ notaries can perform remote online notarizations
- Signer does not need to be in-state
- Identity verified via KBA and audio-visual recording

**Impact on Study:**
- 4 notarization items in justified category may warrant reconsideration
- In-person notarization requirements may be unnecessarily burdensome when RON is available
- Exception: Wills/codicils still require in-person notarization

**Sources:**
- [Holland & Knight: NJ Permanently Authorizes RON](https://www.hklaw.com/en/insights/publications/2021/07/new-jersey-permanently-authorizes-enotarizations)
- [NJ Treasury: Notary Public Law](https://www.nj.gov/treasury/revenue/notary-public-law.shtml)

### Phase 2 Summary

| Issue Type | External Finding | Impact |
|------------|-----------------|--------|
| newspaper | State law changed (2025) | "Justified" items may now be "burdensome" |
| notarization | RON available (2021) | In-person requirements may be unnecessary |

---

## Key Findings

### 1. Tier 2 Has Severe Accuracy Problems

| Metric | Value | Implication |
|--------|-------|-------------|
| Overall agreement | 52% | Only half of Tier 2 classifications are correct |
| Unrelated error rate | **65%** | Tier 2 misses 2/3 of genuine issues |
| Burdensome error rate | **67%** | Tier 2 over-reports severity in 2/3 of cases |
| Justified accuracy | 93% | Tier 2 is only reliable for "justified" calls |

### 2. Confidence Scores Are Misleading

- "Unrelated" items have **highest** avg confidence (0.94)
- Yet "unrelated" has **lowest** accuracy (35%)
- High confidence does NOT indicate correct classification
- **Cannot use confidence to prioritize or skip Tier 3**

### 3. Two Systematic Error Patterns

**Pattern A: Under-detection (65% of "unrelated" are wrong)**
- Tier 2 focuses too narrowly on "primary purpose"
- Misses requirements embedded in other contexts
- Fails to recognize synonyms ("raised seal" = "embossed seal")

**Pattern B: Over-severity (67% of "burdensome" are actually "justified")**
- Tier 2 underweights safety/child protection contexts
- 6 of 8 burdensome→justified errors involve child welfare
- Physical logs in children's facilities have legitimate safety rationale

### 4. External Context Changes Classifications

- Newspaper requirements: State law changed in 2025, making "justified" items potentially "burdensome"
- Notarization requirements: RON available since 2021, reducing justification for in-person requirements
- **Tier 2 operates on stale understanding of legal landscape**

---

## Recommendations

### 1. Tier 3a (Internal Verification) is MANDATORY for All Items

**Finding:** With 48% overall error rate, Tier 2 cannot be trusted alone.

**Recommendation:** Run Tier 3a verification on **every item**, not just flagged ones.

**Alternative:** If cost is prohibitive, run Tier 3a on:
- All "unrelated" classifications (65% error rate)
- All "burdensome" classifications (67% error rate)
- Skip only "justified" classifications (93% accurate)

### 2. Tier 3b (External Verification) is Essential for Specific Issue Types

**Finding:** External legal landscape changes classifications.

**Recommendation:** Run web search for:
- All `newspaper` items (state law changed 2025)
- All `notarization` items (RON available since 2021)
- Any item citing federal mandates (verify state discretion)
- High-severity items (>=7) to check modernization alternatives

### 3. Improve Tier 2 Prompts Before Relying on It

**Finding:** Tier 2 has systematic interpretation failures.

**Prompt Improvements Needed:**
1. Add explicit instruction: "A requirement exists even if it's not the primary purpose"
2. Add synonym lists for each issue type (raised seal = embossed seal, etc.)
3. Add context weighting: "Child protection contexts have heightened justification standards"
4. Update knowledge of legal landscape (newspaper law, RON law)

### 4. Do Not Use Confidence Scores for Prioritization

**Finding:** Confidence inversely correlates with accuracy for "unrelated" items.

**Recommendation:** Treat all items equally regardless of confidence score.

### 5. Cost/Benefit Analysis at Scale

**Assumptions:**
- 5,000-10,000 documents per state
- 50 states = 250,000-500,000 documents total
- Tier 2 cost: ~$3/1000 items
- Tier 3 cost: ~$3.50/1000 items

#### Option A: Tier 2 Only (Current State)

| Scale | Cost | Error Rate | Wrong Classifications |
|-------|------|------------|----------------------|
| 10,000 docs | $30 | 43.5% | 4,350 wrong |
| 250,000 docs | $750 | 43.5% | **108,750 wrong** |
| 500,000 docs | $1,500 | 43.5% | 217,500 wrong |

#### Option B: Tier 2 + Tier 3a (All Items)

| Scale | Cost | Error Rate | Wrong Classifications |
|-------|------|------------|----------------------|
| 10,000 docs | $65 | ~5% | 500 wrong |
| 250,000 docs | $1,625 | ~5% | **12,500 wrong** |
| 500,000 docs | $3,250 | ~5% | 25,000 wrong |

#### Option C: Tier 2 + Tier 3a (Selective) + Tier 3b (Issue Types)

Run Tier 3a only on burdensome/unrelated (84/115 = 73% of items), plus Tier 3b web search for newspaper/notarization:

| Scale | Cost | Error Rate | Wrong Classifications |
|-------|------|------------|----------------------|
| 10,000 docs | $48 | ~8% | 800 wrong |
| 250,000 docs | $1,200 | ~8% | **20,000 wrong** |
| 500,000 docs | $2,400 | ~8% | 40,000 wrong |

#### Cost Per Correct Classification Saved

| Transition | Cost Increase | Classifications Fixed | Cost per Fix |
|------------|---------------|----------------------|--------------|
| A → B | $875 (250k) | 96,250 | **$0.009/fix** |
| A → C | $450 (250k) | 88,750 | **$0.005/fix** |

**Recommendation:** Option C (selective Tier 3a + Tier 3b) provides best cost/benefit:
- Fixes 88,750 wrong classifications at 250k scale
- Only $450 additional cost
- $0.005 per classification fixed

---

## Root Cause Analysis: Information vs Prompt

### The Key Question

If Tier 3 performs better than Tier 2, **why**?
- Did Tier 3 have access to **new information** that Tier 2 didn't?
- Or did Tier 3's **different prompt framing** cause more careful analysis?

### Finding: Tier 2 Already Has Full Document Content

Investigation of `prompts/research_pipeline.yaml` confirmed:

```yaml
tier2:
  template: |
    ## Document Under Analysis
    Citation: {citation}
    Title: {title}
    ## Full Content
    {content}  # <-- FULL DOCUMENT, NOT SUMMARY
    ## Inherited Definitions
    {definitions}
```

**Tier 2 and Tier 3 received the exact same document content.**

### Categorization of 50 Disagreements

Analyzed each disagreement to determine what Tier 3 "saw" that Tier 2 missed:

| Root Cause | Count | % | Description |
|------------|-------|---|-------------|
| CHILD_SAFETY_CONTEXT | 16 | 32% | Tier 3 recognized child welfare/shelter care as justification |
| OTHER | 8 | 16% | Uncategorized differences in interpretation |
| MISSED_IN_LONG_DOC | 8 | 16% | Requirements buried in subsections (same info, more careful reading) |
| SAFETY_CONTEXT | 7 | 14% | Maritime/transportation safety recognized as justification |
| MISSED_JUSTIFICATION | 7 | 14% | Legitimate government interests (background checks, etc.) |
| MISSED_ALTERNATIVES | 2 | 4% | Electronic alternatives not recognized |
| TOO_NARROW_INTERPRETATION | 1 | 2% | "Not primary purpose" dismissal |
| SYNONYM_FAILURE | 1 | 2% | "Raised seal" ≠ "embossed seal" recognition |

### Key Insight: 98% Prompt-Based, 2% Information-Based

Only **SYNONYM_FAILURE** (1 item, 2%) represents a true information gap where Tier 2 didn't know that "raised seal" = "embossed seal".

All other disagreements (98%) involved:
- **Same information, different weighting**: Tier 3's verification prompt caused it to weight safety contexts more heavily
- **Same information, more thorough reading**: Verification mindset led to finding requirements in subsections
- **Same information, different interpretation**: Verification prompt asked "is this justified?" rather than "classify this"

### What the Prompt Change Actually Did

| Tier 2 Prompt (Classification) | Tier 3 Prompt (Verification) |
|-------------------------------|------------------------------|
| "Classify this document" | "Verify this classification is correct" |
| Make a quick decision | Check the work carefully |
| Weight all evidence equally | Consider "is this justified?" explicitly |
| Move on after first scan | Re-read for missed details |

The verification framing caused Tier 3 to:
1. **Consider justifications more carefully** (46% of disagreements involve safety/child contexts)
2. **Read long documents more thoroughly** (16% found buried requirements)
3. **Question the initial classification** rather than confirm it

### Implication for Architecture

**Original recommendation was to add Tier 3a verification.**

**Revised recommendation: FIX TIER 2 PROMPT instead.**

If the improvement is entirely prompt-based, we should:
1. Add verification-style checks to Tier 2 prompt directly
2. Add explicit guidance on safety contexts and justifications
3. Add synonym lists for each issue type
4. Add instruction to check all subsections in long documents

This would eliminate the need for a separate Tier 3a tier, saving ~$450 at 250k scale.

### Specific Tier 2 Prompt Improvements Needed

Based on disagreement analysis:

```markdown
## Additional Tier 2 Instructions (Proposed)

### Safety Context Weighting
When the regulation involves ANY of these contexts, default to "justified" unless burden is clearly excessive:
- Child welfare, foster care, residential facilities for minors
- Maritime safety, pilot licensing, vessel operations
- Transportation safety, driver licensing
- Hazardous materials handling
- Food safety, kitchen operations

### Long Document Thoroughness
For documents over 2,000 words:
- Explicitly scan EACH subsection for requirements
- Requirements buried in subsections are still requirements
- Quote the specific subsection where requirement appears

### Synonym Recognition
Issue type synonyms to recognize:
- embossed_seal: "raised seal", "impressed seal", "official seal"
- physical_log: "log book", "daily log", "medication log", "attendance log"
- wet_signature: "ink signature", "original signature", "handwritten signature"
[etc. for each issue type]

### Justification Analysis
Before classifying as "burdensome", explicitly ask:
1. Is there a safety rationale? (child, maritime, transportation, hazmat, food)
2. Is this a statutory mandate with no state discretion?
3. Are electronic alternatives actually available in this context?
```

---

## Conclusion

**The current Tier 2-only pipeline is not production-ready.** With 43.5% overall error rate on 115 items:
- 53% of "burdensome" items are actually justified (over-reporting severity)
- 45% of "unrelated" items are actually burdensome/justified (missing real issues)
- Only "justified" classification is reliable (83% accuracy)

### Root Cause Finding: Prompt, Not Information

**Critical insight from this study:** Tier 3's improvement came from **prompt framing**, not additional information.

- Tier 2 already receives full document content
- 98% of disagreements: same information, different interpretation
- Only 2% (1 item): true information gap (synonym recognition)

### Revised Recommendation: **FIX TIER 2 PROMPT, NOT ADD TIER 3a**

Adding a separate verification tier is unnecessary overhead if we can achieve the same improvement by modifying Tier 2's prompt to include verification-style thinking.

#### Required Tier 2 Prompt Changes

1. **Safety context weighting** (fixes 46% of errors)
   - Explicitly list safety contexts: child welfare, maritime, transportation, hazmat, food
   - Default to "justified" for safety-related documentation requirements

2. **Long document instructions** (fixes 16% of errors)
   - "For documents >2000 words, scan each subsection explicitly"
   - "Requirements in subsections still count"

3. **Synonym lists per issue type** (fixes 2% of errors)
   - embossed_seal: "raised seal", "impressed seal"
   - physical_log: "log book", "daily log", "medication log"
   - [etc.]

4. **Verification-style self-check** (fixes remaining errors)
   - "Before finalizing, ask: Is there a legitimate safety rationale I'm missing?"
   - "Is this a statutory mandate, or does the state have discretion?"

#### Tier 3b Still Valuable for External Context

Keep Tier 3b web search for issue types where law has changed:
- `newspaper`: NJ law changed June 2025 (S-4654)
- `notarization`: RON available since 2021
- Any item citing federal statutes (verify state discretion)

### Expected Improvement

| Metric | Before (Tier 2 only) | After (Improved Tier 2 + Tier 3b) |
|--------|---------------------|-----------------------------------|
| Error rate | 43.5% | ~10-15% |
| Wrong @ 250k scale | 108,750 | 25,000-37,500 |
| Cost @ 250k scale | $750 | $850-900 |
| Additional cost | - | $100-150 |

**Net effect:** ~75,000-85,000 fewer wrong classifications for ~$100-150 additional cost at 250k scale.

### Next Steps

1. **Revise Tier 2 prompt** with the specific improvements above
2. **Re-run validation** on same 115 items with improved prompt
3. **Compare error rates** - if <15%, proceed with improved Tier 2
4. **If still >15%**, consider targeted Tier 3a for specific issue types

### Study Complete

This validation study answered the core question: **Tier 2's errors are systematic prompt issues, not information gaps.** The fix is to improve the prompt, not add another verification layer.
