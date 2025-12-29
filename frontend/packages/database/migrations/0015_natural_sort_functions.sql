-- Natural sort helper functions for alphanumeric ordering
-- E.g., "24A" sorts after "24" but before "25"
-- E.g., "Chapter 11" sorts after "Chapter 2"

-- Extract numeric prefix from alphanumeric string
-- Examples: "24A" → 24, "100" → 100, "Part 3" → 3, "" → 0, NULL → 0
CREATE OR REPLACE FUNCTION natural_sort_num(text) RETURNS integer AS $$
  SELECT COALESCE(
    NULLIF(regexp_replace($1, '[^0-9].*$', '', 'g'), '')::integer,
    0
  );
$$ LANGUAGE SQL IMMUTABLE;

-- Extract alpha suffix from alphanumeric string
-- Examples: "24A" → "A", "100" → "", "3B" → "B"
CREATE OR REPLACE FUNCTION natural_sort_alpha(text) RETURNS text AS $$
  SELECT COALESCE(regexp_replace($1, '^[0-9]+', '', 'g'), '');
$$ LANGUAGE SQL IMMUTABLE;
