# Compliance Issue Experiments

Individual configuration files for each compliance issue type, extracted from `prompts/compliance_issues.yaml`.

## Purpose

These files allow experimentation with individual issue type configurations (patterns, prompts, severity baselines) without modifying the main YAML file.

## Structure

Each file contains:
- `display_name` - Human-readable name
- `db_issue_type` - Database value
- `category` - Grouping category
- `description` - Brief description
- `response_model` - Pydantic model name
- `patterns` - Regex patterns for initial detection
- `prompt.system` - Static LLM instructions (cached)
- `prompt.template` - Dynamic template with `{regulation_context}` and `{statute_context}`

## Current Performance (as of analysis)

| Issue Type | Precision | Notes |
|------------|-----------|-------|
| `binding_required` | 95.2% | High precision |
| `handwriting_specs` | 94.6% | High precision |
| `embossed_seal` | 94.3% | High precision |
| `multiple_copies` | 90.9% | High precision |
| `notarization` | 90.9% | High precision |
| `mandated_reports` | 87.3% | High volume, good precision |
| `newspaper` | 80.3% | Good precision |
| `storage_location` | 33.5% | **Needs improvement** |
| `mail_only` | 35.7% | **Needs improvement** |
| `witness` | 30.5% | **Needs improvement** |
| `in_person_submission` | 22.2% | **Needs improvement** |
| `typewriter` | 11.8% | **Needs improvement** |
| `fax_required` | 8.9% | **Needs improvement** |
| `pdf_only` | 1.5% | **Needs improvement** |

## Files

```
mail_only.yaml
certified_mail.yaml
fax.yaml
obsolete_comm.yaml
landline.yaml
check_payment.yaml
cash_only.yaml
no_credit_cards.yaml
in_person_payment.yaml
wet_signature.yaml
notarization.yaml
witness.yaml
embossed_seal.yaml
original_document.yaml
in_person_submission.yaml
in_person_hearing.yaml
in_person_pickup.yaml
physical_forms.yaml
physical_inspection.yaml
physical_posting.yaml
bulletin_board.yaml
obsolete_media.yaml
microfiche.yaml
obsolete_software.yaml
typewriter.yaml
pdf_only.yaml
carbon_copy.yaml
newspaper.yaml
multiple_copies.yaml
paper_specs.yaml
photo_specs.yaml
letterhead.yaml
handwriting_specs.yaml
binding_required.yaml
physical_log.yaml
routing_slip.yaml
storage_location.yaml
fixed_window.yaml
waiting_period.yaml
mandated_reports.yaml
incorporation_by_reference.yaml
```
