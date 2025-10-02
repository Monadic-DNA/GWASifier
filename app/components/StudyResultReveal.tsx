"use client";

import { useState, useEffect } from "react";
import { useGenotype } from "./UserDataUpload";
import { useResults } from "./ResultsContext";
import { hasMatchingSNPs } from "@/lib/snp-utils";
import DisclaimerModal from "./DisclaimerModal";
import { SavedResult } from "@/lib/results-manager";

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

type StudyResultRevealProps = {
  studyId: number;
  snps: string | null;
  traitName: string;
  studyTitle: string;
};

export default function StudyResultReveal({ studyId, snps, traitName, studyTitle }: StudyResultRevealProps) {
  const { genotypeData, isUploaded } = useGenotype();
  const { addResult, hasResult, getResult } = useResults();
  const [result, setResult] = useState<UserStudyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // Check if we already have a saved result
  useEffect(() => {
    if (hasResult(studyId)) {
      const savedResult = getResult(studyId);
      if (savedResult) {
        setResult({
          hasMatch: true,
          userGenotype: savedResult.userGenotype,
          riskAllele: savedResult.riskAllele,
          effectSize: savedResult.effectSize,
          riskScore: savedResult.riskScore,
          riskLevel: savedResult.riskLevel,
          matchedSnp: savedResult.matchedSnp,
        });
        setIsRevealed(true);
      }
    }
  }, [studyId, hasResult, getResult]);

  const handleRevealClick = () => {
    setShowDisclaimer(true);
  };

  const handleDisclaimerClose = () => {
    setShowDisclaimer(false);
  };

  const handleDisclaimerAccept = () => {
    setShowDisclaimer(false);
    analyzeStudy();
  };

  const analyzeStudy = async () => {
    if (!genotypeData) return;

    setIsLoading(true);
    setError(null);

    try {
      // Convert Map to plain object for JSON serialization
      const genotypeObj = Object.fromEntries(genotypeData);

      const response = await fetch('/api/analyze-study', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studyId,
          genotypeData: genotypeObj,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze study');
      }

      setResult(data.result);
      setIsRevealed(true);

      // Save the result if it has a match
      if (data.result.hasMatch) {
        const savedResult: SavedResult = {
          studyId,
          gwasId: data.result.gwasId,
          traitName,
          studyTitle,
          userGenotype: data.result.userGenotype!,
          riskAllele: data.result.riskAllele!,
          effectSize: data.result.effectSize!,
          riskScore: data.result.riskScore!,
          riskLevel: data.result.riskLevel!,
          matchedSnp: data.result.matchedSnp!,
          analysisDate: new Date().toISOString(),
        };
        addResult(savedResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const formatRiskScore = (score: number, level: string) => {
    if (level === 'neutral') return '1.0x';
    return `${score.toFixed(2)}x`;
  };

  const generateTooltip = (result: UserStudyResult) => {
    if (!result.hasMatch) return "No genetic data available for this study's variants.";
    
    const riskMultiplier = result.riskScore!;
    const riskDirection = result.riskLevel!;
    const userGenotype = result.userGenotype!;
    const riskAllele = result.riskAllele!.split('-').pop() || '';
    const userAlleles = userGenotype.split('');
    const riskAlleleCount = userAlleles.filter(allele => allele === riskAllele).length;
    
    let baseExplanation = `Your genotype is ${userGenotype}. `;
    
    if (riskAlleleCount === 0) {
      baseExplanation += `You don't carry the risk variant (${riskAllele}), which means this genetic factor doesn't increase your risk for this trait. `;
    } else if (riskAlleleCount === 1) {
      baseExplanation += `You carry one copy of the risk variant (${riskAllele}), meaning you inherited it from one parent. `;
    } else {
      baseExplanation += `You carry two copies of the risk variant (${riskAllele}), meaning you inherited it from both parents. `;
    }

    if (riskDirection === 'neutral') {
      baseExplanation += "This genetic variant appears to have no significant effect on your risk.";
    } else if (riskDirection === 'increased') {
      if (riskMultiplier < 1.5) {
        baseExplanation += `This slightly increases your risk by ${((riskMultiplier - 1) * 100).toFixed(0)}%. This is a small effect that may be offset by lifestyle and other genetic factors.`;
      } else if (riskMultiplier < 2.0) {
        baseExplanation += `This moderately increases your risk by ${((riskMultiplier - 1) * 100).toFixed(0)}%. Combined with other factors, this could be meaningful for prevention strategies.`;
      } else {
        baseExplanation += `This substantially increases your risk by ${((riskMultiplier - 1) * 100).toFixed(0)}%. Consider discussing this with a healthcare provider, especially if you have other risk factors.`;
      }
    } else if (riskDirection === 'decreased') {
      baseExplanation += `This genetic variant appears to be protective, potentially reducing your risk by ${((1 - riskMultiplier) * 100).toFixed(0)}%. This is a favorable genetic factor for this trait.`;
    }

    baseExplanation += ` Remember that genetics is just one piece of the puzzle - lifestyle, environment, and other genetic variants all play important roles.`;
    
    return baseExplanation;
  };

  if (isRevealed && result) {
    if (!result.hasMatch) {
      return (
        <div className="user-result no-match">
          No genetic data match
        </div>
      );
    }

    return (
      <div 
        className={`user-result has-match risk-${result.riskLevel}`}
        title={generateTooltip(result)}
      >
        <div className="user-genotype">
          Your genotype: <span className="genotype-value">{result.userGenotype}</span>
        </div>
        <div className={`risk-score risk-${result.riskLevel}`}>
          {formatRiskScore(result.riskScore!, result.riskLevel!)}
          <span className="risk-label">
            {result.riskLevel === 'increased' ? '↑' : result.riskLevel === 'decreased' ? '↓' : '→'}
          </span>
        </div>
      </div>
    );
  }

  // Only show the reveal button if we have user data and matching SNPs
  if (!isUploaded || !hasMatchingSNPs(genotypeData, snps)) {
    return null;
  }

  return (
    <>
      <DisclaimerModal
        isOpen={showDisclaimer}
        onClose={handleDisclaimerClose}
        type="result"
        onAccept={handleDisclaimerAccept}
      />
      <button
        className="reveal-button"
        onClick={handleRevealClick}
        disabled={isLoading}
      >
        {isLoading ? '...' : 'Your result'}
      </button>
    </>
  );
}
