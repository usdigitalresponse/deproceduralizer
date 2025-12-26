"""
DSPy Metric Functions for Prompt Optimization

These metrics are used by DSPy optimizers to evaluate how well a prompt
performs on training examples. Higher scores indicate better performance.

Each metric returns a float between 0.0 and 1.0.
"""

import json
from typing import Any, Optional


def wet_signature_metric(example: Any, pred: Any, trace: Optional[Any] = None) -> float:
    """
    Evaluate wet signature detection accuracy.

    Scoring:
    - 1.0: Correct classification (matches review_status)
    - 0.5: Partial credit for correct quote extraction
    - 0.0: Wrong classification

    Args:
        example: DSPy Example with ground truth
        pred: Prediction from the module
        trace: Optional trace for debugging

    Returns:
        Score between 0.0 and 1.0
    """
    # Ground truth: review_status == 'confirmed' means it IS a wet signature requirement
    # False positive means the original detection was wrong (it's NOT a wet signature)
    ground_truth_has_requirement = getattr(example, 'has_wet_signature_requirement', None)

    # If ground truth is stored differently (from database review_status)
    if ground_truth_has_requirement is None:
        review_status = getattr(example, 'review_status', None)
        if review_status == 'confirmed':
            ground_truth_has_requirement = True
        elif review_status == 'false_positive':
            ground_truth_has_requirement = False
        else:
            # Unknown status, can't score
            return 0.0

    # Get prediction
    pred_has_requirement = getattr(pred, 'has_wet_signature_requirement', None)

    # Handle string booleans
    if isinstance(pred_has_requirement, str):
        pred_has_requirement = pred_has_requirement.lower() in ('true', 'yes', '1')

    # Main classification accuracy
    if pred_has_requirement == ground_truth_has_requirement:
        score = 1.0
    else:
        score = 0.0

    # Bonus for quote extraction (if prediction is correct)
    if score > 0 and ground_truth_has_requirement:
        pred_quote = getattr(pred, 'requirement_quote', '')
        if pred_quote and len(pred_quote) > 10:
            # Check if quote appears in section text
            section_text = getattr(example, 'section_text', '')
            if pred_quote.strip('"\'') in section_text:
                score = min(1.0, score + 0.1)  # Small bonus for valid quote

    return score


def red_flags_metric(example: Any, pred: Any, trace: Optional[Any] = None) -> float:
    """
    Evaluate red flags analysis accuracy.

    Scoring components:
    - 0.5: Correct has_implementation_issues classification
    - 0.3: Correct category detection
    - 0.2: Severity within 2 points of ground truth

    Args:
        example: DSPy Example with ground truth
        pred: Prediction from the module
        trace: Optional trace for debugging

    Returns:
        Score between 0.0 and 1.0
    """
    score = 0.0

    # Ground truth
    gt_has_issues = getattr(example, 'has_implementation_issues', None)
    gt_category = getattr(example, 'category', None)
    gt_severity = getattr(example, 'severity', None)

    # Predictions
    pred_has_issues = getattr(pred, 'has_implementation_issues', None)
    pred_flags_json = getattr(pred, 'red_flags_json', '[]')

    # Handle string booleans
    if isinstance(pred_has_issues, str):
        pred_has_issues = pred_has_issues.lower() in ('true', 'yes', '1')

    # Classification accuracy (50% of score)
    if pred_has_issues == gt_has_issues:
        score += 0.5

    # If no issues expected and predicted, that's good
    if not gt_has_issues and not pred_has_issues:
        return 1.0  # Perfect score for correct "no issues"

    # Category detection (30% of score)
    if gt_category and pred_flags_json:
        try:
            pred_flags = json.loads(pred_flags_json) if isinstance(pred_flags_json, str) else pred_flags_json
            pred_categories = [f.get('category', '').lower() for f in pred_flags]
            if gt_category.lower() in pred_categories:
                score += 0.3
        except (json.JSONDecodeError, TypeError):
            pass

    # Severity accuracy (20% of score)
    if gt_severity and pred_flags_json:
        try:
            pred_flags = json.loads(pred_flags_json) if isinstance(pred_flags_json, str) else pred_flags_json
            for flag in pred_flags:
                if flag.get('category', '').lower() == gt_category.lower():
                    pred_severity = flag.get('severity', 0)
                    if isinstance(pred_severity, str):
                        pred_severity = int(pred_severity)
                    if abs(pred_severity - gt_severity) <= 2:
                        score += 0.2
                    break
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    return min(1.0, score)


def definition_metric(example: Any, pred: Any, trace: Optional[Any] = None) -> float:
    """
    Evaluate definition extraction accuracy.

    Scoring components:
    - 0.5: Term correctly identified
    - 0.3: Verbatim text extracted correctly
    - 0.2: Correct is_verbatim and definition_type

    Args:
        example: DSPy Example with ground truth
        pred: Prediction from the module
        trace: Optional trace for debugging

    Returns:
        Score between 0.0 and 1.0
    """
    score = 0.0

    # Ground truth (may be in definitions_json or direct fields)
    gt_term = getattr(example, 'term', None)
    gt_verbatim = getattr(example, 'verbatim_text', None)
    gt_is_verbatim = getattr(example, 'is_verbatim', None)
    gt_def_type = getattr(example, 'definition_type', None)

    # If ground truth is in JSON format
    if gt_term is None:
        gt_json = getattr(example, 'definitions_json', None)
        if gt_json:
            try:
                gt_defs = json.loads(gt_json) if isinstance(gt_json, str) else gt_json
                if gt_defs and len(gt_defs) > 0:
                    gt_term = gt_defs[0].get('term')
                    gt_verbatim = gt_defs[0].get('verbatim_text')
                    gt_is_verbatim = gt_defs[0].get('is_verbatim')
                    gt_def_type = gt_defs[0].get('definition_type')
            except (json.JSONDecodeError, TypeError):
                pass

    # Get predictions
    pred_json = getattr(pred, 'definitions_json', '[]')
    try:
        pred_defs = json.loads(pred_json) if isinstance(pred_json, str) else pred_json
    except (json.JSONDecodeError, TypeError):
        pred_defs = []

    if not gt_term:
        # No ground truth term, can't evaluate
        # If prediction also has no definitions, that's correct
        if not pred_defs:
            return 1.0
        return 0.0

    # Term detection (50% of score)
    term_found = False
    matching_def = None
    for pred_def in pred_defs:
        pred_term = pred_def.get('term', '')
        # Fuzzy match: normalize and compare
        if normalize_term(pred_term) == normalize_term(gt_term):
            term_found = True
            matching_def = pred_def
            score += 0.5
            break

    if not term_found:
        return score  # Can't get other points without finding the term

    # Verbatim text (30% of score)
    if gt_verbatim and matching_def:
        pred_verbatim = matching_def.get('verbatim_text', '')
        # Check if verbatim text is similar (contains key phrases)
        if text_similarity(pred_verbatim, gt_verbatim) > 0.5:
            score += 0.3

    # is_verbatim and definition_type (20% of score)
    if matching_def:
        pred_is_verbatim = matching_def.get('is_verbatim')
        pred_def_type = matching_def.get('definition_type', '')

        points = 0
        if gt_is_verbatim is not None and pred_is_verbatim == gt_is_verbatim:
            points += 0.1
        if gt_def_type and pred_def_type.lower() == gt_def_type.lower():
            points += 0.1
        score += points

    return min(1.0, score)


def normalize_term(term: str) -> str:
    """Normalize a term for comparison."""
    if not term:
        return ""
    # Lowercase, strip quotes and whitespace
    return term.lower().strip().strip('"\'')


def text_similarity(text1: str, text2: str) -> float:
    """
    Simple word overlap similarity between two texts.

    Returns a score between 0.0 and 1.0.
    """
    if not text1 or not text2:
        return 0.0

    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())

    if not words1 or not words2:
        return 0.0

    intersection = words1 & words2
    union = words1 | words2

    return len(intersection) / len(union)


# =============================================================================
# Aggregate Metrics
# =============================================================================

def accuracy_metric(example: Any, pred: Any, trace: Optional[Any] = None) -> float:
    """
    Generic accuracy metric - just checks if main boolean field matches.

    Useful for binary classification tasks.
    """
    # Try common field names
    for field in ['has_wet_signature_requirement', 'has_implementation_issues', 'is_correct']:
        gt_val = getattr(example, field, None)
        pred_val = getattr(pred, field, None)

        if gt_val is not None and pred_val is not None:
            # Handle string booleans
            if isinstance(pred_val, str):
                pred_val = pred_val.lower() in ('true', 'yes', '1')
            if isinstance(gt_val, str):
                gt_val = gt_val.lower() in ('true', 'yes', '1')

            return 1.0 if pred_val == gt_val else 0.0

    return 0.0


def combined_metric(
    example: Any,
    pred: Any,
    trace: Optional[Any] = None,
    weights: dict = None
) -> float:
    """
    Combine multiple metrics with weights.

    Default weights:
    - accuracy: 0.6
    - evidence: 0.2
    - completeness: 0.2
    """
    if weights is None:
        weights = {
            'accuracy': 0.6,
            'evidence': 0.2,
            'completeness': 0.2
        }

    score = 0.0

    # Accuracy (does the prediction match ground truth?)
    accuracy = accuracy_metric(example, pred, trace)
    score += weights.get('accuracy', 0.6) * accuracy

    # Evidence (did we extract supporting quotes?)
    evidence_score = 0.0
    for field in ['requirement_quote', 'matched_phrases', 'verbatim_text']:
        val = getattr(pred, field, None)
        if val and len(str(val)) > 10:
            evidence_score = 1.0
            break
    score += weights.get('evidence', 0.2) * evidence_score

    # Completeness (are all expected fields filled?)
    completeness_score = 0.0
    expected_fields = ['explanation', 'summary', 'definitions_json', 'red_flags_json']
    filled = 0
    total = 0
    for field in expected_fields:
        if hasattr(pred, field):
            total += 1
            val = getattr(pred, field, None)
            if val and str(val).strip():
                filled += 1
    if total > 0:
        completeness_score = filled / total
    score += weights.get('completeness', 0.2) * completeness_score

    return min(1.0, score)
