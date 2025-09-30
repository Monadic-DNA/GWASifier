"use client";

import { useEffect, useMemo, useState } from "react";

type SortOption = "relevance" | "power" | "recent" | "alphabetical";

type Filters = {
  search: string;
  trait: string;
  minSampleSize: string;
  maxPValue: string;
  minLogP: string;
  excludeLowQuality: boolean;
  sort: SortOption;
  limit: number;
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
  sampleSize: number | null;
  sampleSizeLabel: string;
  pValueNumeric: number | null;
  pValueLabel: string;
  logPValue: number | null;
  qualityFlags: string[];
  isLowQuality: boolean;
};

type StudiesResponse = {
  data: Study[];
  total: number;
  limit: number;
  truncated: boolean;
  sourceCount: number;
  error?: string;
};

const defaultFilters: Filters = {
  search: "",
  trait: "",
  minSampleSize: "500",
  maxPValue: "5e-8",
  minLogP: "6",
  excludeLowQuality: true,
  sort: "relevance",
  limit: 75,
};

function buildQuery(filters: Filters): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit));
  params.set("sort", filters.sort);
  params.set("excludeLowQuality", String(filters.excludeLowQuality));
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
  if (filters.minLogP.trim()) {
    params.set("minLogP", filters.minLogP.trim());
  }
  return params.toString();
}

export default function HomePage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
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
    const query = buildQuery(filters);
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
        setStudies(payload.data ?? []);
        setMeta({
          total: payload.total ?? 0,
          limit: payload.limit ?? filters.limit,
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
  }, [filters]);

  const qualitySummary = useMemo(() => {
    const flagged = studies.filter((study) => study.isLowQuality).length;
    const highQuality = studies.length - flagged;
    return { flagged, highQuality };
  }, [studies]);

  const updateFilter = <Key extends keyof Filters>(key: Key, value: Filters[Key]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
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
    if (meta.truncated) {
      parts.push(`showing the top ${meta.limit}`);
    }
    if (qualitySummary.flagged > 0 && !filters.excludeLowQuality) {
      parts.push(`${qualitySummary.flagged} flagged as lower confidence`);
    }
    return parts.join(" · ");
  }, [studies.length, meta, loading, error, qualitySummary.flagged, filters.excludeLowQuality]);

  return (
    <main className="page">
      <header className="hero">
        <div>
          <h1>GWAS Catalog Explorer</h1>
          <p>
            Interactively explore genome-wide association studies with tools for spotlighting the most relevant, well-powered,
            and statistically robust findings.
          </p>
        </div>
        <button className="reset-button" type="button" onClick={resetFilters}>
          Reset filters
        </button>
      </header>

      <section className="panel">
        <div className="panel-section">
          <label htmlFor="search">Keyword search</label>
          <input
            id="search"
            type="search"
            placeholder="Search studies, authors, genes, or accession IDs"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
          />
        </div>
        <div className="panel-section">
          <label htmlFor="trait">Trait</label>
          <select id="trait" value={filters.trait} onChange={(event) => updateFilter("trait", event.target.value)}>
            <option value="">All traits</option>
            {traits.map((traitOption) => (
              <option key={traitOption} value={traitOption}>
                {traitOption}
              </option>
            ))}
          </select>
        </div>
        <div className="panel-section inline">
          <div>
            <label htmlFor="minSample">Minimum discovery sample size</label>
            <input
              id="minSample"
              type="number"
              min={0}
              step={100}
              value={filters.minSampleSize}
              onChange={(event) => updateFilter("minSampleSize", event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="maxPValue">Maximum p-value</label>
            <input
              id="maxPValue"
              type="text"
              inputMode="decimal"
              list="pvalue-presets"
              value={filters.maxPValue}
              onChange={(event) => updateFilter("maxPValue", event.target.value)}
            />
            <datalist id="pvalue-presets">
              <option value="5e-8">Genome-wide (5×10⁻⁸)</option>
              <option value="1e-6">1×10⁻⁶</option>
              <option value="1e-4">1×10⁻⁴</option>
              <option value="0.05">0.05</option>
            </datalist>
          </div>
          <div>
            <label htmlFor="minLogP">Minimum −log₁₀(p)</label>
            <input
              id="minLogP"
              type="number"
              step="0.5"
              value={filters.minLogP}
              onChange={(event) => updateFilter("minLogP", event.target.value)}
            />
          </div>
        </div>
        <div className="panel-section inline">
          <div>
            <label htmlFor="sort">Sort by</label>
            <select id="sort" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value as SortOption)}>
              <option value="relevance">Relevance (−log₁₀ p)</option>
              <option value="power">Power (sample size)</option>
              <option value="recent">Most recent</option>
              <option value="alphabetical">Study title</option>
            </select>
          </div>
          <div>
            <label htmlFor="limit">Results shown</label>
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
          <div className="toggle">
            <input
              id="qualityToggle"
              type="checkbox"
              checked={filters.excludeLowQuality}
              onChange={(event) => updateFilter("excludeLowQuality", event.target.checked)}
            />
            <label htmlFor="qualityToggle">Hide low-confidence studies</label>
          </div>
        </div>
      </section>

      <section className="summary" aria-live="polite">
        <p>{summaryText}</p>
        {qualitySummary.flagged > 0 && filters.excludeLowQuality && (
          <p>
            Hidden {qualitySummary.flagged} studies flagged as low confidence. Disable the toggle above to inspect them and review
            the quality notes.
          </p>
        )}
      </section>

      <section className="table-wrapper" aria-busy={loading}>
        <table>
          <thead>
            <tr>
              <th scope="col">Study</th>
              <th scope="col">Trait</th>
              <th scope="col">Relevance</th>
              <th scope="col">Power</th>
              <th scope="col">Effect</th>
              <th scope="col">Quality</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="loading-row">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && studies.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-row">
                  No studies found. Try widening your filters.
                </td>
              </tr>
            )}
            {!loading &&
              studies.map((study) => {
                const trait = study.mapped_trait ?? study.disease_trait ?? "—";
                const date = study.date ? new Date(study.date).toLocaleDateString() : "—";
                const relevance = study.logPValue ? study.logPValue.toFixed(2) : "—";
                const power = study.sampleSizeLabel ?? "—";
                const effect = study.or_or_beta ?? "—";
                const quality = study.qualityFlags.length > 0 ? study.qualityFlags.join("; ") : "High confidence";
                const studyLink = study.link || (study.pubmedid ? `https://pubmed.ncbi.nlm.nih.gov/${study.pubmedid}` : null);
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
                      <span className={study.isLowQuality ? "quality-flag" : "quality-good"}>{quality}</span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
