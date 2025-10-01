"use client";

import { useGenotype } from "./UserDataUpload";
import { parseVariantIds, getMatchingSNPs } from "@/lib/snp-utils";

type VariantChipsProps = {
  snps: string | null;
  riskAllele: string | null;
};

export default function VariantChips({ snps, riskAllele }: VariantChipsProps) {
  const { genotypeData, isUploaded } = useGenotype();
  const variantIds = parseVariantIds(snps);
  const hasGenotype = riskAllele?.trim().length ?? 0 > 0;

  const matchingSNPs = isUploaded && genotypeData ?
    new Set(getMatchingSNPs(genotypeData, snps)) :
    new Set();

  return (
    <div className="variant-cell">
      <div className="variant-chip-group" aria-label="SNP identifier">
        {variantIds.length > 0 ? (
          variantIds.map((variantId) => (
            <a
              key={variantId}
              className={`variant-chip variant-link ${matchingSNPs.has(variantId) ? 'has-user-data' : ''}`}
              href={`https://www.ncbi.nlm.nih.gov/snp/${encodeURIComponent(variantId)}`}
              target="_blank"
              rel="noreferrer"
              title={matchingSNPs.has(variantId) ? 'You have data for this variant' : undefined}
            >
              {variantId}
              {matchingSNPs.has(variantId) && <span className="user-data-indicator">●</span>}
            </a>
          ))
        ) : (
          <span className="variant-chip variant-chip--placeholder">Not reported</span>
        )}
      </div>
      <span
        className={hasGenotype ? "variant-chip secondary" : "variant-chip variant-chip--placeholder"}
        aria-label="Risk allele or genotype"
      >
        {hasGenotype ? riskAllele : "Not reported"}
      </span>
    </div>
  );
}
