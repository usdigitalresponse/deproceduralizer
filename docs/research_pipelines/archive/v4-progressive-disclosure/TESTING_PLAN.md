# Research Pipeline Testing Plan

> **Status: PROPOSED**
> Testing plan for the v4 progressive context disclosure pipeline.

## Overview

This document defines test scenarios for validating the research pipeline's routing logic, context handling, and derived field calculations. Tests should be implemented as unit tests and integration tests before production deployment.

---

## 1. Routing & Escalation

### 1.1 Tier 2 → Next Tier Mapping

| Test Case | Tier 2 Output | ambiguity_type | Expected Next | Notes |
|-----------|---------------|----------------|---------------|-------|
| T2-R1 | `unrelated` | - | DONE | Pipeline terminates |
| T2-R2 | `justified`, sev=3 | - | DONE | Low severity, no escalation flags |
| T2-R3 | `burdensome`, sev=4 | - | DONE | Below threshold |
| T2-R4 | `burdensome`, sev=5 | - | Tier 4 | Severity threshold met |
| T2-R5 | `burdensome`, sev=7 | - | Tier 4 | High severity |
| T2-R6 | `needs_full_context` | `internal` | Tier 3 | State regulatory context needed |
| T2-R7 | `needs_full_context` | `external` | Tier 4 | Skip Tier 3, federal verification needed |
| T2-R8 | `needs_full_context` | `both` | Tier 3 → Tier 4 | Both required |
| T2-R9 | `needs_full_context` | `null` | Tier 3 | Default to Tier 3 when unspecified |

```python
def test_tier2_routing_unrelated():
    output = Tier2Output(classification="unrelated", confidence=0.9, ...)
    assert get_next_tier(output) == "DONE"

def test_tier2_routing_needs_full_context_external():
    output = Tier2Output(
        classification="needs_full_context",
        ambiguity_type="external",
        ...
    )
    assert get_next_tier(output) == "Tier4"
```

### 1.2 Escalation Triggers (needs_web_search)

| Test Case | Conditions | Expected needs_web_search |
|-----------|------------|---------------------------|
| T2-E1 | severity=5, federal_mandate_suspected=True | True |
| T2-E2 | severity=5, federal_mandate_suspected=False, confidence=0.9 | False |
| T2-E3 | severity=4, confidence=0.6 | True (low confidence) |
| T2-E4 | severity=4, confidence=0.8 | False |
| T2-E5 | classification=justified, potentially_controversial=True | True |
| T2-E6 | classification=justified, potentially_controversial=False | False |
| T2-E7 | federal_mandate_suspected=True (any severity) | True |
| T2-E8 | severity=7, confidence=0.95, no flags | True (high severity) |

```python
def test_escalation_justified_controversial():
    """Justified + controversial always escalates (Justified Trap guard)"""
    output = Tier2Output(
        classification="justified",
        severity=3,  # Low severity
        potentially_controversial=True,
        ...
    )
    assert output.needs_web_search == True
```

### 1.3 "Justified Trap" Guard

Verify that `justified` + `potentially_controversial=True` ALWAYS escalates to Tier 4, regardless of severity:

```python
@pytest.mark.parametrize("severity", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
def test_justified_trap_guard(severity):
    """Justified + controversial escalates at ANY severity level"""
    output = Tier2Output(
        classification="justified",
        severity=severity,
        potentially_controversial=True,
        federal_mandate_suspected=False,
        confidence=0.95,  # High confidence shouldn't prevent escalation
        ...
    )
    assert should_escalate_to_web_search(output) == True
```

### 1.4 Tier 3 Gating

| Test Case | Tier 3 Output | Expected Next |
|-----------|---------------|---------------|
| T3-G1 | needs_web_search=False | DONE |
| T3-G2 | needs_web_search=True | Tier 4 |

```python
def test_tier3_gating_no_web_search():
    output = Tier3Output(
        classification="burdensome",
        needs_web_search=False,
        ...
    )
    assert get_next_tier(output) == "DONE"

def test_tier3_gating_web_search():
    output = Tier3Output(
        classification="burdensome",
        needs_web_search=True,
        ...
    )
    assert get_next_tier(output) == "Tier4"
```

### 1.5 Tier 1 Classification Sanity

| Test Case | Input | Expected |
|-----------|-------|----------|
| T1-C1 | All matches dismissed | classification="all_false_positives" |
| T1-C2 | Some matches relevant | classification="needs_research" |
| T1-C3 | All matches relevant | classification="needs_research" |
| T1-C4 | relevant_match_indices=[] with classification="needs_research" | INVALID - should fail validation |

```python
def test_tier1_all_false_positives():
    output = Tier1Output(
        relevant_match_indices=[],
        dismissed_matches=[...],  # All matches dismissed
        classification="all_false_positives",
        ...
    )
    assert output.classification == "all_false_positives"

def test_tier1_invalid_needs_research_no_matches():
    """Cannot claim needs_research with no relevant matches"""
    with pytest.raises(ValidationError):
        Tier1Output(
            relevant_match_indices=[],
            classification="needs_research",  # Invalid!
            ...
        )
```

---

## 2. Context & Catalog

### 2.1 Context Request Validation

| Test Case | Request | Expected |
|-----------|---------|----------|
| C-V1 | context_type="sibling", need_level="summary" | Valid |
| C-V2 | context_type="hierarchy", need_level="full_text" | Valid |
| C-V3 | context_type="invalid_type" | Validation error |
| C-V4 | Tier 2 with full_text_requests when classification != needs_full_context | Warning/ignore |

```python
def test_context_request_valid_types():
    valid_types = ["sibling", "cross_reference", "definition", "hierarchy"]
    for ctx_type in valid_types:
        req = ContextRequest(
            context_type=ctx_type,
            identifier="test",
            need_level="summary",
            reason="test"
        )
        assert req.context_type == ctx_type

def test_full_text_requests_only_with_needs_full_context():
    """full_text_requests should only be populated when classification is needs_full_context"""
    output = Tier2Output(
        classification="burdensome",  # Not needs_full_context
        full_text_requests=[ContextRequest(...)],  # Should be empty or ignored
        ...
    )
    # Either validation fails or requests are ignored
    assert len(output.full_text_requests) == 0 or log_warning_emitted()
```

### 2.2 Definitions Policy

| Test Case | Tier | Requested | Expected |
|-----------|------|-----------|----------|
| C-D1 | Tier 1 | No definition request | Definitions NOT included |
| C-D2 | Tier 1 | Explicit definition request | Only requested terms included |
| C-D3 | Tier 2 | N/A | Definitions ALWAYS included |
| C-D4 | Tier 3 | N/A | Definitions ALWAYS included |

```python
def test_tier1_no_automatic_definitions():
    """Tier 1 does not automatically include definitions"""
    input_builder = Tier1InputBuilder(document_id=123, issue_type="in_person")
    tier1_input = input_builder.build()
    assert "## Inherited Definitions" not in tier1_input.formatted_context

def test_tier2_always_includes_definitions():
    """Tier 2 always includes inherited definitions"""
    input_builder = Tier2InputBuilder(document_id=123, issue_type="in_person")
    tier2_input = input_builder.build()
    assert "## Inherited Definitions" in tier2_input.formatted_context
```

### 2.3 Definitions via Cross-Reference

```python
def test_crossref_to_definitions_section():
    """Cross-ref to definitions section resolves as definition context"""
    cross_ref = CrossReference(
        target_document_id=456,
        target_is_definitions_section=True
    )

    context_item = resolve_cross_reference(
        cross_ref,
        terms_in_document=["applicant", "licensee", "commission"]
    )

    # Should return definition type, not cross_reference
    assert context_item.type == "definition"
    # Should only include relevant terms, not full 50+ definitions
    assert "applicant" in context_item.content
    assert len(context_item.content) < 5000  # Not the full section
```

### 2.4 Immediate Siblings Logic

| Test Case | Position | Expected |
|-----------|----------|----------|
| C-S1 | First section in subchapter | Only "Next Section" shown |
| C-S2 | Last section in subchapter | Only "Previous Section" shown |
| C-S3 | Only section in subchapter | Immediate Context omitted entirely |
| C-S4 | Middle section | Both Previous and Next shown |
| C-S5 | Sibling has no summary | "Summary: (not available)" placeholder |

```python
def test_immediate_siblings_first_section():
    """First section only shows next sibling"""
    siblings = get_immediate_siblings(section_position="first")
    assert "Previous Section" not in siblings.formatted
    assert "Next Section" in siblings.formatted

def test_immediate_siblings_only_section():
    """Only section in subchapter omits immediate context"""
    siblings = get_immediate_siblings(section_position="only")
    assert siblings.formatted == ""  # Or None

def test_immediate_siblings_missing_summary():
    """Missing summary shows placeholder"""
    sibling = SiblingEntry(citation="N.J.A.C. 1:1-1", title="Test", summary=None)
    formatted = format_sibling(sibling)
    assert "Summary: (not available)" in formatted
```

### 2.5 Context Deduplication

```python
def test_context_dedup_multiple_roles():
    """Same document appearing in multiple roles renders once with annotations"""
    registry = ContextRegistry()

    # Same doc is both ancestor and cross-reference target
    registry.add(doc_id=123, source_type="hierarchy", ...)
    registry.add(doc_id=123, source_type="cross_reference", ...)  # Duplicate

    rendered = registry.render_for_tier(tier=2)

    # Should appear only once
    assert rendered.count("N.J.A.C. 13:69D-1.2") == 1
    # Should note both roles
    assert "hierarchy" in rendered
    assert "also: cross_reference" in rendered
```

---

## 3. Derived Fields & Persistence

### 3.1 final_severity Calculation

| Test Case | Tier 2 sev | Tier 3 adj | Tier 4 adj | Expected final |
|-----------|------------|------------|------------|----------------|
| D-S1 | 5 | +2 | 0 | 7 |
| D-S2 | 5 | -1 | +1 | 5 |
| D-S3 | 8 | +3 | 0 | 10 (capped) |
| D-S4 | 3 | -3 | 0 | 1 (floor) |
| D-S5 | 5 | null (skipped) | -2 | 3 |

```python
def test_final_severity_calculation():
    analysis = ComplianceIssueAnalysis(
        severity=5,
        tier3_severity_adjustment=2,
        tier4_severity_adjustment=0
    )
    assert calculate_final_severity(analysis) == 7

def test_final_severity_capped_at_10():
    analysis = ComplianceIssueAnalysis(
        severity=8,
        tier3_severity_adjustment=3,
        tier4_severity_adjustment=1
    )
    assert calculate_final_severity(analysis) == 10  # Capped

def test_final_severity_floor_at_1():
    analysis = ComplianceIssueAnalysis(
        severity=3,
        tier3_severity_adjustment=-3,
        tier4_severity_adjustment=-1
    )
    assert calculate_final_severity(analysis) == 1  # Floor

def test_final_severity_skip_tier3():
    """When Tier 3 is skipped (external ambiguity), only Tier 4 adjusts"""
    analysis = ComplianceIssueAnalysis(
        severity=5,
        tier3_severity_adjustment=None,  # Skipped
        tier4_severity_adjustment=-2
    )
    assert calculate_final_severity(analysis) == 3
```

### 3.2 requirement_found and is_justified

| Test Case | Final Classification | Expected requirement_found | Expected is_justified |
|-----------|---------------------|---------------------------|----------------------|
| D-R1 | burdensome | True | False |
| D-R2 | justified | True | True |
| D-R3 | unrelated | False | False |
| D-R4 | Reclassified burdensome→justified in Tier 3 | True | True |

```python
def test_derived_fields_burdensome():
    analysis = ComplianceIssueAnalysis(
        tier2_classification="burdensome",
        tier3_classification=None  # Not reached
    )
    derived = calculate_derived_fields(analysis)
    assert derived.requirement_found == True
    assert derived.is_justified == False

def test_derived_fields_reclassified():
    """Reclassification in Tier 3 updates derived fields"""
    analysis = ComplianceIssueAnalysis(
        tier2_classification="burdensome",
        tier3_classification="justified"  # Reclassified
    )
    derived = calculate_derived_fields(analysis)
    assert derived.requirement_found == True
    assert derived.is_justified == True  # Uses final classification
```

### 3.3 classification_tier and highest_tier_completed

| Test Case | Path | Expected classification_tier | Expected highest_tier |
|-----------|------|-----------------------------|-----------------------|
| D-T1 | Tier 1 → DONE (all_false_positives) | 1 | 1 |
| D-T2 | Tier 1 → Tier 2 → DONE | 2 | 2 |
| D-T3 | Tier 1 → Tier 2 → Tier 3 → DONE | 3 | 3 |
| D-T4 | Tier 1 → Tier 2 → Tier 4 (skip Tier 3) | 4 | 4 |
| D-T5 | Full path: Tier 1 → 2 → 3 → 4 | 4 | 4 |

```python
def test_tier_tracking_skip_tier3():
    """When Tier 3 is skipped via external ambiguity_type"""
    analysis = process_pipeline(
        tier2_classification="needs_full_context",
        tier2_ambiguity_type="external"  # Skip to Tier 4
    )
    assert analysis.highest_tier_completed == 4
    assert analysis.classification_tier == 4
    assert analysis.tier3_completed_at is None  # Skipped
```

### 3.4 Tier 1 Dismissed Matches

```python
def test_tier1_dismissed_match_id_mapping():
    """Dismissed match indices correctly map to match IDs"""
    input_matches = [
        MatchInfo(match_id=427, ...),  # index 0
        MatchInfo(match_id=511, ...),  # index 1
        MatchInfo(match_id=389, ...),  # index 2
    ]

    tier1_output = Tier1Output(
        relevant_match_indices=[0],  # Only first match relevant
        dismissed_matches=[
            DismissedMatch(match_index=1, text="...", reason="False positive"),
            DismissedMatch(match_index=2, text="...", reason="Different context"),
        ],
        ...
    )

    db_update = process_tier1_output(tier1_output, input_matches)

    assert db_update.tier1_relevant_match_ids == [427]
    assert db_update.tier1_dismissed_match_ids == [511, 389]
    assert db_update.tier1_dismissed_reasons[0]["match_id"] == 511
    assert db_update.tier1_dismissed_reasons[0]["reason"] == "False positive"
```

### 3.5 is_verbatim Calculation

```python
def test_is_verbatim_all_found():
    """is_verbatim=True when all requirements found in source"""
    source_content = "The applicant must appear in person at the Division office."
    verbatim_requirements = [
        "appear in person at the Division office"
    ]
    assert are_all_verbatim(verbatim_requirements, source_content) == True

def test_is_verbatim_not_found():
    """is_verbatim=False when requirement not in source"""
    source_content = "The applicant must appear in person."
    verbatim_requirements = [
        "appear in person at the Division office"  # "Division office" not in source
    ]
    assert are_all_verbatim(verbatim_requirements, source_content) == False

def test_is_verbatim_case_insensitive():
    """Verbatim matching should be case-insensitive"""
    source_content = "The APPLICANT must appear IN PERSON."
    verbatim_requirements = ["applicant must appear in person"]
    assert are_all_verbatim(verbatim_requirements, source_content) == True
```

---

## 4. Integration Tests

### 4.1 Full Pipeline Path Tests

```python
@pytest.mark.integration
def test_full_pipeline_burdensome_path():
    """Document flows through all 4 tiers ending as burdensome"""
    result = run_pipeline(
        document_id=TEST_DOC_BURDENSOME,
        issue_type="in_person_submission"
    )

    assert result.tier1_classification == "needs_research"
    assert result.tier2_classification == "needs_full_context"
    assert result.tier3_classification == "burdensome"
    assert result.tier4_classification == "burdensome"
    assert result.highest_tier_completed == 4
    assert result.final_severity >= 5

@pytest.mark.integration
def test_pipeline_early_exit_false_positive():
    """Document exits at Tier 1 as false positive"""
    result = run_pipeline(
        document_id=TEST_DOC_FALSE_POSITIVE,
        issue_type="in_person_submission"
    )

    assert result.tier1_classification == "all_false_positives"
    assert result.highest_tier_completed == 1
    assert result.tier2_classification is None

@pytest.mark.integration
def test_pipeline_skip_tier3():
    """Document skips Tier 3 via external ambiguity_type"""
    result = run_pipeline(
        document_id=TEST_DOC_FEDERAL_MANDATE,
        issue_type="in_person_submission",
        # This doc references federal CFR, ambiguity is external
    )

    assert result.tier2_ambiguity_type == "external"
    assert result.tier3_completed_at is None  # Skipped
    assert result.tier4_completed_at is not None
```

---

## 5. Test Data Requirements

### Sample Documents Needed

| ID | Purpose | Characteristics |
|----|---------|-----------------|
| TEST_DOC_BURDENSOME | Full pipeline test | Clear burden, no waiver |
| TEST_DOC_FALSE_POSITIVE | Tier 1 exit | Regex matches but not actual issue |
| TEST_DOC_JUSTIFIED | Justified classification | Statutory mandate present |
| TEST_DOC_FEDERAL_MANDATE | External ambiguity | References 31 CFR, unclear discretion |
| TEST_DOC_WAIVER_AVAILABLE | Tier 3 reclassification | Summary unclear, full text shows waiver |
| TEST_DOC_CONTROVERSIAL | Justified trap test | Justified but affects vulnerable population |

---

## 6. Implementation Checklist

- [ ] Unit tests for Tier 2 routing logic (Section 1.1)
- [ ] Unit tests for escalation triggers (Section 1.2)
- [ ] Unit tests for Justified Trap guard (Section 1.3)
- [ ] Unit tests for Tier 3 gating (Section 1.4)
- [ ] Unit tests for Tier 1 classification validation (Section 1.5)
- [ ] Unit tests for context request validation (Section 2.1)
- [ ] Unit tests for definitions policy (Section 2.2)
- [ ] Unit tests for cross-ref to definitions (Section 2.3)
- [ ] Unit tests for immediate siblings (Section 2.4)
- [ ] Unit tests for context deduplication (Section 2.5)
- [ ] Unit tests for final_severity calculation (Section 3.1)
- [ ] Unit tests for derived fields (Section 3.2)
- [ ] Unit tests for tier tracking (Section 3.3)
- [ ] Unit tests for match ID mapping (Section 3.4)
- [ ] Unit tests for is_verbatim (Section 3.5)
- [ ] Integration tests for full pipeline paths (Section 4.1)
- [ ] Create test data fixtures (Section 5)

---

## Related Documents

- [RESEARCH_PIPELINE_DESIGN.md](./RESEARCH_PIPELINE_DESIGN.md) - Full architecture
- [RESEARCH_PIPELINE_MODELS.md](./RESEARCH_PIPELINE_MODELS.md) - Pydantic schemas
- [RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md](./RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md) - Database schema
