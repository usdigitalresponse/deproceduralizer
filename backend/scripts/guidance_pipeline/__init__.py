"""Guidance document import pipeline.

Imports sub-regulatory guidance documents (ADMs, LCMs, INFs, etc.) from the
nys-documents repo into the guidance_documents table.

Usage:
    cd backend && python3 -m scripts.guidance_pipeline --dry-run
    cd backend && python3 -m scripts.guidance_pipeline --execute
    cd backend && python3 -m scripts.guidance_pipeline --gap-analysis
    cd backend && python3 -m scripts.guidance_pipeline --clean-refs
    cd backend && python3 -m scripts.guidance_pipeline --clean-refs --execute
    cd backend && python3 -m scripts.guidance_pipeline --detect-supersedure
    cd backend && python3 -m scripts.guidance_pipeline --detect-supersedure --execute
    cd backend && python3 -m scripts.guidance_pipeline --supersedure-report
    cd backend && python3 -m scripts.guidance_pipeline --import-manifest data/client_requested_docs.json
    cd backend && python3 -m scripts.guidance_pipeline --import-manifest data/client_requested_docs.json --group H
"""
