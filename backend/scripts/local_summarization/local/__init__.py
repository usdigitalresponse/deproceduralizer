"""Local Ollama-based summarization infrastructure.

This module contains the Ollama-based summarization pipeline that can be
removed once the Haiku batch approach is validated.

Files:
- run_hierarchical.py: Hierarchical bottom-up summarization runner
- run_summaries.py: Simple parallel summarization runner
- summarizer.py: Ollama API wrapper
- chunking.py: Content chunking strategies

Usage:
    # Run hierarchical summarization with Ollama
    cd backend/scripts/local_summarization
    python local/run_hierarchical.py --state NJ --title 12A --dry-run
"""
