-- Add composite burden score columns to jenai_analyses
ALTER TABLE jenai_analyses
  ADD COLUMN composite_burden REAL,
  ADD COLUMN structural_cluster_count INTEGER,
  ADD COLUMN adjusted_burden REAL;

-- Backfill from existing jenai_issues
WITH burden_calc AS (
  SELECT
    ji.analysis_id,
    SUM(ji.severity * ji.confidence) AS composite_burden,
    COUNT(DISTINCT ji.category) FILTER (
      WHERE ji.category IN (
        'ADMINISTRATIVE_BURDENS',
        'MANDATED_STEPS_NOT_OUTCOMES',
        'REGULATORY_COMPLEXITY',
        'ONE_SIZE_FITS_ALL',
        'CASCADE_OF_RIGIDITY',
        'UNFUNDED_MANDATE'
      )
    ) AS structural_cluster_count
  FROM jenai_issues ji
  GROUP BY ji.analysis_id
)
UPDATE jenai_analyses ja
SET
  composite_burden = bc.composite_burden,
  structural_cluster_count = bc.structural_cluster_count,
  adjusted_burden = bc.composite_burden * (1 + 0.1 * bc.structural_cluster_count)
FROM burden_calc bc
WHERE ja.id = bc.analysis_id;

-- Index for efficient sorting by burden score
CREATE INDEX idx_jenai_analyses_adjusted_burden_desc
  ON jenai_analyses (adjusted_burden DESC NULLS LAST);

-- Trigger function to auto-recalculate burden when issues change
CREATE OR REPLACE FUNCTION recalculate_jenai_burden()
RETURNS TRIGGER AS $$
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
  FROM jenai_issues
  WHERE analysis_id = target_analysis_id;

  UPDATE jenai_analyses
  SET
    composite_burden = new_composite,
    structural_cluster_count = new_cluster_count,
    adjusted_burden = new_composite * (1 + 0.1 * new_cluster_count)
  WHERE id = target_analysis_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jenai_issues_burden_recalc
  AFTER INSERT OR UPDATE OR DELETE ON jenai_issues
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_jenai_burden();
