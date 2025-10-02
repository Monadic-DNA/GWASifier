-- PostgreSQL Index Fixes for GWASifier
-- This file contains corrected versions of the indexes that failed

-- Fix 1: Remove rowid references (PostgreSQL doesn't have rowid)
-- Index for records with complete genotype data (using study_accession as identifier)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gwas_complete_genotype ON gwas_catalog(study_accession)
WHERE snps IS NOT NULL
  AND strongest_snp_risk_allele IS NOT NULL
  AND or_or_beta IS NOT NULL;

-- Fix 2: Remove rowid from stats index
-- Index for query planning (using study_accession instead of rowid)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gwas_stats ON gwas_catalog(study_accession, p_value, initial_sample_size);

-- Fix 3: Handle data type casting for numeric comparisons
-- P-value filtering with proper casting (assuming p_value is stored as VARCHAR)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gwas_significant_pvalue ON gwas_catalog(CAST(p_value AS FLOAT), mapped_trait)
WHERE p_value IS NOT NULL
  AND p_value != ''
  AND p_value != 'NR'
  AND CAST(p_value AS FLOAT) < 0.00001;

-- Fix 4: Sample size filtering with proper casting (assuming initial_sample_size is stored as VARCHAR)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gwas_large_studies ON gwas_catalog(CAST(initial_sample_size AS INTEGER), p_value)
WHERE initial_sample_size IS NOT NULL
  AND initial_sample_size != ''
  AND initial_sample_size != 'NR'
  AND initial_sample_size ~ '^[0-9]+$'
  AND CAST(initial_sample_size AS INTEGER) > 1000;

-- Alternative approaches if the above casting doesn't work:

-- Option A: String-based comparison for p_value (less optimal but functional)
-- Uncomment if the CAST approach fails
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gwas_significant_pvalue_str ON gwas_catalog(p_value, mapped_trait)
-- WHERE p_value IS NOT NULL
--   AND p_value LIKE '%E-%'  -- Scientific notation filter
--   AND LENGTH(p_value) > 4; -- Filter out very short values

-- Option B: String-based comparison for sample size (less optimal but functional)
-- Uncomment if the CAST approach fails
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gwas_large_studies_str ON gwas_catalog(initial_sample_size, p_value)
-- WHERE initial_sample_size IS NOT NULL
--   AND initial_sample_size ~ '^[0-9]{4,}$'; -- At least 4 digits (1000+)

-- Additional performance index that should work regardless of data types
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gwas_metadata_complete ON gwas_catalog(study_accession, mapped_trait)
WHERE study_accession IS NOT NULL
  AND mapped_trait IS NOT NULL
  AND p_value IS NOT NULL
  AND initial_sample_size IS NOT NULL;