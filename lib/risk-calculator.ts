export type UserStudyResult = {
  hasMatch: boolean;
  userGenotype?: string;
  riskAllele?: string;
  effectSize?: string;
  riskScore?: number;
  riskLevel?: 'increased' | 'decreased' | 'neutral';
  matchedSnp?: string;
  gwasId?: string;
};

export function calculateRiskScore(userGenotype: string, riskAllele: string, effectSize: string): {
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

  if (effectSize.includes('OR')) {
    // Odds ratio: OR > 1 increases risk, OR < 1 decreases risk
    riskScore = Math.pow(effect, riskAlleleCount);
    if (riskAlleleCount === 0) {
      riskLevel = 'neutral';
    } else if (effect > 1) {
      riskLevel = 'increased';
    } else if (effect < 1) {
      riskLevel = 'decreased';
    } else {
      riskLevel = 'neutral';
    }
  } else {
    // Beta coefficient - represents units of trait change, not relative risk
    // Return the raw beta-based score for display purposes only
    // This should NOT be interpreted as a risk multiplier
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

export function analyzeStudyClientSide(
  genotypeMap: Map<string, string>,
  studySnps: string,
  riskAllele: string | null,
  effectSize: string | null,
  gwasId: string | null
): UserStudyResult {
  if (!riskAllele || !effectSize || !studySnps) {
    return { hasMatch: false };
  }

  // Extract SNP IDs from the study
  const snpList = studySnps.split(/[;,\s]+/).map(s => s.trim()).filter(Boolean);

  // Find matching SNPs
  for (const snp of snpList) {
    if (genotypeMap.has(snp)) {
      const userGenotype = genotypeMap.get(snp)!;
      const { score, level } = calculateRiskScore(userGenotype, riskAllele, effectSize);

      return {
        hasMatch: true,
        userGenotype,
        riskAllele,
        effectSize,
        riskScore: score,
        riskLevel: level,
        matchedSnp: snp,
        gwasId: gwasId || undefined,
      };
    }
  }

  // No matches found
  return { hasMatch: false };
}
