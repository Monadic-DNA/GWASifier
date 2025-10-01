export function parseVariantIds(snps: string | null): string[] {
  if (!snps) return [];
  return snps
    .split(/[;,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export function hasMatchingSNPs(genotypeData: Map<string, string> | null, snps: string | null): boolean {
  if (!genotypeData || !snps) return false;
  
  const studySnps = parseVariantIds(snps);
  return studySnps.some(snp => genotypeData.has(snp));
}

export function getMatchingSNPs(genotypeData: Map<string, string> | null, snps: string | null): string[] {
  if (!genotypeData || !snps) return [];
  
  const studySnps = parseVariantIds(snps);
  return studySnps.filter(snp => genotypeData.has(snp));
}
