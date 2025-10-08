import { NextRequest, NextResponse } from "next/server";
import { executeQuerySingle, getDbType } from "@/lib/db";

// This endpoint only returns study metadata - NO user genetic data is processed here
export async function POST(request: NextRequest) {
  try {
    const { studyId } = await request.json();

    if (!studyId) {
      return NextResponse.json({
        success: false,
        error: 'Missing study ID'
      }, { status: 400 });
    }

    // Get study metadata from database (contains no user data)
    const dbType = getDbType();

    const idCondition = dbType === 'postgres'
      ? 'hashtext(COALESCE(study_accession, \'\') || COALESCE(snps, \'\') || COALESCE(strongest_snp_risk_allele, \'\') || COALESCE(p_value, \'\') || COALESCE(or_or_beta::text, \'\')) = ?'
      : 'rowid = ?';

    const query = `
      SELECT
        snps,
        strongest_snp_risk_allele,
        or_or_beta,
        ci_text,
        study_accession
      FROM gwas_catalog
      WHERE ${idCondition}
      AND snps IS NOT NULL AND snps != ''
      AND strongest_snp_risk_allele IS NOT NULL AND strongest_snp_risk_allele != ''
      AND or_or_beta IS NOT NULL AND or_or_beta != ''
    `;

    const study = await executeQuerySingle<{
      snps: string | null;
      strongest_snp_risk_allele: string | null;
      or_or_beta: string | null;
      ci_text: string | null;
      study_accession: string | null;
    }>(query, [studyId]);

    if (!study) {
      return NextResponse.json({
        success: false,
        error: 'Study not found or missing required data'
      }, { status: 404 });
    }

    // Determine effect type from ci_text
    // Beta coefficients have "unit" in CI (e.g., "[0.0068-0.0139] unit increase")
    // Odds ratios are just numbers (e.g., "[1.08-1.15]")
    const isBeta = study.ci_text?.toLowerCase().includes('unit') ?? false;
    const effectType = isBeta ? 'beta' : 'OR';

    // Return only study metadata - client will perform the analysis
    return NextResponse.json({
      success: true,
      study: {
        snps: study.snps,
        riskAllele: study.strongest_snp_risk_allele,
        effectSize: study.or_or_beta,
        effectType: effectType,
        confidenceInterval: study.ci_text,
        gwasId: study.study_accession,
      }
    });

  } catch (error) {
    console.error('Study analysis error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error during analysis' 
    }, { status: 500 });
  }
}
