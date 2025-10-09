"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { GenotypeProvider, useGenotype } from "./components/UserDataUpload";
import { ResultsProvider, useResults } from "./components/ResultsContext";
import StudyResultReveal from "./components/StudyResultReveal";
import MenuBar from "./components/MenuBar";
import VariantChips from "./components/VariantChips";
import Footer from "./components/Footer";
import DisclaimerModal from "./components/DisclaimerModal";
import TermsAcceptanceModal from "./components/TermsAcceptanceModal";
import { hasMatchingSNPs } from "@/lib/snp-utils";

type SortOption = "relevance" | "power" | "recent" | "alphabetical";
type SortDirection = "asc" | "desc";
type ConfidenceBand = "high" | "medium" | "low";

type Filters = {
  search: string;
  trait: string;
  minSampleSize: string;
  maxPValue: string;
  excludeLowQuality: boolean;
  excludeMissingGenotype: boolean;
  requireUserSNPs: boolean;
  sort: SortOption;
  sortDirection: SortDirection;
  limit: number;
  confidenceBand: ConfidenceBand | null;
};

type Study = {
  id: number;
  study_accession: string | null;
  study: string | null;
  disease_trait: string | null;
  mapped_trait: string | null;
  mapped_trait_uri: string | null;
  mapped_gene: string | null;
  first_author: string | null;
  date: string | null;
  journal: string | null;
  pubmedid: string | null;
  link: string | null;
  initial_sample_size: string | null;
  replication_sample_size: string | null;
  p_value: string | null;
  pvalue_mlog: string | null;
  or_or_beta: string | null;
  risk_allele_frequency: string | null;
  strongest_snp_risk_allele: string | null;
  snps: string | null;
  sampleSize: number | null;
  sampleSizeLabel: string;
  pValueNumeric: number | null;
  pValueLabel: string;
  logPValue: number | null;
  qualityFlags: string[];
  isLowQuality: boolean;
  confidenceBand: ConfidenceBand;
  publicationDate: number | null;
};

type StudiesResponse = {
  data: Study[];
  total: number;
  limit: number;
  truncated: boolean;
  sourceCount: number;
  error?: string;
};

type QualitySummary = {
  high: number;
  medium: number;
  low: number;
  flagged: number;
};

const defaultFilters: Filters = {
  search: "",
  trait: "",
  minSampleSize: "500",
  maxPValue: "5e-8",
  excludeLowQuality: true,
  excludeMissingGenotype: true,
  requireUserSNPs: false,
  sort: "relevance",
  sortDirection: "desc",
  limit: 75,
  confidenceBand: null,
};


function InfoIcon({ text }: { text: string }) {
  return (
    <span className="info-icon" role="img" aria-label="Help" title={text}>
      ⓘ
    </span>
  );
}

function parseVariantIds(snps: string | null): string[] {
  if (!snps) {
    return [];
  }
  return snps
    .split(/[;,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

function buildQuery(filters: Filters): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit));
  params.set("sort", filters.sort);
  params.set("direction", filters.sortDirection);
  params.set("excludeLowQuality", String(filters.excludeLowQuality));
  params.set("excludeMissingGenotype", String(filters.excludeMissingGenotype));
  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }
  if (filters.trait) {
    params.set("trait", filters.trait);
  }
  if (filters.minSampleSize.trim()) {
    params.set("minSampleSize", filters.minSampleSize.trim());
  }
  if (filters.maxPValue.trim()) {
    params.set("maxPValue", filters.maxPValue.trim());
  }
  if (filters.confidenceBand) {
    params.set("confidenceBand", filters.confidenceBand);
  }
  return params.toString();
}

function MainContent() {
  const { genotypeData, isUploaded, setOnDataLoadedCallback } = useGenotype();
  const { setOnResultsLoadedCallback } = useResults();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(defaultFilters.search);
  const [traits, setTraits] = useState<string[]>([]);
  const [studies, setStudies] = useState<Study[]>([]);
  const [meta, setMeta] = useState<Omit<StudiesResponse, "data" | "error">>({
    total: 0,
    limit: defaultFilters.limit,
    truncated: false,
    sourceCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionCollapsed, setSectionCollapsed] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loadTime, setLoadTime] = useState<number | null>(null);

  // Check if user has accepted terms on mount
  useEffect(() => {
    const termsAccepted = localStorage.getItem('terms_accepted');
    if (!termsAccepted) {
      setShowTermsModal(true);
    }
  }, []);

  // Debounce search input to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 400);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const updateFilter = useCallback(<Key extends keyof Filters>(key: Key, value: Filters[Key]) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key !== "confidenceBand") {
        next.confidenceBand = null;
      }
      return next;
    });
  }, []);

  // Set up callback to auto-check "Only my variants" when genotype data is loaded
  useEffect(() => {
    setOnDataLoadedCallback(() => {
      updateFilter("requireUserSNPs", true);
    });
  }, [setOnDataLoadedCallback, updateFilter]);

  useEffect(() => {
    let active = true;
    fetch("/api/traits")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load traits");
        }
        const payload = (await response.json()) as { traits: string[]; error?: string };
        if (!active) return;
        if (payload.error) {
          throw new Error(payload.error);
        }
        setTraits(payload.traits ?? []);
      })
      .catch(() => {
        if (!active) return;
        setTraits([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Use debounced search value for API call
    const apiFilters = { ...filters, search: debouncedSearch };
    const query = buildQuery(apiFilters);
    const startTime = performance.now();
    setLoading(true);
    setError(null);

    fetch(`/api/studies?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Failed to load studies");
        }
        const payload = (await response.json()) as StudiesResponse;
        if (payload.error) {
          throw new Error(payload.error);
        }

        let filteredData = payload.data ?? [];

        // Client-side filtering for user SNPs
        if (apiFilters.requireUserSNPs && genotypeData) {
          filteredData = filteredData.filter(study => {
            // First check if study has matching SNPs with user data
            const hasUserSNPs = hasMatchingSNPs(genotypeData, study.snps);
            if (!hasUserSNPs) return false;

            // If "Require genotype" is also enabled, ensure the study has genotype data
            if (apiFilters.excludeMissingGenotype) {
              const hasGenotype = study.strongest_snp_risk_allele &&
                study.strongest_snp_risk_allele.trim().length > 0 &&
                study.strongest_snp_risk_allele.trim() !== '?' &&
                study.strongest_snp_risk_allele.trim() !== 'NR' &&
                !study.strongest_snp_risk_allele.includes('?');
              return hasGenotype;
            }

            return true;
          });
        }

        const endTime = performance.now();
        setLoadTime(endTime - startTime);

        setStudies(filteredData);
        setMeta({
          total: filteredData.length,
          limit: payload.limit ?? apiFilters.limit,
          truncated: payload.truncated ?? false,
          sourceCount: payload.sourceCount ?? 0,
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load studies");
        setStudies([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [debouncedSearch, filters.trait, filters.minSampleSize, filters.maxPValue, filters.excludeLowQuality, filters.excludeMissingGenotype, filters.requireUserSNPs, filters.sort, filters.sortDirection, filters.limit, filters.confidenceBand, genotypeData]);

  const qualitySummary = useMemo<QualitySummary>(() => {
    return studies.reduce<QualitySummary>(
      (acc, study) => {
        acc[study.confidenceBand] += 1;
        if (study.isLowQuality) {
          acc.flagged += 1;
        }
        return acc;
      },
      { high: 0, medium: 0, low: 0, flagged: 0 },
    );
  }, [studies]);

  const resetFilters = () => {
    setFilters(defaultFilters);
    setDebouncedSearch(defaultFilters.search);
  };


  const handleColumnSort = (sortKey: SortOption) => {
    if (filters.sort === sortKey) {
      // Same column clicked, toggle direction
      updateFilter("sortDirection", filters.sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column clicked, set to desc (most common use case)
      updateFilter("sort", sortKey);
      updateFilter("sortDirection", "desc");
    }
  };

  const handleStudyColumnSort = () => {
    // Study column cycles between alphabetical and recent
    if (filters.sort === "alphabetical") {
      handleColumnSort("recent");
    } else if (filters.sort === "recent") {
      // Toggle direction for recent
      updateFilter("sortDirection", filters.sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Start with alphabetical
      handleColumnSort("alphabetical");
    }
  };

  const summaryText = useMemo(() => {
    if (error) {
      return error;
    }
    if (loading) {
      return "Loading studies…";
    }
    if (studies.length === 0) {
      return "No studies match the current filters.";
    }
    const parts = [
      `${studies.length} of ${meta.total} quality-filtered studies`,
      `${meta.sourceCount.toLocaleString()} matches before quality filters`,
    ];
    if (loadTime !== null) {
      parts.push(`loaded in ${Math.round(loadTime)}ms`);
    }
    const breakdown: string[] = [];
    if (qualitySummary.high > 0) {
      breakdown.push(`${qualitySummary.high} high`);
    }
    if (qualitySummary.medium > 0) {
      breakdown.push(`${qualitySummary.medium} medium`);
    }
    if ((qualitySummary.low > 0 && !filters.excludeLowQuality) || filters.confidenceBand === "low") {
      breakdown.push(`${qualitySummary.low} low`);
    }
    if (breakdown.length > 0) {
      parts.push(`Confidence mix: ${breakdown.join(", ")}`);
    }
    if (meta.truncated) {
      parts.push(`showing the top ${meta.limit}`);
    }
    if (qualitySummary.flagged > 0 && !filters.excludeLowQuality) {
      parts.push(`${qualitySummary.flagged} flagged as lower confidence`);
    }
    return parts.join(" · ");
  }, [
    studies.length,
    meta,
    loading,
    error,
    loadTime,
    qualitySummary.high,
    qualitySummary.medium,
    qualitySummary.low,
    qualitySummary.flagged,
    filters.excludeLowQuality,
    filters.confidenceBand,
  ]);

  return (
    <div className="app-container">
      <TermsAcceptanceModal
        isOpen={showTermsModal}
        onAccept={() => setShowTermsModal(false)}
      />
      <MenuBar />
      <main className="page">
        <section className={`panel ${sectionCollapsed ? "collapsed" : ""}`}>
        <div className="panel-header">
          <div className="hero-title-section">
            {!sectionCollapsed && (
              <>
                <h2>Study Filters</h2>
                <p>Filter genetic association studies by various criteria.</p>
              </>
            )}
            {sectionCollapsed && <h3>Study Filters</h3>}
          </div>
          <div className="hero-controls">
            {!sectionCollapsed && (
              <button className="reset-button" type="button" onClick={resetFilters}>
                Reset filters
              </button>
            )}
            <button
              className="collapse-button"
              type="button"
              onClick={() => setSectionCollapsed(!sectionCollapsed)}
              title={sectionCollapsed ? "Expand" : "Collapse"}
            >
              {sectionCollapsed ? "↓" : "↑"}
            </button>
          </div>
        </div>
        {!sectionCollapsed && (
          <div className="panel-content">
            <div className="panel-row">
              <div className="panel-field">
                <label htmlFor="search">
                  Search <InfoIcon text="Search titles, authors, genes, accessions." />
                </label>
                <input
                  id="search"
                  type="search"
                  placeholder="Keywords..."
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                />
              </div>
              <div className="panel-field">
                <label htmlFor="trait">
                  Trait <InfoIcon text="Autocomplete from GWAS Catalog traits." />
                </label>
                <input
                  id="trait"
                  type="text"
                  list="trait-options"
                  placeholder="All traits"
                  value={filters.trait}
                  onChange={(event) => updateFilter("trait", event.target.value)}
                />
                <datalist id="trait-options">
                  {traits.map((traitOption) => (
                    <option key={traitOption} value={traitOption} />
                  ))}
                </datalist>
              </div>
              <div className="panel-field">
                <label htmlFor="minSample">
                  Min samples <InfoIcon text="Filter by discovery cohort size." />
                </label>
                <input
                  id="minSample"
                  type="number"
                  min={0}
                  step={100}
                  placeholder="500"
                  value={filters.minSampleSize}
                  onChange={(event) => updateFilter("minSampleSize", event.target.value)}
                />
              </div>
            </div>
            <div className="panel-row">
              <div className="panel-field">
                <label htmlFor="maxPValue">
                  Max p-value <InfoIcon text="Statistical significance threshold." />
                </label>
                <select
                  id="maxPValue"
                  value={filters.maxPValue}
                  onChange={(event) => updateFilter("maxPValue", event.target.value)}
                >
                  <option value="">Any significance (including non-significant)</option>
                  <option value="0.1">p ≤ 0.1 (Trend/suggestive)</option>
                  <option value="0.05">p ≤ 0.05 (Traditional threshold)</option>
                  <option value="0.01">p ≤ 0.01 (Strong evidence)</option>
                  <option value="1e-3">p ≤ 0.001 (Very strong)</option>
                  <option value="1e-4">p ≤ 1×10⁻⁴ (Extremely strong)</option>
                  <option value="1e-6">p ≤ 1×10⁻⁶ (Highly significant)</option>
                  <option value="5e-8">p ≤ 5×10⁻⁸ (Genome-wide significant)</option>
                  <option value="5e-9">p ≤ 5×10⁻⁹ (Ultra-stringent)</option>
                </select>
              </div>
              <div className="panel-field">
                <label htmlFor="limit">
                  Results <InfoIcon text="Number of studies to show." />
                </label>
                <select
                  id="limit"
                  value={filters.limit}
                  onChange={(event) => updateFilter("limit", Number(event.target.value))}
                >
                  {[25, 50, 75, 100, 150, 200].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <div className="panel-field checkbox-field">
                <input
                  id="genotypeToggle"
                  type="checkbox"
                  checked={filters.excludeMissingGenotype}
                  onChange={(event) => updateFilter("excludeMissingGenotype", event.target.checked)}
                />
                <label htmlFor="genotypeToggle">
                  Require genotype <InfoIcon text="Hide associations without SNP risk allele." />
                </label>
              </div>
              {isUploaded && (
                <div className="panel-field checkbox-field">
                  <input
                    id="userSNPToggle"
                    type="checkbox"
                    checked={filters.requireUserSNPs}
                    onChange={(event) => updateFilter("requireUserSNPs", event.target.checked)}
                  />
                  <label htmlFor="userSNPToggle">
                    Only my variants <InfoIcon text="Show only studies with SNPs in your personal data." />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="summary" aria-live="polite">
        <p>{summaryText}</p>

      </section>

      <section className="table-wrapper" aria-busy={loading}>
        <div className="table-scroll-container">
        <table>
          <thead>
            <tr>
              <th
                scope="col"
                title="Click to sort by study title or publication date. Cycles between alphabetical and recent."
                className={`sortable ${filters.sort === "alphabetical" || filters.sort === "recent" ? "sorted" : ""}`}
                onClick={handleStudyColumnSort}
              >
                Study {filters.sort === "recent" && "(by date)"}
                <span className="info-icon">ⓘ</span>
                {(filters.sort === "alphabetical" || filters.sort === "recent") && (
                  <span className="sort-indicator">{filters.sortDirection === "asc" ? " ↑" : " ↓"}</span>
                )}
              </th>
              <th scope="col" title="The health condition, disease, or measurable characteristic that was studied. For example: height, diabetes, or blood pressure.">
                Trait <span className="info-icon">ⓘ</span>
              </th>
              <th scope="col" title="The specific genetic variant (SNP) associated with the trait. These are locations in DNA where people differ from each other. Click variants to see detailed genetic information.">
                Variant <span className="info-icon">ⓘ</span>
              </th>
              <th
                scope="col"
                title="Statistical strength of the finding. Click to sort by relevance (-log₁₀ p-value)."
                className={`sortable ${filters.sort === "relevance" ? "sorted" : ""}`}
                onClick={() => handleColumnSort("relevance")}
              >
                Relevance
                <span className="info-icon">ⓘ</span>
                {filters.sort === "relevance" && (
                  <span className="sort-indicator">{filters.sortDirection === "asc" ? " ↑" : " ↓"}</span>
                )}
              </th>
              <th
                scope="col"
                title="How many people were studied. Click to sort by sample size (study power)."
                className={`sortable ${filters.sort === "power" ? "sorted" : ""}`}
                onClick={() => handleColumnSort("power")}
              >
                Power
                <span className="info-icon">ⓘ</span>
                {filters.sort === "power" && (
                  <span className="sort-indicator">{filters.sortDirection === "asc" ? " ↑" : " ↓"}</span>
                )}
              </th>
              <th scope="col" title="How much this genetic variant changes the trait. For diseases, this might be odds ratio (how much more likely you are to get the disease). For measurements like height, it's the average difference.">
                Effect <span className="info-icon">ⓘ</span>
              </th>
              <th scope="col" title="Our assessment of study reliability based on sample size, statistical significance, and data quality. High confidence studies are most trustworthy.">
                Quality <span className="info-icon">ⓘ</span>
              </th>
              <th scope="col" title="Your personal genetic result for this study. Upload your 23andMe data to see your results.">
                Your Result <span className="info-icon">ⓘ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="loading-row">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && studies.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">
                  No studies found. Try widening your filters.
                </td>
              </tr>
            )}
            {!loading &&
              studies.map((study) => {
                const trait = study.mapped_trait ?? study.disease_trait ?? "—";
                const date = study.publicationDate
                  ? new Date(study.publicationDate).toLocaleDateString()
                  : study.date
                  ? new Date(study.date).toLocaleDateString() || study.date
                  : "—";
                const relevance = study.logPValue ? study.logPValue.toFixed(2) : "—";
                const power = study.sampleSizeLabel ?? "—";
                const effect = study.or_or_beta ?? "—";
                const gwasLink = study.study_accession
                  ? `https://www.ebi.ac.uk/gwas/studies/${study.study_accession}`
                  : null;
                const studyLink =
                  gwasLink || study.link || (study.pubmedid ? `https://pubmed.ncbi.nlm.nih.gov/${study.pubmedid}` : null);
                const variantIds = parseVariantIds(study.snps);
                const variantGenotype = study.strongest_snp_risk_allele?.trim() ?? "";
                const hasGenotype = variantGenotype.length > 0;
                const confidenceLabel =
                  study.confidenceBand === "high"
                    ? "High confidence"
                    : study.confidenceBand === "medium"
                    ? "Medium confidence"
                    : "Lower confidence";
                return (
                  <tr key={study.id} className={study.isLowQuality ? "low-quality" : undefined}>
                    <td>
                      <div className="study-title">
                        {studyLink ? (
                          <a href={studyLink} target="_blank" rel="noreferrer">
                            {study.study ?? "Untitled study"}
                          </a>
                        ) : (
                          study.study ?? "Untitled study"
                        )}
                      </div>
                      <div className="study-meta">
                        <span>{study.first_author ?? "Unknown author"}</span>
                        <span>{date}</span>
                        {study.study_accession && <span>{study.study_accession}</span>}
                        {study.mapped_gene && <span>Gene: {study.mapped_gene}</span>}
                      </div>
                    </td>
                    <td>{trait}</td>
                    <td>
                      <VariantChips snps={study.snps} riskAllele={study.strongest_snp_risk_allele} />
                    </td>
                    <td>
                      <span className="metric">{relevance}</span>
                      {study.pValueNumeric !== null && (
                        <span className="submetric">p = {study.pValueLabel}</span>
                      )}
                    </td>
                    <td>
                      <span className="metric">{power}</span>
                      {study.initial_sample_size && (
                        <span className="submetric">Initial: {study.initial_sample_size}</span>
                      )}
                      {study.replication_sample_size && (
                        <span className="submetric">Replication: {study.replication_sample_size}</span>
                      )}
                    </td>
                    <td>
                      <span className="metric">{effect}</span>
                      {study.risk_allele_frequency && (
                        <span className="submetric">RAF: {study.risk_allele_frequency}</span>
                      )}
                    </td>
                    <td>
                      <div className="quality-cell">
                        <span className={`quality-pill ${study.confidenceBand}`}>{confidenceLabel}</span>
                        {study.qualityFlags.length > 0 && (
                          <div className="quality-flags">
                            {study.qualityFlags.map((flag) => (
                              <span key={flag} className="quality-flag">
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <StudyResultReveal 
                        studyId={study.id} 
                        snps={study.snps}
                        traitName={trait}
                        studyTitle={study.study || "Untitled study"}
                      />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        </div>
      </section>
      </main>
      <Footer />
    </div>
  );
}

export default function HomePage() {
  return (
    <GenotypeProvider>
      <ResultsProvider>
        <MainContent />
      </ResultsProvider>
    </GenotypeProvider>
  );
}
