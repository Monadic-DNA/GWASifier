import { NextRequest, NextResponse } from "next/server";
import { executeQuerySingle, getDbType } from "@/lib/db";

type UserStudyResult = {
  hasMatch: boolean;
  userGenotype?: string;
  riskAllele?: string;
  effectSize?: string;
  riskScore?: number;
  riskLevel?: 'increased' | 'decreased' | 'neutral';
  matchedSnp?: string;
  gwasId?: string;
};

function calculateRiskScore(userGenotype: string, riskAllele: string, effectSize: string): {
  score: number;
  level: 'increased' | 'decreased' | 'neutral';
} {
  // Parse effect size (OR or beta)
  const effect = parseFloat(effectSize);
  if (isNaN(effect)) {
    return { score: 1, level: 'neutral' };
  }

  // Extract the risk allele (e.g., "rs123-A" -> "A")
  const riskAlleleBase = riskAllele.split('-').pop() || '';
  const userAlleles = userGenotype.split('');
  
  // Count how many risk alleles the user has (0, 1, or 2)
  const riskAlleleCount = userAlleles.filter(allele => allele === riskAlleleBase).length;
  
  let riskScore: number;
  let riskLevel: 'increased' | 'decreased' | 'neutral';

  if (effectSize.includes('OR') || effect > 1) {
    // Odds ratio - higher values mean increased risk
    riskScore = Math.pow(effect, riskAlleleCount);
    riskLevel = riskAlleleCount > 0 ? 'increased' : 'neutral';
  } else {
    // Beta coefficient - could be positive or negative
    riskScore = 1 + (effect * riskAlleleCount);
    if (riskAlleleCount === 0) {
      riskLevel = 'neutral';
    } else if (effect > 0) {
      riskLevel = 'increased';
    } else {
      riskLevel = 'decreased';
    }
  }

  return { score: Math.max(0.1, riskScore), level: riskLevel };
}

export async function POST(request: NextRequest) {
  try {
    const { studyId, genotypeData } = await request.json();

    if (!studyId || !genotypeData) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing study ID or genotype data' 
      }, { status: 400 });
    }

    // Create genotype map
    const genotypeMap = new Map<string, string>(Object.entries(genotypeData));

    // Get study from database
    // Use appropriate ID lookup based on database type
    const dbType = getDbType();

    const idCondition = dbType === 'postgres'
      ? 'hashtext(COALESCE(study_accession, \'\') || COALESCE(snps, \'\') || COALESCE(strongest_snp_risk_allele, \'\')) = ?'
      : 'rowid = ?';

    const query = `
      SELECT
        snps,
        strongest_snp_risk_allele,
        or_or_beta,
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
      study_accession: string | null;
    }>(query, [studyId]);

    if (!study) {
      return NextResponse.json({ 
        success: false, 
        error: 'Study not found or missing required data' 
      }, { status: 404 });
    }

    // Extract SNP IDs from the study
    const studySnps = (study.snps || '').split(/[;,\s]+/).map(s => s.trim()).filter(Boolean);

    // Find matching SNPs
    for (const snp of studySnps) {
      if (genotypeMap.has(snp)) {
        const userGenotype = genotypeMap.get(snp)!;
        const riskAllele = study.strongest_snp_risk_allele || '';
        const effectSize = study.or_or_beta || '';

        const { score, level } = calculateRiskScore(userGenotype, riskAllele, effectSize);

        return NextResponse.json({
          success: true,
          result: {
            hasMatch: true,
            userGenotype,
            riskAllele,
            effectSize,
            riskScore: score,
            riskLevel: level,
            matchedSnp: snp,
            gwasId: study.study_accession || undefined,
          } as UserStudyResult
        });
      }
    }

    // No matches found
    console.log('No SNP matches found. Study SNPs:', studySnps, 'User has:', genotypeMap.size, 'variants');

    return NextResponse.json({
      success: true,
      result: {
        hasMatch: false,
      } as UserStudyResult
    });

  } catch (error) {
    console.error('Study analysis error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error during analysis' 
    }, { status: 500 });
  }
}
