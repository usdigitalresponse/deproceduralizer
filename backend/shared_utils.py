"""
Shared utilities for NY regulations backend scripts.

Consolidates duplicate code (DB connections, parsing, etc.)
to reduce duplication and enable easier maintenance.
"""

import os
from typing import Optional
import psycopg
from psycopg import Connection


def get_db_connection(timeout: int = 30) -> Optional[Connection]:
    """
    Create connection to Neon PostgreSQL database.

    Consolidates duplicate implementation from multiple scripts.
    Used by: migrate_to_postgres, populate_parent_ids, analyze_definition_usage,
             analyze_red_flags, run_pipeline, extract_definitions

    Args:
        timeout: Connection timeout in seconds

    Returns:
        Connection object, or None if connection fails or DATABASE_URL not set
    """
    try:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            print("Warning: DATABASE_URL not set in .env")
            return None

        conn = psycopg.connect(database_url, connect_timeout=timeout)

        # Set statement timeout (Neon pooler compatibility)
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '300000ms'")  # 5 minute timeout

        return conn
    except Exception as e:
        print(f"Warning: Database connection failed: {e}")
        return None
