import { NextRequest, NextResponse } from "next/server";

import { executeQuery, executeQuerySingle, getDbType } from "@/lib/db";
import { validateOrigin } from "@/lib/origin-validator";
import {
  computeQualityFlags,
  formatNumber,
  formatPValue,
  parseLogPValue,
  parsePValue,
  parseSampleSize,
  QualityFlag,
} from "@/lib/parsing";

type ConfidenceBand = "high" | "medium" | "low";

type RawStudy = {
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
};

type Study = RawStudy & {
  sampleSize: number | null;
  sampleSizeLabel: string;
  pValueNumeric: number | null;
  pValueLabel: string;
  logPValue: number | null;
  qualityFlags: QualityFlag[];
  isLowQuality: boolean;
  confidenceBand: ConfidenceBand;
  publicationDate: number | null;
};

function normalizeYear(value: string): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  if (value.length === 2) {
    return numeric >= 70 ? 1900 + numeric : 2000 + numeric;
  }
  if (value.length === 3) {
    return numeric >= 100 ? numeric : null;
  }
  if (numeric < 0) {
    return null;
  }
  return numeric;
}

function buildUtcTimestamp(year: number | null, month: number | null, day: number | null): number | null {
  if (year === null || month === null || day === null) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.getTime();
}

function parseNumericDate(parts: [number, number, number], assumeDayFirst: boolean): number | null {
  const [first, second, year] = parts;
  const month = assumeDayFirst ? second : first;
  const day = assumeDayFirst ? first : second;
  return buildUtcTimestamp(year, month, day);
}

const monthNames: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function monthFromName(name: string | undefined): number | null {
  if (!name) {
    return null;
  }
  const key = name.trim().toLowerCase();
  if (!key) {
    return null;
  }
  return monthNames[key] ?? null;
}

function parseStudyDate(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const direct = Date.parse(trimmed);
  if (!Number.isNaN(direct)) {
    return direct;
  }

  const slashMatch = trimmed.match(/^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{2,4})$/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = normalizeYear(slashMatch[3]);
    if (!Number.isFinite(first) || !Number.isFinite(second) || year === null) {
      return null;
    }
    return (
      parseNumericDate([first, second, year], false) ??
      parseNumericDate([first, second, year], true)
    );
  }

  const textualDayFirst = trimmed.match(/^([0-9]{1,2})\s+([A-Za-z]+)\s+([0-9]{2,4})$/);
  if (textualDayFirst) {
    const day = Number(textualDayFirst[1]);
    const month = monthFromName(textualDayFirst[2]);
    const year = normalizeYear(textualDayFirst[3]);
    if (!Number.isFinite(day) || month === null || year === null) {
      return null;
    }
    return buildUtcTimestamp(year, month, day);
  }

  const textualMonthFirst = trimmed.match(/^([A-Za-z]+)[\s-]+([0-9]{1,2}),?\s*([0-9]{2,4})$/);
  if (textualMonthFirst) {
    const month = monthFromName(textualMonthFirst[1]);
    const day = Number(textualMonthFirst[2]);
    const year = normalizeYear(textualMonthFirst[3]);
    if (month === null || !Number.isFinite(day) || year === null) {
      return null;
    }
    return buildUtcTimestamp(year, month, day);
  }

  return null;
}

function parseInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function determineConfidenceBand(
  sampleSize: number | null,
  pValue: number | null,
  logPValue: number | null,
  qualityFlags: Array<{ severity: string }>,
): ConfidenceBand {
  // Only downgrade to low if there are MAJOR quality issues
  const hasMajorFlags = qualityFlags.some(flag => flag.severity === 'major');

  if (hasMajorFlags) {
    return "low";
  }

  const meetsHigh =
    sampleSize !== null &&
    sampleSize >= 5000 &&
    logPValue !== null &&
    logPValue >= 9 &&
    (pValue === null || pValue <= 5e-9);

  if (meetsHigh) {
    return "high";
  }

  const meetsMedium =
    ((sampleSize ?? 0) >= 2000 || (logPValue ?? 0) >= 7) &&
    (pValue === null || pValue <= 1e-6);

  if (meetsMedium) {
    return "medium";
  }

  // Minor flags don't prevent medium classification
  // but studies with minor flags and not meeting medium criteria are low
  return "low";
}

export async function GET(request: NextRequest) {
  // Validate origin
  const originError = validateOrigin(request);
  if (originError) return originError;

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search")?.trim();
  const trait = searchParams.get("trait")?.trim();

  // Special parameter for "Run All" - fetches all studies with SNPs
  const fetchAll = searchParams.get("fetchAll") === "true";
  // Allow larger batches for pagination (up to 100000 for Run All with fetchAll)
  const requestedLimit = Number(searchParams.get("limit")) || 75;
  const limit = fetchAll ? Math.max(10, Math.min(requestedLimit, 100000)) : Math.max(10, Math.min(requestedLimit, 50000));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const sort = searchParams.get("sort") ?? "relevance";
  const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";
  const minSampleSize = parseInteger(searchParams.get("minSampleSize"));
  const maxPValueRaw = searchParams.get("maxPValue");
  const minLogPRaw = searchParams.get("minLogP");
  const excludeLowQuality = searchParams.get("excludeLowQuality") === "false" ? false : true;
  const excludeMissingGenotype = searchParams.get("excludeMissingGenotype") === "false" ? false : true;
  const confidenceBandParam = searchParams.get("confidenceBand");
  const confidenceBandFilter: ConfidenceBand | null =
    confidenceBandParam === "high" || confidenceBandParam === "medium" || confidenceBandParam === "low"
      ? (confidenceBandParam as ConfidenceBand)
      : null;

  const filters: string[] = [];
  const params: unknown[] = [];

  if (search) {
    const wildcard = `%${search}%`;
    filters.push(
      "(study LIKE ? OR disease_trait LIKE ? OR mapped_trait LIKE ? OR first_author LIKE ? OR mapped_gene LIKE ? OR study_accession LIKE ?)",
    );
    params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
  }

  if (trait) {
    filters.push("(mapped_trait = ? OR disease_trait = ?)");
    params.push(trait, trait);
  }

  // For fetchAll, always require SNPs and risk alleles (since we're doing SNP matching)
  if (fetchAll) {
    filters.push("(snps IS NOT NULL AND snps != '')");
    filters.push("(strongest_snp_risk_allele IS NOT NULL AND strongest_snp_risk_allele != '')");
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  // Use appropriate ID selection based on database type
  const dbType = getDbType();
  // NOTE: hashtext() is a 32-bit non-cryptographic hash with potential collision risk.
  // For production with high study volumes, consider migrating to a stable UUID column
  // computed during data ingestion to eliminate collision probability.
  // Current risk is low given GWAS catalog size (~hundreds of thousands of studies) and
  // the composite key includes multiple discriminating fields (accession, SNPs, p-value, OR).
  const idSelection = dbType === 'postgres'
    ? 'hashtext(COALESCE(study_accession, \'\') || COALESCE(snps, \'\') || COALESCE(strongest_snp_risk_allele, \'\') || COALESCE(p_value, \'\') || COALESCE(or_or_beta::text, \'\')) AS id'
    : 'rowid AS id';

  const baseQuery = `SELECT ${idSelection},
       study_accession,
       study,
       disease_trait,
       mapped_trait,
       mapped_trait_uri,
       mapped_gene,
       first_author,
       date,
       journal,
       pubmedid,
       link,
       initial_sample_size,
       replication_sample_size,
       p_value,
       pvalue_mlog,
       or_or_beta,
       risk_allele_frequency,
       strongest_snp_risk_allele,
       snps
    FROM gwas_catalog
    ${whereClause}
    LIMIT ? OFFSET ?`;
  // When fetching for Run All (no filters except SNP requirements), allow full batch size
  // Otherwise use the 4x multiplier with 800 cap for filtered queries
  const isRunAllQuery = excludeLowQuality === false && excludeMissingGenotype === false && !search && !trait;
  const rawLimit = fetchAll ? limit : (isRunAllQuery ? limit : Math.min(limit * 4, 800));

  try {
    const rawRows = await executeQuery<RawStudy>(baseQuery, [...params, rawLimit, offset]);

  const maxPValue = maxPValueRaw ? parsePValue(maxPValueRaw) : null;
  const minLogP = minLogPRaw ? Number(minLogPRaw) : null;

  const studies: Study[] = rawRows
    .map((row) => {
      const sampleSize = parseSampleSize(row.initial_sample_size) ?? parseSampleSize(row.replication_sample_size);
      const pValueNumeric = parsePValue(row.p_value);
      const logPValue = parseLogPValue(row.pvalue_mlog) ?? (pValueNumeric ? -Math.log10(pValueNumeric) : null);
      const qualityFlags = computeQualityFlags(sampleSize, pValueNumeric, logPValue);
      const hasMajorFlags = qualityFlags.some(f => f.severity === 'major');
      const isLowQuality = hasMajorFlags; // Only major flags indicate truly low quality
      const confidenceBand = determineConfidenceBand(sampleSize, pValueNumeric, logPValue, qualityFlags);
      const publicationDate = parseStudyDate(row.date);
      return {
        ...row,
        sampleSize,
        sampleSizeLabel: formatNumber(sampleSize),
        pValueNumeric,
        pValueLabel: formatPValue(pValueNumeric),
        logPValue,
        qualityFlags,
        isLowQuality,
        confidenceBand,
        publicationDate,
      } satisfies Study;
    })
    .filter((row) => {
      if (minSampleSize && row.sampleSize !== null && row.sampleSize < minSampleSize) {
        return false;
      }
      if (minSampleSize && row.sampleSize === null) {
        return false;
      }
      if (maxPValue !== null && row.pValueNumeric !== null && row.pValueNumeric > maxPValue) {
        return false;
      }
      if (maxPValue !== null && row.pValueNumeric === null) {
        return false;
      }
      if (minLogP !== null && row.logPValue !== null && row.logPValue < minLogP) {
        return false;
      }
      if (minLogP !== null && row.logPValue === null) {
        return false;
      }
      if (excludeLowQuality && row.isLowQuality) {
        return false;
      }
      if (excludeMissingGenotype) {
        if (!row.strongest_snp_risk_allele || 
            row.strongest_snp_risk_allele.trim().length === 0 ||
            row.strongest_snp_risk_allele.trim() === '?' ||
            row.strongest_snp_risk_allele.trim() === 'NR' ||
            row.strongest_snp_risk_allele.includes('?')) {
          return false;
        }
      }
      if (confidenceBandFilter && row.confidenceBand !== confidenceBandFilter) {
        return false;
      }
      return true;
    });

    const countResult = await executeQuerySingle<{ count: number }>(`SELECT COUNT(*) as count FROM gwas_catalog ${whereClause}`, params);
    const sourceCount = countResult?.count ?? 0;

  const sortedStudies = [...studies];
  const directionFactor = direction === "asc" ? 1 : -1;

  switch (sort) {
    case "power":
      sortedStudies.sort((a, b) => directionFactor * ((a.sampleSize ?? 0) - (b.sampleSize ?? 0)));
      break;
    case "recent":
      sortedStudies.sort((a, b) => {
        const aDate = a.publicationDate;
        const bDate = b.publicationDate;
        if (aDate === null && bDate === null) {
          return 0;
        }
        if (aDate === null) {
          return 1;
        }
        if (bDate === null) {
          return -1;
        }
        return directionFactor * (aDate - bDate);
      });
      break;
    case "alphabetical":
      sortedStudies.sort(
        (a, b) => (a.study ?? "").localeCompare(b.study ?? "") * directionFactor,
      );
      break;
    default:
      sortedStudies.sort((a, b) => directionFactor * ((a.logPValue ?? -Infinity) - (b.logPValue ?? -Infinity)));
      break;
  }

  const finalResults = sortedStudies.slice(0, limit);

  // For Run All queries, return minimal payload to avoid JSON serialization limits
  if (isRunAllQuery) {
    const minimalResults = finalResults.map(s => ({
      id: s.id,
      study_accession: s.study_accession,
      disease_trait: s.disease_trait,
      study: s.study,
      snps: s.snps,
      strongest_snp_risk_allele: s.strongest_snp_risk_allele,
      or_or_beta: s.or_or_beta,
    }));

    return NextResponse.json({
      data: minimalResults,
      total: studies.length,
      limit,
      truncated: studies.length > finalResults.length,
      sourceCount,
    });
  }

    return NextResponse.json({
      data: finalResults,
      total: studies.length,
      limit,
      truncated: studies.length > finalResults.length,
      sourceCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query database";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
