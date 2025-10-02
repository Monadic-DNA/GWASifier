-- SQLite Index Optimization for GWAS Catalog
-- These indexes optimize the common query patterns used by GWASifier

-- Performance note: Run these after loading your data for optimal performance

-- 1. Search functionality indexes
-- Multi-column index for full-text search across key fields
CREATE INDEX IF NOT EXISTS idx_gwas_search_composite ON gwas_catalog(
    study,
    disease_trait,
    mapped_trait,
    first_author,
    mapped_gene,
    study_accession
);

-- Individual indexes for specific search patterns
CREATE INDEX IF NOT EXISTS idx_gwas_study_accession ON gwas_catalog(study_accession);
CREATE INDEX IF NOT EXISTS idx_gwas_disease_trait ON gwas_catalog(disease_trait);
CREATE INDEX IF NOT EXISTS idx_gwas_mapped_trait ON gwas_catalog(mapped_trait);
CREATE INDEX IF NOT EXISTS idx_gwas_first_author ON gwas_catalog(first_author);
CREATE INDEX IF NOT EXISTS idx_gwas_mapped_gene ON gwas_catalog(mapped_gene);

-- 2. Filtering indexes
-- P-value filtering (most common filter)
CREATE INDEX IF NOT EXISTS idx_gwas_pvalue ON gwas_catalog(p_value);

-- Sample size filtering
CREATE INDEX IF NOT EXISTS idx_gwas_sample_size ON gwas_catalog(initial_sample_size);

-- SNP-related indexes for genotype matching
CREATE INDEX IF NOT EXISTS idx_gwas_snps ON gwas_catalog(snps);
CREATE INDEX IF NOT EXISTS idx_gwas_risk_allele ON gwas_catalog(strongest_snp_risk_allele);

-- 3. Sorting and performance indexes
-- Publication date for chronological sorting
CREATE INDEX IF NOT EXISTS idx_gwas_date ON gwas_catalog(date);

-- Journal for academic filtering
CREATE INDEX IF NOT EXISTS idx_gwas_journal ON gwas_catalog(journal);

-- PubMed ID for external linking
CREATE INDEX IF NOT EXISTS idx_gwas_pubmedid ON gwas_catalog(pubmedid);

-- 4. Composite indexes for common filter combinations
-- P-value + sample size (quality filtering)
CREATE INDEX IF NOT EXISTS idx_gwas_quality_filters ON gwas_catalog(p_value, initial_sample_size);

-- Trait + p-value (trait-specific significance)
CREATE INDEX IF NOT EXISTS idx_gwas_trait_pvalue ON gwas_catalog(mapped_trait, p_value);

-- 5. Traits API optimization
-- For DISTINCT trait queries used by the traits endpoint
CREATE INDEX IF NOT EXISTS idx_gwas_traits_distinct ON gwas_catalog(
    COALESCE(NULLIF(TRIM(mapped_trait), ''), NULLIF(TRIM(disease_trait), ''))
) WHERE COALESCE(NULLIF(TRIM(mapped_trait), ''), NULLIF(TRIM(disease_trait), '')) IS NOT NULL;

-- 6. Study analysis indexes
-- For the analyze-study API that looks up specific studies
CREATE INDEX IF NOT EXISTS idx_gwas_study_lookup ON gwas_catalog(rowid, snps, strongest_snp_risk_allele, or_or_beta);

-- 7. Performance monitoring
-- Index for checking data completeness
CREATE INDEX IF NOT EXISTS idx_gwas_data_quality ON gwas_catalog(
    snps,
    strongest_snp_risk_allele,
    or_or_beta
) WHERE snps IS NOT NULL
  AND strongest_snp_risk_allele IS NOT NULL
  AND or_or_beta IS NOT NULL;

-- Index maintenance commands (run periodically for optimal performance)
-- ANALYZE gwas_catalog;
-- REINDEX gwas_catalog;

-- Performance tuning pragma settings for SQLite (uncomment if needed)
-- PRAGMA journal_mode = WAL;
-- PRAGMA synchronous = NORMAL;
-- PRAGMA cache_size = 10000;
-- PRAGMA temp_store = MEMORY;