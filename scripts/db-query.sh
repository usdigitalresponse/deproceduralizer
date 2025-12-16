#!/bin/bash
# Database Query Script for Deproceduralizer
# Usage: ./scripts/db-query.sh [command|query]
#
# Commands:
#   profile        - Run a full database profile
#   tables         - Show table row counts
#   schema         - Show all table schemas
#   stats          - Show key statistics
#   list-tables    - List all tables and views in database
#   describe TABLE - Show columns, types, constraints for a table
#   indexes TABLE  - Show indexes on a table
#   sample TABLE   - Show 5 sample rows from a table
#   fkeys          - Show all foreign key relationships
#   [query]        - Execute custom SQL query
#
# Examples:
#   ./scripts/db-query.sh profile
#   ./scripts/db-query.sh "SELECT COUNT(*) FROM regulatory_documents"
#   echo "SELECT * FROM red_flags LIMIT 5" | ./scripts/db-query.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load DATABASE_URL from .env
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -E '^DATABASE_URL=' "$PROJECT_ROOT/.env" | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not found. Make sure .env file exists with DATABASE_URL set."
    exit 1
fi

# Function to run psql query
run_query() {
    psql "$DATABASE_URL" -c "$1"
}

# Function to run psql query with tuples only
run_query_tuples() {
    psql "$DATABASE_URL" -t -c "$1"
}

# Commands
case "${1:-}" in
    profile)
        echo "=== Deproceduralizer Database Profile ==="
        echo ""
        echo "=== Table Row Counts ==="
        run_query "
            SELECT 'regulatory_documents' as table_name, COUNT(*) as rows FROM regulatory_documents
            UNION ALL SELECT 'analyses', COUNT(*) FROM analyses
            UNION ALL SELECT 'red_flags', COUNT(*) FROM red_flags
            UNION ALL SELECT 'compliance_issues', COUNT(*) FROM compliance_issues
            UNION ALL SELECT 'definitions', COUNT(*) FROM definitions
            UNION ALL SELECT 'statute_references', COUNT(*) FROM statute_references
            UNION ALL SELECT 'definition_extraction_log', COUNT(*) FROM definition_extraction_log
            ORDER BY rows DESC;
        "
        echo ""
        echo "=== Documents by State ==="
        run_query "SELECT state, COUNT(*) as count FROM regulatory_documents GROUP BY state ORDER BY count DESC;"
        echo ""
        echo "=== Documents by Hierarchy Level ==="
        run_query "SELECT hierarchy_level, COUNT(*) as count FROM regulatory_documents GROUP BY hierarchy_level ORDER BY count DESC;"
        echo ""
        echo "=== Analysis Coverage ==="
        run_query "
            SELECT
                COUNT(DISTINCT rd.id) as total_documents,
                COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN rd.id END) as documents_with_analysis,
                ROUND(100.0 * COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN rd.id END) / NULLIF(COUNT(DISTINCT rd.id), 0), 2) as coverage_pct
            FROM regulatory_documents rd
            LEFT JOIN analyses a ON rd.id = a.document_id AND a.is_current = true;
        "
        echo ""
        echo "=== Red Flags by Severity ==="
        run_query "SELECT severity, COUNT(*) as count FROM red_flags GROUP BY severity ORDER BY severity DESC;"
        echo ""
        echo "=== Red Flags by Review Status ==="
        run_query "SELECT review_status, COUNT(*) as count FROM red_flags GROUP BY review_status ORDER BY count DESC;"
        echo ""
        echo "=== Red Flags by Category (Top 10) ==="
        run_query "SELECT category, COUNT(*) as count FROM red_flags GROUP BY category ORDER BY count DESC LIMIT 10;"
        ;;

    tables)
        echo "=== Table Row Counts ==="
        run_query "
            SELECT 'regulatory_documents' as table_name, COUNT(*) as rows FROM regulatory_documents
            UNION ALL SELECT 'analyses', COUNT(*) FROM analyses
            UNION ALL SELECT 'red_flags', COUNT(*) FROM red_flags
            UNION ALL SELECT 'compliance_issues', COUNT(*) FROM compliance_issues
            UNION ALL SELECT 'definitions', COUNT(*) FROM definitions
            UNION ALL SELECT 'statute_references', COUNT(*) FROM statute_references
            UNION ALL SELECT 'definition_extraction_log', COUNT(*) FROM definition_extraction_log
            ORDER BY rows DESC;
        "
        ;;

    schema)
        echo "=== Database Schema ==="
        # Get all user tables dynamically
        tables=$(run_query_tuples "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")
        for table in $tables; do
            echo ""
            echo "--- $table ---"
            run_query "SELECT column_name, data_type, is_nullable, column_default
                      FROM information_schema.columns
                      WHERE table_name = '$table'
                      ORDER BY ordinal_position;"
        done
        ;;

    list-tables)
        echo "=== All Tables ==="
        run_query "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
        echo ""
        echo "=== All Views ==="
        run_query "SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;"
        ;;

    stats)
        echo "=== Key Statistics ==="
        echo ""
        echo "Documents with highest severity flags:"
        run_query "
            SELECT rd.id, rd.title, rd.state, a.max_severity, a.num_flags
            FROM regulatory_documents rd
            JOIN analyses a ON rd.id = a.document_id AND a.is_current = true
            WHERE a.max_severity IS NOT NULL
            ORDER BY a.max_severity DESC, a.num_flags DESC
            LIMIT 10;
        "
        echo ""
        echo "Complexity distribution:"
        run_query "
            SELECT overall_complexity, COUNT(*) as count
            FROM analyses
            WHERE is_current = true
            GROUP BY overall_complexity
            ORDER BY count DESC;
        "
        ;;

    describe)
        if [ -z "$2" ]; then
            echo "Usage: ./scripts/db-query.sh describe TABLE_NAME"
            exit 1
        fi
        TABLE="$2"
        echo "=== Table: $TABLE ==="
        echo ""
        echo "--- Columns ---"
        run_query "
            SELECT column_name, data_type, is_nullable,
                   COALESCE(column_default, '') as default_value
            FROM information_schema.columns
            WHERE table_name = '$TABLE'
            ORDER BY ordinal_position;
        "
        echo ""
        echo "--- Row Count ---"
        run_query "SELECT COUNT(*) as rows FROM $TABLE;"
        echo ""
        echo "--- Constraints ---"
        run_query "
            SELECT conname as constraint_name,
                   pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = '$TABLE'::regclass;
        "
        ;;

    indexes)
        if [ -z "$2" ]; then
            echo "Usage: ./scripts/db-query.sh indexes TABLE_NAME"
            exit 1
        fi
        TABLE="$2"
        echo "=== Indexes on $TABLE ==="
        run_query "
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = '$TABLE'
            ORDER BY indexname;
        "
        ;;

    sample)
        if [ -z "$2" ]; then
            echo "Usage: ./scripts/db-query.sh sample TABLE_NAME"
            exit 1
        fi
        TABLE="$2"
        echo "=== Sample from $TABLE (5 rows) ==="
        psql "$DATABASE_URL" -x -c "SELECT * FROM $TABLE LIMIT 5;"
        ;;

    fkeys)
        echo "=== Foreign Key Relationships ==="
        run_query "
            SELECT
                tc.table_name as from_table,
                kcu.column_name as from_column,
                ccu.table_name as to_table,
                ccu.column_name as to_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
            ORDER BY tc.table_name;
        "
        ;;

    "")
        # Read from stdin if no argument
        if [ -t 0 ]; then
            echo "Usage: ./scripts/db-query.sh [command|query]"
            echo ""
            echo "Commands:"
            echo "  profile        - Run a full database profile"
            echo "  tables         - Show table row counts"
            echo "  schema         - Show all table schemas"
            echo "  stats          - Show key statistics"
            echo "  list-tables    - List all tables and views in database"
            echo "  describe TABLE - Show columns, types, constraints for a table"
            echo "  indexes TABLE  - Show indexes on a table"
            echo "  sample TABLE   - Show 5 sample rows from a table"
            echo "  fkeys          - Show all foreign key relationships"
            echo ""
            echo "Or provide a SQL query as an argument:"
            echo "  ./scripts/db-query.sh \"SELECT COUNT(*) FROM regulatory_documents\""
            exit 0
        else
            # Read query from stdin
            query=$(cat)
            run_query "$query"
        fi
        ;;

    *)
        # Treat as SQL query
        run_query "$1"
        ;;
esac
