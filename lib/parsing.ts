export function parseSampleSize(text?: string | null): number | null {
  if (!text) {
    return null;
  }

  const matches = text.match(/\d[\d,]*/g);
  if (!matches) {
    return null;
  }

  let total = 0;
  for (const value of matches) {
    const numeric = Number(value.replace(/,/g, ""));
    if (!Number.isNaN(numeric)) {
      total += numeric;
    }
  }

  return total > 0 ? total : null;
}

export function parsePValue(raw?: string | null): number | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase().replace(/×/g, "x");

  if (/^\d+(\.\d+)?(e-?\d+)?$/.test(normalized)) {
    const value = Number(normalized);
    return Number.isNaN(value) ? null : value;
  }

  const scientificMatch = normalized.match(/([\d.]+)\s*x\s*10\s*\^\s*(-?\d+)/);
  if (scientificMatch) {
    const base = Number(scientificMatch[1]);
    const exponent = Number(scientificMatch[2]);
    if (!Number.isNaN(base) && !Number.isNaN(exponent)) {
      return base * 10 ** exponent;
    }
  }

  const inequalityMatch = normalized.match(/<\s*([\deE+\-.x^\s]+)/);
  if (inequalityMatch) {
    return parsePValue(inequalityMatch[1]);
  }

  return null;
}

export function parseLogPValue(raw?: string | null): number | null {
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

export function computeQualityFlags(sampleSize: number | null, pValue: number | null, logPValue: number | null): string[] {
  const flags: string[] = [];
  if (sampleSize !== null && sampleSize < 500) {
    flags.push("Small discovery cohort (<500 participants)");
  }
  if (pValue !== null && pValue > 5e-8) {
    flags.push("Association above genome-wide significance (p > 5e-8)");
  }
  if (logPValue !== null && logPValue < 6) {
    flags.push("Weak signal (−log10 p < 6)");
  }
  return flags;
}

export function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString();
}

export function formatPValue(value: number | null): string {
  if (value === null) {
    return "—";
  }
  if (value === 0) {
    return "0";
  }
  if (value < 1e-6) {
    return value.toExponential(2);
  }
  return value.toPrecision(2);
}
