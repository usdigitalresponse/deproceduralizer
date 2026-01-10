# Compliance Issue Detection: Improvement Action Recommendations

> Generated: 2025-12-31 (Updated: 2026-01-01)
> Source: `IMPROVEMENT_REPORT.md` - Full analysis of 44 issue types

This document provides a clear, actionable summary of all improvements to implement based on the pattern analysis research.

---

## Priority 1: URGENT - Remove Catastrophic Patterns

These patterns have extremely high false positive rates and should be removed immediately from `prompts/compliance_issues.yaml`:

| Issue Type | Pattern to REMOVE | Reason | Current Matches |
|------------|-------------------|--------|-----------------|
| pdf_only | `\.pdf\b` | Matches URLs (76% of PDF mentions) | ~195 |
| bulletin_board | `community board` | Matches NYC governmental entities (100% FP) | 22 |
| handwriting_specs | `block letters` | Matches exit sign specs, not handwriting (100% FP) | 12 |

---

## Priority 2: HIGH - Remove High-FP Patterns

These patterns have >50% false positive rates:

| Issue Type | Pattern to REMOVE | Reason | Current Matches |
|------------|-------------------|--------|-----------------|
| check_payment | `payable to` | Just describes payment recipient, not method | 711 |
| obsolete_comm | `telegraph` | Matches "telegraph corporation" entity names | 119 |
| obsolete_software | `ascii.{0,10}format` | ASCII is not obsolete | ~20 |
| obsolete_software | `\bdos\b` | Matches "dos and don'ts" | ~15 |
| photo_specs | `2.{0,3}x.{0,3}2` | Matches flooring specs, DSM codes, any 2x2 | ~50 |
| mandated_reports | `report to the` | Matches parole, board reporting (not report production) | 1,225 |
| physical_inspection | `during business hours` | Matches scheduling, not inspection requirements | ~200 |
| physical_inspection | `public inspection` (standalone) | Too broad without "available for" context | ~300 |
| non_refundable_fees | `forfeited.{0,10}(fee\|deposit\|payment)` | Matches stock/securities terminology | ~30 |
| no_credit_cards | `cash or check only` | Directional ambiguity (paying vs accepting) | ~10 |
| fixed_window | `only during` | Too vague, matches any scheduling | ~50 |
| fixed_window | `filing period` | Matches tax deadlines, not application restrictions | ~40 |
| paper_specs | `paper stock` | Matches manufacturing specs, not document requirements | 21 |
| storage_location | `at the facility` | Generic phrase, ~0% TPR for record storage requirements | 523 |

---

## Priority 3: MEDIUM - Add/Replace Patterns

### Replace broad patterns with targeted alternatives:

#### pdf_only
```yaml
# REMOVE
- \.pdf\b

# ADD
- (shall|must).{0,20}(be )?(in |submit.{0,10})?pdf
- pdf.{0,10}format.{0,10}(is |shall be )?required
- shall.{0,20}pdf.?a
- pdf archival.{0,10}format
```

#### typewriter
```yaml
# REMOVE
- typewritten
- \btypewriter\b

# ADD
- (shall|must).{0,15}(be )?(in )?typewritten

# ADD EXCLUSIONS
- Exclude if "or typewritten" appears
- Exclude if "if typewritten" appears
```

#### witness
```yaml
# REMOVE
- \battested\b  # 75% are certification language
- attestation  # mostly self-attestation

# ADD
- (shall|must).{0,15}(be )?witnessed  # ~90% TPR!
- witness.{0,10}(is |shall be |are )?required
- require.{0,15}witness
```

#### in_person_submission
```yaml
# REMOVE
- appear in person  # catches rights, not requirements
- hand.{0,3}deliver  # almost always optional

# ADD
- in person.{0,10}only  # 100% precision
- (must|shall|required).{0,15}appear.{0,10}in person
- (must|shall).{0,10}hand.{0,3}deliver

# ADD EXCLUSIONS
- Exclude if "allowed to appear" or "right to appear"
- Exclude if "or" appears within 30 chars
```

#### fax
```yaml
# KEEP (as candidate finder)
- \bfax\b

# ADD (high precision)
- shall.{0,20}fax
- must.{0,15}(be )?fax
- fax.{0,15}(is |shall be )?required

# ADD EXCLUSIONS
- Exclude "fax number" (contact info)
- Exclude "or fax" / "and/or fax" (alternatives)
```

#### mail_only
```yaml
# ADD directionality
- (applicant|petitioner|person).{0,20}(must|shall).{0,15}mail
- submit.{0,15}by mail  # without "or"
- only.{0,10}by mail

# ADD EXCLUSIONS
- Exclude "shall be mailed TO" (outbound)
- Exclude "mailed by [agency]" (outbound)
- Exclude if "or" within 30 chars
```

#### in_person_pickup
```yaml
# REMOVE
- available.{0,10}pick.{0,3}up
- picked up  # catches casino/physical procedures

# ADD
- (permit|license|certificate|document).{0,30}(must|shall).{0,20}(be )?(picked up|pick.{0,3}up).{0,10}in person
- (must|shall).{0,20}(pick up|retrieve).{0,20}(permit|license|certificate)
```

#### in_person_hearing
```yaml
# REMOVE
- appear at.{0,20}hearing  # too broad

# ADD
- (must|shall|required).{0,20}attend.{0,15}in person
- in.{0,3}person.{0,10}attendance.{0,10}(is |shall be )?required
- no.{0,10}(remote|video|telephone).{0,10}(permitted|allowed)
```

---

## Priority 4: Add Exclusion Logic (Post-Match Filtering)

These exclusions should be implemented in the regex searcher or LLM prompt:

### Cross-cutting exclusions (apply to multiple issue types):

| Exclusion Type | Pattern to Exclude | Applies To |
|----------------|-------------------|------------|
| Alternatives | `or` within 30-50 chars of match | fax, mail_only, in_person_*, certified_mail |
| Electronic options | `electronic\|online\|email\|portal` nearby | most issue types |
| Outbound direction | `shall be (mailed\|sent) TO` | mail_only, certified_mail |
| Rights language | `right to\|allowed to\|may` | in_person_submission, in_person_hearing |
| URLs | `https?://\|www\.\|\.gov/\|\.org/` | pdf_only |
| Contact info | `fax number\|phone number` | fax, landline |

### Issue-specific exclusions:

| Issue Type | Exclusion Pattern | Reason |
|------------|-------------------|--------|
| wet_signature | `in place of\|instead of\|need not\|except` | These indicate ALTERNATIVES to wet signature |
| original_document | `or copy\|or certified\|or a copy` | Copy alternative offered |
| certified_mail | `by certified check` | Payment method, not mail |
| waiting_period | `no.*waiting period required\|waived` | REMOVING a wait |
| embossed_seal | `Seal of Quality\|inspection seal` | Product certification, not document |

---

## Priority 5: Prompt Improvements

Add these to the `prompt.system` section for each issue type:

### Add to NEGATIVE indicators:

| Issue Type | Add to "NOT a compliance issue when" |
|------------|--------------------------------------|
| pdf_only | "If PDF is mentioned only as a download location or URL" |
| pdf_only | "If 'or other formats', 'or Word', 'or acceptable formats' appears" |
| fax | "If 'fax number' appears as contact info collection" |
| fax | "If fax is paired with 'or email', 'or electronic'" |
| witness | "If 'attested to' or 'attested by' appears (CERTIFICATION, not witness)" |
| in_person_submission | "If 'allowed to appear' or 'right to appear' is mentioned" |
| mail_only | "If mail is being sent BY the agency TO the applicant (outbound)" |

### Add to POSITIVE indicators:

| Issue Type | Add to "IS a compliance issue when" |
|------------|-------------------------------------|
| witness | "Look for 'shall be witnessed' or 'must be witnessed' - ~90% precision" |
| in_person_submission | "Look for 'in person only' - very high precision" |
| fax | "Look for mandatory language: 'shall fax', 'must be faxed'" |

---

## Priority 6: Issue Types to Consider Deprecating

These issue types have very low true positive rates and limited value:

| Issue Type | Sample TPR | Total Matches | Recommendation |
|------------|------------|---------------|----------------|
| in_person_payment | 0% | 1 | Deprecate or expand patterns significantly |
| in_person_hearing | <5% | 247 | Narrow significantly or deprecate |
| obsolete_software | 0% | ~2 | Very rare - deprecate or combine with obsolete_media |
| typewriter | ~0% original | 92 | Keep only with mandatory language patterns |

---

## High-Precision Issue Types (No Changes Needed)

These issue types have excellent patterns - use as templates:

| Issue Type | TPR | Why It Works |
|------------|-----|--------------|
| notarization | ~90% | Terminology inherently implies requirement |
| binding_required | 100% | "three-ring binder" always means document format |
| multiple_copies | 100% | "in triplicate" always means copy requirement |
| surety_bond | 100% | Bond language is specific to financial requirements |
| newspaper | 100% | "newspaper of general circulation" is specific |
| physical_log | ~75% | "log book" in regulatory context means physical log |
| letterhead | ~70% | "on letterhead" is specific to document format |

---

## Cross-Cutting Strategy Recommendations

Based on high-precision vs low-precision patterns:

### Pattern Design Principles:

1. **Use passive/past participle forms**: `shall be notarized` > `notary public`
2. **Require mandatory language prefix**: `(shall|must|required).{0,20}[action]`
3. **Add "or" exclusion logic**: Most types drop 50-80% FPs by excluding alternatives
4. **Avoid noun forms in options**: "by fax OR email" catches too much

### Research Pipeline Recommendation:

The regex-based detection should be treated as a **candidate finder only** with high recall tolerance. Tier 2 LLM analysis with full context is essential because:

1. Regex cannot detect requirements vs options
2. Sibling sections often reveal alternatives (waivers, electronic options)
3. Mandatory language alone is insufficient - need to check for "or" alternatives

---

## Implementation Checklist

### Immediate Actions (Do First):
- [ ] Remove `\.pdf\b` from pdf_only
- [ ] Remove `community board` from bulletin_board
- [ ] Remove `block letters` from handwriting_specs
- [ ] Remove `payable to` from check_payment

### High Priority (Do Soon):
- [ ] Remove `telegraph` from obsolete_comm (or narrow to exclude "corporation")
- [ ] Remove `report to the` from mandated_reports
- [ ] Remove `at the facility` from storage_location (523 FPs)
- [ ] Replace witness patterns (`attested` -> `shall be witnessed`)
- [ ] Replace in_person_submission patterns (add "in person only")

### Medium Priority:
- [ ] Add exclusion logic for alternatives detection
- [ ] Add outbound mail direction filtering to mail_only, certified_mail
- [ ] Update prompts with new positive/negative indicators

### Low Priority:
- [ ] Evaluate deprecating in_person_payment, in_person_hearing
- [ ] Add electronic alternative detection to remaining issue types

---

## New Issue Type Recommendations

### Recommended for Addition:
- **non_refundable_fees** (already created in working-prompts) - 233 matches, clear criteria

### Researched but NOT Recommended:
- **Over-broad community input** - Most public hearing requirements are legitimate procedural safeguards
- **Cloud data transfer opportunities** - 585 matches but most are outbound agency notices

### Clarification: USB/Flash Drive Patterns (KEEP)

The `obsolete_media` patterns for `usb drive` and `flash drive` should be **KEPT**, not removed. While USB/flash drives are not technically "obsolete," requiring physical media submission when electronic upload would work is still a regulatory burden. The issue is:

- **Not about the technology being outdated** - USB drives are common
- **About requiring physical media transfer** - when cloud/electronic alternatives would reduce friction

Consider renaming `obsolete_media` to `physical_media_required` or creating a separate `physical_media_submission` issue type to better capture this burden category.

### Potential for Future Research:
- **certified_check_only** - 525 matches found in initial research

---

## Simulated Impact (NJ Sections)

Simulation run on 2026-01-01 using `backend/scripts/simulate_pattern_improvements.py`:

### Overall Impact

| Metric | Current | Improved | Change |
|--------|---------|----------|--------|
| **Unique Sections Flagged** | 7,299 (14.3%) | 6,439 (12.6%) | **-860 (-11.8%)** |
| Total NJ Sections | 50,946 | 50,946 | — |

### Top Reductions by Issue Type

| Issue Type | Current | Improved | Change | % Change |
|------------|---------|----------|--------|----------|
| mandated_reports | 1,351 | 852 | -499 | -36.9% |
| storage_location | 870 | 398 | -472 | -54.3% |
| physical_inspection | 222 | 116 | -106 | -47.7% |
| in_person_submission | 111 | 36 | -75 | -67.6% |
| in_person_hearing | 139 | 69 | -70 | -50.4% |
| fixed_window | 95 | 42 | -53 | -55.8% |
| obsolete_comm | 30 | 9 | -21 | -70.0% |

### Slight Increases (more precise patterns finding new true positives)

| Issue Type | Current | Improved | Change | % Change |
|------------|---------|----------|--------|----------|
| fax | 286 | 301 | +15 | +5.2% |
| mail_only | 297 | 300 | +3 | +1.0% |

### Interpretation

- **860 fewer false positive candidates** reduces LLM analysis costs
- **11.8% smaller candidate pool** with higher precision
- New mandatory-language patterns in `fax` and `mail_only` catch additional true positives
- Remaining 6,439 sections are higher-quality candidates for Tier 2 LLM analysis
