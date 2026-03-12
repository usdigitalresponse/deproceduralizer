"""Guidance document summarization pipeline.

Single-phase batch summarization for guidance_documents using Anthropic's Batch API.
Unlike regulatory summarization (hierarchical), guidance docs are flat and get
cross-reference context from cited regulation summaries.
"""
