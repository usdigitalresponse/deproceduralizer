"""Readability metrics computation using textstat.

Computes 8 readability indices plus word/sentence counts for document text.
Returns None if text is too short (< 100 words or < 3 sentences) to produce
reliable readability scores.
"""

from typing import Optional

import textstat


def compute_readability(text: str) -> Optional[dict]:
    """
    Compute all readability metrics for a document's text.

    Args:
        text: Full document text content

    Returns:
        Dict with all readability metrics, or None if text is too short
        (< 100 words or < 3 sentences) for reliable scoring.
    """
    if not text or not text.strip():
        return None

    word_count = textstat.lexicon_count(text, removepunct=True)
    sentence_count = textstat.sentence_count(text)

    if word_count < 100 or sentence_count < 3:
        return None

    return {
        "flesch_kincaid_grade": textstat.flesch_kincaid_grade(text),
        "flesch_reading_ease": textstat.flesch_reading_ease(text),
        "gunning_fog": textstat.gunning_fog(text),
        "automated_readability_index": textstat.automated_readability_index(text),
        "coleman_liau_index": textstat.coleman_liau_index(text),
        "smog_index": textstat.smog_index(text),
        "dale_chall_readability_score": textstat.dale_chall_readability_score(text),
        "linsear_write_formula": textstat.linsear_write_formula(text),
        "reading_grade_level": textstat.text_standard(text, float_output=False),
        "difficult_word_count": len(textstat.difficult_words_list(text)),
        "word_count": word_count,
        "sentence_count": sentence_count,
    }
