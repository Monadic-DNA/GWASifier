"use client";

import { useMemo, useState } from "react";

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

type Preset = {
  label: string;
  filters: StudyFilters;
};

const presets: Preset[] = [
  {
    label: "Default",
    filters: defaultFilters,
  },
];

export default function HomePage() {
  const [filters, setFilters] = useState<StudyFilters>(defaultFilters);

  const presetsWithHandlers = useMemo(
    () =>
      presets.map((preset) => ({
        ...preset,
        onClick: () => setFilters({ ...preset.filters }),
      })),
    [setFilters]
  );

  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">GWASifier studies</h1>
        <div className="flex flex-wrap items-center gap-2">
          {presetsWithHandlers.map((preset) => (
            <button
              key={preset.label}
              onClick={preset.onClick}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setFilters({ ...defaultFilters })}
            className="rounded border border-slate-200 bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200"
          >
            Reset filters
          </button>
          <button
            onClick={() => setFilters({ ...unfilteredFilters })}
            className="rounded border border-transparent bg-slate-800 px-3 py-1 text-sm text-white shadow-sm hover:bg-slate-700"
          >
            Show all studies
          </button>
        </div>
      </header>
      <section>
        <pre className="rounded bg-slate-900 p-4 text-xs text-slate-100">
          {JSON.stringify(filters, null, 2)}
        </pre>
      </section>
    </main>
  );
}
