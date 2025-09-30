import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import {
  computeQualityFlags,
  formatNumber,
  formatPValue,
  parseLogPValue,
  parsePValue,
  parseSampleSize,
} from "@/lib/parsing";

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
  qualityFlags: string[];
  isLowQuality: boolean;
};

function parseInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function GET(request: NextRequest) {
  let db;
  try {
    db = getDb();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open database";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search")?.trim();
  const trait = searchParams.get("trait")?.trim();
  const limit = Math.max(10, Math.min(Number(searchParams.get("limit")) || 75, 200));
  const sort = searchParams.get("sort") ?? "relevance";
  const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";
  const minSampleSize = parseInteger(searchParams.get("minSampleSize"));
  const maxPValueRaw = searchParams.get("maxPValue");
  const minLogPRaw = searchParams.get("minLogP");
  const excludeLowQuality = searchParams.get("excludeLowQuality") === "false" ? false : true;

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

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const baseQuery = `SELECT rowid AS id,
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
    LIMIT ?`;

  const rawLimit = Math.min(limit * 4, 800);

  const statement = db.prepare(baseQuery);
  const rawRows = statement.all(...params, rawLimit) as RawStudy[];

  const maxPValue = maxPValueRaw ? parsePValue(maxPValueRaw) : null;
  const minLogP = minLogPRaw ? Number(minLogPRaw) : null;

  const studies: Study[] = rawRows
    .map((row) => {
      const sampleSize = parseSampleSize(row.initial_sample_size) ?? parseSampleSize(row.replication_sample_size);
      const pValueNumeric = parsePValue(row.p_value);
      const logPValue = parseLogPValue(row.pvalue_mlog) ?? (pValueNumeric ? -Math.log10(pValueNumeric) : null);
      const qualityFlags = computeQualityFlags(sampleSize, pValueNumeric, logPValue);
      return {
        ...row,
        sampleSize,
        sampleSizeLabel: formatNumber(sampleSize),
        pValueNumeric,
        pValueLabel: formatPValue(pValueNumeric),
        logPValue,
        qualityFlags,
        isLowQuality: qualityFlags.length > 0,
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
      return true;
    });

  const countStatement = db.prepare(`SELECT COUNT(*) as count FROM gwas_catalog ${whereClause}`);
  const { count: sourceCount } = countStatement.get(...params) as { count: number };

  const sortedStudies = [...studies];
  const directionFactor = direction === "asc" ? 1 : -1;

  switch (sort) {
    case "power":
      sortedStudies.sort((a, b) => directionFactor * ((a.sampleSize ?? 0) - (b.sampleSize ?? 0)));
      break;
    case "recent":
      sortedStudies.sort((a, b) => {
        const aDate = a.date ? Date.parse(a.date) : 0;
        const bDate = b.date ? Date.parse(b.date) : 0;
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

  return NextResponse.json({
    data: finalResults,
    total: studies.length,
    limit,
    truncated: studies.length > finalResults.length,
    sourceCount,
  });
}
