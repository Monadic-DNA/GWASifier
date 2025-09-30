"use client";

import { useEffect, useMemo, useState } from "react";

type SortField =
  | "relevance"
  | "pValue"
  | "beta"
  | "oddsRatio"
  | "sampleSize";

type SortDirection = "asc" | "desc";

type StudyFilters = {
  minPValue: string;
  maxPValue: string;
  minBeta: string;
  maxBeta: string;
  minOddsRatio: string;
  maxOddsRatio: string;
  minSampleSize: string;
  maxSampleSize: string;
  excludeLowQuality: boolean;
  excludeMissingGenotype: boolean;
  sort: SortField;
  direction: SortDirection;
};

type NumericFieldKey =
  | "minPValue"
  | "maxPValue"
  | "minBeta"
  | "maxBeta"
  | "minOddsRatio"
  | "maxOddsRatio"
  | "minSampleSize"
  | "maxSampleSize";

type Preset = {
  label: string;
  description?: string;
  filters: StudyFilters;
};

type Study = {
  accessionId: string;
  trait: string;
  pValue: number | null;
  beta: number | null;
  oddsRatio: number | null;
  sampleSize: number | null;
  isLowQuality: boolean;
  hasMissingGenotype: boolean;
};

type StudyResponse = {
  studies: Study[];
  totalCount: number;
};

const defaultFilters: StudyFilters = {
  minPValue: "",
  maxPValue: "",
  minBeta: "",
  maxBeta: "",
  minOddsRatio: "",
  maxOddsRatio: "",
  minSampleSize: "",
  maxSampleSize: "",
  excludeLowQuality: true,
  excludeMissingGenotype: true,
  sort: "relevance",
  direction: "desc",
};

export const unfilteredFilters: StudyFilters = {
  minPValue: "",
  maxPValue: "",
  minBeta: "",
  maxBeta: "",
  minOddsRatio: "",
  maxOddsRatio: "",
  minSampleSize: "",
  maxSampleSize: "",
  excludeLowQuality: false,
  excludeMissingGenotype: false,
  sort: "relevance",
  direction: "desc",
};

const presetFilters: Preset[] = [
  {
    label: "Default",
    description: "Balanced filters that hide low-quality and missing-genotype studies.",
    filters: defaultFilters,
  },
  {
    label: "Stringent QC",
    description: "Require higher effect sizes and sample counts for higher confidence.",
    filters: {
      ...defaultFilters,
      minBeta: "0.5",
      minOddsRatio: "1.5",
      minSampleSize: "10000",
    },
  },
];

const numberFields: Array<{
  key: NumericFieldKey;
  label: string;
  placeholder: string;
}> = [
  { key: "minPValue", label: "Min p-value", placeholder: "e.g. 1e-5" },
  { key: "maxPValue", label: "Max p-value", placeholder: "" },
  { key: "minBeta", label: "Min beta", placeholder: "" },
  { key: "maxBeta", label: "Max beta", placeholder: "" },
  { key: "minOddsRatio", label: "Min odds ratio", placeholder: "" },
  { key: "maxOddsRatio", label: "Max odds ratio", placeholder: "" },
  { key: "minSampleSize", label: "Min sample size", placeholder: "" },
  { key: "maxSampleSize", label: "Max sample size", placeholder: "" },
];

const formatNumber = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  if (Math.abs(value) >= 1000) {
    return value.toLocaleString();
  }

  if (Math.abs(value) < 0.001 && value !== 0) {
    return value.toExponential(2);
  }

  return value.toPrecision(3);
};

const buildQueryString = (filters: StudyFilters) => {
  const params = new URLSearchParams();

  const maybeSetRange = (
    minKey: keyof StudyFilters,
    maxKey: keyof StudyFilters,
    paramBase: string,
  ) => {
    const minValue = filters[minKey];
    const maxValue = filters[maxKey];

    if (minValue) {
      params.set(`min${paramBase}`, minValue);
    }

    if (maxValue) {
      params.set(`max${paramBase}`, maxValue);
    }
  };

  maybeSetRange("minPValue", "maxPValue", "PValue");
  maybeSetRange("minBeta", "maxBeta", "Beta");
  maybeSetRange("minOddsRatio", "maxOddsRatio", "OddsRatio");
  maybeSetRange("minSampleSize", "maxSampleSize", "SampleSize");

  params.set("excludeLowQuality", String(filters.excludeLowQuality));
  params.set(
    "excludeMissingGenotype",
    String(filters.excludeMissingGenotype),
  );
  params.set("sort", filters.sort);
  params.set("direction", filters.direction);

  const queryString = params.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
};

const useStudies = (filters: StudyFilters) => {
  const [studies, setStudies] = useState<Study[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchStudies = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/studies${buildQueryString(filters)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Failed to load studies (${response.status})`);
        }

        const payload = (await response.json()) as StudyResponse;
        setStudies(payload.studies ?? []);
        setTotalCount(payload.totalCount ?? payload.studies?.length ?? 0);
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") {
          return;
        }
        setError((fetchError as Error).message);
        setStudies([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudies();

    return () => {
      controller.abort();
    };
  }, [filters]);

  return { studies, totalCount, isLoading, error };
};

const isPresetActive = (preset: Preset, filters: StudyFilters) => {
  return (
    preset.filters.minPValue === filters.minPValue &&
    preset.filters.maxPValue === filters.maxPValue &&
    preset.filters.minBeta === filters.minBeta &&
    preset.filters.maxBeta === filters.maxBeta &&
    preset.filters.minOddsRatio === filters.minOddsRatio &&
    preset.filters.maxOddsRatio === filters.maxOddsRatio &&
    preset.filters.minSampleSize === filters.minSampleSize &&
    preset.filters.maxSampleSize === filters.maxSampleSize &&
    preset.filters.excludeLowQuality === filters.excludeLowQuality &&
    preset.filters.excludeMissingGenotype ===
      filters.excludeMissingGenotype &&
    preset.filters.sort === filters.sort &&
    preset.filters.direction === filters.direction
  );
};

export default function HomePage() {
  const [filters, setFilters] = useState<StudyFilters>(defaultFilters);
  const { studies, totalCount, isLoading, error } = useStudies(filters);

  const presetButtons = useMemo(
    () =>
      presetFilters.map((preset) => ({
        ...preset,
        active: isPresetActive(preset, filters),
      })),
    [filters],
  );

  const updateFilters = <Key extends keyof StudyFilters>(
    key: Key,
    value: StudyFilters[Key],
  ) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const studiesCountLabel = useMemo(() => {
    if (isLoading) {
      return "Loading studies…";
    }

    if (error) {
      return "Studies unavailable";
    }

    if (studies.length === totalCount) {
      return `${totalCount.toLocaleString()} studies`;
    }

    return `${studies.length.toLocaleString()} of ${totalCount.toLocaleString()} studies`;
  }, [error, isLoading, studies.length, totalCount]);

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-slate-100 p-6 text-slate-900">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">GWASifier studies</h1>
          <p className="text-sm text-slate-600">
            Explore genome-wide association studies and tailor the catalogue to
            your thresholds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {presetButtons.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setFilters({ ...preset.filters })}
              className={`rounded border px-3 py-1 text-sm font-medium shadow-sm transition ${
                preset.active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilters({ ...defaultFilters })}
            className="rounded border border-slate-200 bg-slate-100 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-200"
          >
            Reset filters
          </button>
          <button
            type="button"
            onClick={() => setFilters(unfilteredFilters)}
            className="rounded border border-transparent bg-indigo-600 px-3 py-1 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
          >
            Show all studies
          </button>
        </div>
      </header>

      <section className="grid gap-4 rounded-lg bg-white p-4 shadow">
        <h2 className="text-lg font-semibold">Filter criteria</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {numberFields.map(({ key, label, placeholder }) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">{label}</span>
              <input
                type="text"
                inputMode="decimal"
                value={filters[key] as string}
                onChange={(event) =>
                  updateFilters(key, event.target.value)
                }
                placeholder={placeholder}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.excludeLowQuality}
                onChange={(event) =>
                  updateFilters("excludeLowQuality", event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Exclude low-quality studies
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.excludeMissingGenotype}
                onChange={(event) =>
                  updateFilters(
                    "excludeMissingGenotype",
                    event.target.checked,
                  )
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Exclude missing-genotype studies
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Sort by</span>
              <select
                value={filters.sort}
                onChange={(event) =>
                  updateFilters("sort", event.target.value as SortField)
                }
                className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="relevance">Relevance</option>
                <option value="pValue">p-value</option>
                <option value="beta">Beta</option>
                <option value="oddsRatio">Odds ratio</option>
                <option value="sampleSize">Sample size</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Direction</span>
              <select
                value={filters.direction}
                onChange={(event) =>
                  updateFilters(
                    "direction",
                    event.target.value as SortDirection,
                  )
                }
                className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg bg-white p-4 shadow">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Matching studies</h2>
          <span className="text-sm text-slate-600">{studiesCountLabel}</span>
        </header>
        {error ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                  Study
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                  Trait
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">
                  p-value
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">
                  Beta
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">
                  Odds ratio
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">
                  Sample size
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm text-slate-500"
                  >
                    Loading studies…
                  </td>
                </tr>
              ) : studies.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm text-slate-500"
                  >
                    No studies matched the selected filters.
                  </td>
                </tr>
              ) : (
                studies.map((study) => (
                  <tr key={study.accessionId}>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {study.accessionId}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{study.trait}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatNumber(study.pValue)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatNumber(study.beta)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatNumber(study.oddsRatio)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {study.sampleSize ? study.sampleSize.toLocaleString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
