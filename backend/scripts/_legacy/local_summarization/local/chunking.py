"""Chunking strategies for long documents.

Based on corpus analysis:
- 85% of docs are < 3K chars (use full text)
- 9% are 3K-6K chars (use head + tail)
- 5% are 6K-15K chars (split by subsections)
- 1.4% are > 15K chars (paragraph-based chunking)
"""

import re
from dataclasses import dataclass


@dataclass
class Chunk:
    """A chunk of text to be summarized."""

    text: str
    chunk_type: str  # 'full', 'head_tail', 'subsection', 'paragraph', 'truncated'
    chunk_index: int
    total_chunks: int
    original_length: int


def chunk_document(content: str, max_chars: int = 3000) -> list[Chunk]:
    """
    Apply appropriate chunking strategy based on document length.

    Strategies:
    - < 3000 chars: Use full text
    - 3000-6000 chars: Head + tail (first 2000 + last 1000)
    - 6000-15000 chars: Split by subsections
    - > 15000 chars: Paragraph-based chunking
    """
    if not content:
        return [
            Chunk(
                text="[Empty document]",
                chunk_type="full",
                chunk_index=0,
                total_chunks=1,
                original_length=0,
            )
        ]

    original_length = len(content)

    # Strategy 1: Short documents - use full text
    if original_length <= max_chars:
        return [
            Chunk(
                text=content,
                chunk_type="full",
                chunk_index=0,
                total_chunks=1,
                original_length=original_length,
            )
        ]

    # Strategy 2: Medium documents - head + tail
    if original_length <= max_chars * 2:
        head = content[:2000]
        tail = content[-1000:]
        combined = f"{head}\n\n[...content omitted ({original_length - 3000} chars)...]\n\n{tail}"
        return [
            Chunk(
                text=combined,
                chunk_type="head_tail",
                chunk_index=0,
                total_chunks=1,
                original_length=original_length,
            )
        ]

    # Strategy 3: Long documents - split by structure
    # Look for subsection markers: (a), (b), (1), (2), etc.
    subsection_pattern = r"\n\s*\([a-z]\)|\n\s*\(\d+\)|\n\s*\d+\.\s"
    parts = re.split(subsection_pattern, content)

    if len(parts) > 1 and all(len(p) < max_chars for p in parts[:5]):
        # Successfully split into subsections
        chunks = []
        current_chunk = ""
        chunk_index = 0

        for part in parts:
            if len(current_chunk) + len(part) < max_chars:
                current_chunk += part
            else:
                if current_chunk.strip():
                    chunks.append(
                        Chunk(
                            text=current_chunk.strip(),
                            chunk_type="subsection",
                            chunk_index=chunk_index,
                            total_chunks=-1,  # Will be updated
                            original_length=original_length,
                        )
                    )
                    chunk_index += 1
                current_chunk = part

        if current_chunk.strip():
            chunks.append(
                Chunk(
                    text=current_chunk.strip(),
                    chunk_type="subsection",
                    chunk_index=chunk_index,
                    total_chunks=-1,
                    original_length=original_length,
                )
            )

        # Update total_chunks
        for chunk in chunks:
            chunk.total_chunks = len(chunks)

        if chunks:
            return chunks

    # Strategy 4: Very long or unstructured - paragraph-based chunking
    paragraphs = content.split("\n\n")
    chunks = []
    current_chunk = ""
    chunk_index = 0

    for para in paragraphs:
        if len(current_chunk) + len(para) < max_chars:
            current_chunk += para + "\n\n"
        else:
            if current_chunk.strip():
                chunks.append(
                    Chunk(
                        text=current_chunk.strip()[:max_chars],  # Hard limit
                        chunk_type="paragraph",
                        chunk_index=chunk_index,
                        total_chunks=-1,
                        original_length=original_length,
                    )
                )
                chunk_index += 1
            current_chunk = para + "\n\n"

    if current_chunk.strip():
        chunks.append(
            Chunk(
                text=current_chunk.strip()[:max_chars],
                chunk_type="paragraph",
                chunk_index=chunk_index,
                total_chunks=-1,
                original_length=original_length,
            )
        )

    for chunk in chunks:
        chunk.total_chunks = len(chunks)

    # Fallback: just truncate
    if not chunks:
        return [
            Chunk(
                text=content[:max_chars],
                chunk_type="truncated",
                chunk_index=0,
                total_chunks=1,
                original_length=original_length,
            )
        ]

    return chunks
