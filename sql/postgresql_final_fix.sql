-- Final fix for the p-value out of range issue
-- Some GWAS p-values are smaller than PostgreSQL's double precision can handle

-- Alternative approach: Use string-based filtering for very small p-values
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gwas_significant_pvalue_safe ON gwas_catalog(p_value, mapped_trait)
WHERE p_value IS NOT NULL
  AND p_value != ''
  AND p_value != 'NR'
  AND (
    -- Handle scientific notation p-values that are very small
    p_value ~ '^[0-9]*\.?[0-9]+[Ee]-[0-9]+$'
    AND SUBSTRING(p_value FROM '[Ee]-([0-9]+)$')::INTEGER >= 5  -- E-5 or smaller
  );

-- Alternative: Numeric range that's safe for PostgreSQL double precision
-- This catches p-values that can be safely converted to float
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gwas_convertible_pvalue ON gwas_catalog(CAST(p_value AS FLOAT), mapped_trait)
WHERE p_value IS NOT NULL
  AND p_value != ''
  AND p_value != 'NR'
  AND p_value ~ '^[0-9]*\.?[0-9]+([Ee][+-]?[0-9]+)?$'  -- Valid numeric format
  AND (
    -- Exclude extremely small values that cause overflow
    NOT (p_value ~ '[Ee]-[0-9]{3,}$')  -- Exclude E-100, E-343, etc.
    OR SUBSTRING(p_value FROM '[Ee]-([0-9]+)$') IS NULL  -- Include non-scientific notation
    OR SUBSTRING(p_value FROM '[Ee]-([0-9]+)$')::INTEGER < 300  -- Include reasonable scientific notation
  );

-- Performance verification query (run this to test the index effectiveness)
-- EXPLAIN (ANALYZE, BUFFERS) SELECT study_accession, mapped_trait, p_value
-- FROM gwas_catalog
-- WHERE p_value IS NOT NULL
--   AND p_value != ''
--   AND p_value != 'NR'
--   AND p_value ~ '^[0-9]*\.?[0-9]+[Ee]-[0-9]+$'
-- LIMIT 100;