-- Rename the implementation-analysis feature's database objects to "barrier".
--
-- Earlier migrations were rewritten to create barrier_* objects directly, so on a
-- fresh install most of this is a no-op. On databases created before the rename,
-- it moves every legacy-named table, column, constraint, index, sequence, function,
-- and trigger to the barrier_* name. Every step is guarded, so it is safe to run twice.
--
-- This is the one file that still has to spell the legacy prefix: Postgres can only
-- rename an object by its current name.

BEGIN;

DO $$
DECLARE
  old_prefix CONSTANT text := 'jenai';
  new_prefix CONSTANT text := 'barrier';
  r record;
BEGIN
  -- 1. Tables
  IF to_regclass('public.' || old_prefix || '_analyses') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.%I RENAME TO %I', old_prefix || '_analyses', new_prefix || '_analyses');
  END IF;
  IF to_regclass('public.' || old_prefix || '_issues') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.%I RENAME TO %I', old_prefix || '_issues', new_prefix || '_issues');
  END IF;

  -- 2. Columns (tournament_examples.<old>_issue_id)
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name LIKE '%' || old_prefix || '%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I',
      r.table_name, r.column_name, replace(r.column_name, old_prefix, new_prefix));
  END LOOP;

  -- 3. Constraints (pkey/unique renames also rename their backing index)
  FOR r IN
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public' AND con.conname LIKE '%' || old_prefix || '%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I',
      r.relname, r.conname, replace(r.conname, old_prefix, new_prefix));
  END LOOP;

  -- 4. Remaining indexes and sequences
  FOR r IN
    SELECT cls.relname, cls.relkind
    FROM pg_class cls
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public'
      AND cls.relkind IN ('i', 'S')
      AND cls.relname LIKE '%' || old_prefix || '%'
  LOOP
    IF r.relkind = 'i' THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.relname, replace(r.relname, old_prefix, new_prefix));
    ELSE
      EXECUTE format('ALTER SEQUENCE public.%I RENAME TO %I', r.relname, replace(r.relname, old_prefix, new_prefix));
    END IF;
  END LOOP;

  -- 5. Search function (the GIN index references it by OID, so a rename is enough)
  IF to_regprocedure('public.' || old_prefix || '_issues_search_tsvector(text, text[])') IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION public.%I(text, text[]) RENAME TO %I',
      old_prefix || '_issues_search_tsvector', new_prefix || '_issues_search_tsvector');
  END IF;

  -- 6. Drop the legacy burden trigger and function. Its plpgsql body names the old
  --    tables, so renaming it would break every insert. It is recreated below.
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.barrier_issues', 'trg_' || old_prefix || '_issues_burden_recalc');
  EXECUTE format('DROP FUNCTION IF EXISTS public.%I()', 'recalculate_' || old_prefix || '_burden');

  -- 7. Pipeline labels stored as data
  UPDATE public.prompt_templates SET pipeline = new_prefix WHERE pipeline = old_prefix;
  UPDATE public.llm_api_cache SET pipeline = new_prefix WHERE pipeline = old_prefix;
END $$;

-- Burden recalculation trigger, pointed at the renamed tables.
CREATE OR REPLACE FUNCTION public.recalculate_barrier_burden() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  target_analysis_id BIGINT;
  new_composite REAL;
  new_cluster_count INTEGER;
BEGIN
  -- Determine which analysis_id to recalculate
  IF TG_OP = 'DELETE' THEN
    target_analysis_id := OLD.analysis_id;
  ELSE
    target_analysis_id := NEW.analysis_id;
  END IF;

  -- Recalculate from all issues for this analysis
  SELECT
    COALESCE(SUM(severity * confidence), 0),
    COUNT(DISTINCT category) FILTER (
      WHERE category IN (
        'ADMINISTRATIVE_BURDENS',
        'MANDATED_STEPS_NOT_OUTCOMES',
        'REGULATORY_COMPLEXITY',
        'ONE_SIZE_FITS_ALL',
        'CASCADE_OF_RIGIDITY',
        'UNFUNDED_MANDATE'
      )
    )
  INTO new_composite, new_cluster_count
  FROM barrier_issues
  WHERE analysis_id = target_analysis_id;

  UPDATE barrier_analyses
  SET
    composite_burden = new_composite,
    structural_cluster_count = new_cluster_count,
    adjusted_burden = new_composite * (1 + 0.1 * new_cluster_count)
  WHERE id = target_analysis_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_barrier_issues_burden_recalc ON public.barrier_issues;
CREATE TRIGGER trg_barrier_issues_burden_recalc
  AFTER INSERT OR DELETE OR UPDATE ON public.barrier_issues
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_barrier_burden();

COMMIT;
