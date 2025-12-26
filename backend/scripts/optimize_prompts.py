"""
DSPy Prompt Optimization Module

This module provides DSPy signatures and modules for optimizing the three main
prompt types in the deproceduralizer system:
1. Wet Signature Detection
2. Red Flags Analysis
3. Definition Extraction

Usage:
    # Configure DSPy with a model
    import dspy
    lm = dspy.LM("anthropic/claude-3-5-haiku-20241022")
    dspy.configure(lm=lm)

    # Run optimization
    from optimize_prompts import optimize_wet_signature_prompt
    result = optimize_wet_signature_prompt(trainset, num_candidates=3)
"""

import os
import json
from typing import Optional
from dataclasses import dataclass

import dspy
from dspy.teleprompt import COPRO, BootstrapFewShot

# Load environment variables
from dotenv import load_dotenv
load_dotenv()


# =============================================================================
# DSPy Signatures
# =============================================================================

class WetSignatureDetection(dspy.Signature):
    """Analyze regulation text to determine if it requires a wet (physical/ink) signature.

    A "wet signature" requirement means the text EXPLICITLY requires:
    - "wet signature", "original signature", "ink signature"
    - "handwritten signature", "physical signature", "signed in ink"
    - "manually signed", or explicit prohibition of electronic/digital/fax signatures

    Generic phrases like "shall be signed" or "signature required" do NOT count
    as wet signature requirements - these allow electronic signatures under modern law.
    """

    section_text: str = dspy.InputField(desc="The regulation section text to analyze")
    citation: str = dspy.InputField(desc="Citation reference for the regulation")
    heading: str = dspy.InputField(desc="Section heading")

    has_wet_signature_requirement: bool = dspy.OutputField(
        desc="True if text EXPLICITLY requires wet/ink/handwritten/original/physical signature"
    )
    requirement_quote: str = dspy.OutputField(
        desc="Exact quote from the regulation about signature requirement (even if not wet signature)"
    )
    from_statute: Optional[bool] = dspy.OutputField(
        desc="True if requirement originates from statute, False if regulation adds it, None if unknown"
    )
    statute_quote: Optional[str] = dspy.OutputField(
        desc="Exact quote from statute text if from_statute is True, None otherwise"
    )


class RedFlagsAnalysis(dspy.Signature):
    """Analyze regulation sections for implementation complexity using Jennifer Pahlka's framework.

    Identifies 12 categories of regulatory patterns that create implementation barriers:
    1. COMPLEXITY_POLICY_DEBT - Cross-reference spaghetti
    2. OPTIONS_BECOME_REQUIREMENTS - Suggestion lists become checklists
    3. POLICY_IMPLEMENTATION_SEPARATION - Waterfall, vendor lock-in
    4. OVERWROUGHT_LEGALESE - Dense definitions
    5. CASCADE_OF_RIGIDITY - Conflicting absolute goals
    6. MANDATED_STEPS_NOT_OUTCOMES - Procedure-heavy
    7. ADMINISTRATIVE_BURDENS - Friction (notaries, wet signatures, in-person)
    8. NO_FEEDBACK_LOOPS - One-shot design
    9. PROCESS_WORSHIP_OVERSIGHT - Compliance-only audits
    10. ZERO_RISK_LANGUAGE - Impossible absolutes
    11. FROZEN_TECHNOLOGY - Hard-coded architectures
    12. IMPLEMENTATION_OPPORTUNITY - POSITIVE patterns

    Only flag issues that are CLEAR and SUBSTANTIVE matches.
    """

    section_text: str = dspy.InputField(desc="The regulation section text to analyze")
    citation: str = dspy.InputField(desc="Citation reference for the regulation")
    heading: str = dspy.InputField(desc="Section heading")

    has_implementation_issues: bool = dspy.OutputField(
        desc="True if section has ANY category 1-11 issues"
    )
    red_flags_json: str = dspy.OutputField(
        desc="JSON array of red flags, each with: category, explanation, severity (1-10), complexity, matched_phrases"
    )
    overall_complexity: Optional[str] = dspy.OutputField(
        desc="HIGH, MEDIUM, or LOW based on highest individual complexity"
    )
    summary: str = dspy.OutputField(
        desc="2-3 sentences about main implementation concerns or opportunities"
    )
    requires_technical_review: bool = dspy.OutputField(
        desc="True if section needs architects/engineers to design implementation"
    )
    has_reporting_requirement: bool = dspy.OutputField(
        desc="True if section creates reporting/filing/notification requirements"
    )


class DefinitionExtraction(dspy.Signature):
    """Extract term definitions from regulation sections.

    DEFINITELY A DEFINITION: "X means Y", "X shall mean Y", "For purposes of this [section], X is defined as Y"
    MIGHT BE A DEFINITION: Cross-references, inline explanations like "X (meaning Y)"
    NOT A DEFINITION: Numeric thresholds, category labels, citations without definitions

    When uncertain, choose the option that reduces false positives.
    It is better to miss a definition than to extract something that is not a definition.
    """

    section_text: str = dspy.InputField(desc="The regulation section text to analyze")
    citation: str = dspy.InputField(desc="Citation reference")
    heading: str = dspy.InputField(desc="Section heading")

    definitions_json: str = dspy.OutputField(
        desc="JSON array of definitions, each with: term, verbatim_text, is_verbatim, rephrased_definition, scope, scope_level, definition_type, is_cross_reference"
    )


# =============================================================================
# DSPy Modules
# =============================================================================

class WetSignatureDetector(dspy.Module):
    """Module for detecting wet signature requirements in regulations."""

    def __init__(self):
        super().__init__()
        self.predictor = dspy.Predict(WetSignatureDetection)

    def forward(self, section_text: str, citation: str, heading: str):
        return self.predictor(
            section_text=section_text,
            citation=citation,
            heading=heading
        )


class RedFlagsAnalyzer(dspy.Module):
    """Module for analyzing regulations for implementation complexity."""

    def __init__(self):
        super().__init__()
        self.predictor = dspy.Predict(RedFlagsAnalysis)

    def forward(self, section_text: str, citation: str, heading: str):
        return self.predictor(
            section_text=section_text,
            citation=citation,
            heading=heading
        )


class DefinitionExtractor(dspy.Module):
    """Module for extracting definitions from regulation text."""

    def __init__(self):
        super().__init__()
        self.predictor = dspy.Predict(DefinitionExtraction)

    def forward(self, section_text: str, citation: str, heading: str):
        return self.predictor(
            section_text=section_text,
            citation=citation,
            heading=heading
        )


# =============================================================================
# Training Data Types
# =============================================================================

@dataclass
class WetSignatureExample:
    """Training example for wet signature detection."""
    section_text: str
    citation: str
    heading: str
    review_status: str  # 'confirmed', 'false_positive'
    has_wet_signature_requirement: bool
    requirement_quote: Optional[str] = None
    from_statute: Optional[bool] = None
    statute_quote: Optional[str] = None


@dataclass
class RedFlagExample:
    """Training example for red flags analysis."""
    section_text: str
    citation: str
    heading: str
    review_status: str  # 'confirmed', 'false_positive', 'corrected'
    category: str
    severity: int
    has_implementation_issues: bool


@dataclass
class DefinitionExample:
    """Training example for definition extraction."""
    section_text: str
    citation: str
    heading: str
    review_status: str  # 'confirmed', 'false_positive', 'corrected'
    term: str
    verbatim_text: str
    is_verbatim: bool
    definition_type: str


# =============================================================================
# Optimization Functions
# =============================================================================

def optimize_wet_signature_prompt(
    trainset: list[WetSignatureExample],
    num_candidates: int = 3,
    max_iterations: int = 10,
    teacher_model: str = "anthropic/claude-3-5-haiku-20241022",
    student_model: Optional[str] = None,
) -> tuple[WetSignatureDetector, dict]:
    """
    Optimize the wet signature detection prompt using DSPy.

    Args:
        trainset: List of WetSignatureExample training examples
        num_candidates: Number of candidate prompts to generate
        max_iterations: Maximum optimization iterations
        teacher_model: Model to use for optimization (generates candidates)
        student_model: Model to use for evaluation (defaults to teacher)

    Returns:
        Tuple of (optimized_module, optimization_history)
    """
    # Configure DSPy
    lm = dspy.LM(teacher_model)
    dspy.configure(lm=lm)

    # Convert examples to DSPy format
    dspy_examples = []
    for ex in trainset:
        dspy_examples.append(dspy.Example(
            section_text=ex.section_text,
            citation=ex.citation,
            heading=ex.heading,
            has_wet_signature_requirement=ex.has_wet_signature_requirement,
            requirement_quote=ex.requirement_quote or "",
            from_statute=ex.from_statute,
            statute_quote=ex.statute_quote or ""
        ).with_inputs("section_text", "citation", "heading"))

    # Define metric
    from dspy_metrics import wet_signature_metric

    # Choose optimizer based on dataset size
    if len(trainset) >= 50:
        optimizer = COPRO(
            metric=wet_signature_metric,
            breadth=num_candidates,
            depth=max_iterations,
            verbose=True
        )
    else:
        optimizer = BootstrapFewShot(
            metric=wet_signature_metric,
            max_bootstrapped_demos=min(len(trainset), 4),
            max_labeled_demos=min(len(trainset), 8)
        )

    # Run optimization
    detector = WetSignatureDetector()
    optimized = optimizer.compile(detector, trainset=dspy_examples)

    # Collect history
    history = {
        "optimizer": type(optimizer).__name__,
        "num_examples": len(trainset),
        "num_candidates": num_candidates,
        "max_iterations": max_iterations,
        "teacher_model": teacher_model,
    }

    return optimized, history


def optimize_red_flags_prompt(
    trainset: list[RedFlagExample],
    num_candidates: int = 3,
    max_iterations: int = 10,
    teacher_model: str = "anthropic/claude-3-5-haiku-20241022",
) -> tuple[RedFlagsAnalyzer, dict]:
    """Optimize the red flags analysis prompt using DSPy."""
    lm = dspy.LM(teacher_model)
    dspy.configure(lm=lm)

    dspy_examples = []
    for ex in trainset:
        dspy_examples.append(dspy.Example(
            section_text=ex.section_text,
            citation=ex.citation,
            heading=ex.heading,
            has_implementation_issues=ex.has_implementation_issues,
            red_flags_json=json.dumps([{
                "category": ex.category,
                "severity": ex.severity
            }]),
            overall_complexity="HIGH" if ex.severity >= 7 else "MEDIUM" if ex.severity >= 4 else "LOW",
            summary="",
            requires_technical_review=ex.severity >= 7,
            has_reporting_requirement=False
        ).with_inputs("section_text", "citation", "heading"))

    from dspy_metrics import red_flags_metric

    if len(trainset) >= 50:
        optimizer = COPRO(
            metric=red_flags_metric,
            breadth=num_candidates,
            depth=max_iterations,
            verbose=True
        )
    else:
        optimizer = BootstrapFewShot(
            metric=red_flags_metric,
            max_bootstrapped_demos=min(len(trainset), 4),
            max_labeled_demos=min(len(trainset), 8)
        )

    analyzer = RedFlagsAnalyzer()
    optimized = optimizer.compile(analyzer, trainset=dspy_examples)

    history = {
        "optimizer": type(optimizer).__name__,
        "num_examples": len(trainset),
        "num_candidates": num_candidates,
        "max_iterations": max_iterations,
        "teacher_model": teacher_model,
    }

    return optimized, history


def optimize_definition_prompt(
    trainset: list[DefinitionExample],
    num_candidates: int = 3,
    max_iterations: int = 10,
    teacher_model: str = "anthropic/claude-3-5-haiku-20241022",
) -> tuple[DefinitionExtractor, dict]:
    """Optimize the definition extraction prompt using DSPy."""
    lm = dspy.LM(teacher_model)
    dspy.configure(lm=lm)

    dspy_examples = []
    for ex in trainset:
        dspy_examples.append(dspy.Example(
            section_text=ex.section_text,
            citation=ex.citation,
            heading=ex.heading,
            definitions_json=json.dumps([{
                "term": ex.term,
                "verbatim_text": ex.verbatim_text,
                "is_verbatim": ex.is_verbatim,
                "definition_type": ex.definition_type,
                "is_cross_reference": False
            }])
        ).with_inputs("section_text", "citation", "heading"))

    from dspy_metrics import definition_metric

    if len(trainset) >= 50:
        optimizer = COPRO(
            metric=definition_metric,
            breadth=num_candidates,
            depth=max_iterations,
            verbose=True
        )
    else:
        optimizer = BootstrapFewShot(
            metric=definition_metric,
            max_bootstrapped_demos=min(len(trainset), 4),
            max_labeled_demos=min(len(trainset), 8)
        )

    extractor = DefinitionExtractor()
    optimized = optimizer.compile(extractor, trainset=dspy_examples)

    history = {
        "optimizer": type(optimizer).__name__,
        "num_examples": len(trainset),
        "num_candidates": num_candidates,
        "max_iterations": max_iterations,
        "teacher_model": teacher_model,
    }

    return optimized, history


# =============================================================================
# Prompt Export Functions
# =============================================================================

def export_optimized_prompt(module: dspy.Module, prompt_type: str) -> dict:
    """
    Export an optimized DSPy module back to prompts.yaml format.

    Args:
        module: The optimized DSPy module
        prompt_type: One of 'wet_signature_detection', 'red_flags_analysis', 'definition_extraction'

    Returns:
        Dict with 'system' and 'template' keys for prompts.yaml
    """
    # Get the signature from the module's predictor
    predictor = module.predictor

    # DSPy stores optimized instructions in the signature
    signature = predictor.signature

    # Extract the optimized instructions/docstring
    system_prompt = signature.__doc__ or ""

    # Build template based on prompt type
    if prompt_type == "wet_signature_detection":
        template = """Analyze this regulation section for wet signature requirements:

CITATION: {citation}
HEADING: {heading}

SECTION TEXT:
{section_text}"""
    elif prompt_type == "red_flags_analysis":
        template = """Analyze this regulation section for implementation complexity:

CITATION: {citation}
HEADING: {heading}

SECTION TEXT:
{section_text}"""
    elif prompt_type == "definition_extraction":
        template = """Extract term definitions from this regulation section:

CITATION: {citation}
HEADING: {heading}

SECTION TEXT:
{section_text}"""
    else:
        raise ValueError(f"Unknown prompt type: {prompt_type}")

    return {
        "system": system_prompt,
        "template": template,
        "description": f"Optimized {prompt_type} prompt generated by DSPy"
    }


# =============================================================================
# CLI
# =============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Optimize prompts using DSPy")
    parser.add_argument(
        "--prompt-type",
        choices=["wet_signature", "red_flags", "definition"],
        required=True,
        help="Type of prompt to optimize"
    )
    parser.add_argument(
        "--teacher-model",
        default="anthropic/claude-3-5-haiku-20241022",
        help="Model to use for optimization"
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=10,
        help="Maximum optimization iterations"
    )
    parser.add_argument(
        "--num-candidates",
        type=int,
        default=3,
        help="Number of candidate prompts to generate"
    )

    args = parser.parse_args()

    print(f"Prompt optimization not yet connected to database.")
    print(f"Use the API endpoint or web UI to run optimization with training data.")
    print(f"")
    print(f"Configuration:")
    print(f"  Prompt type: {args.prompt_type}")
    print(f"  Teacher model: {args.teacher_model}")
    print(f"  Max iterations: {args.max_iterations}")
    print(f"  Num candidates: {args.num_candidates}")
