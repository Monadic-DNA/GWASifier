"use client";

import { useState } from "react";
import { useGenotype } from "./UserDataUpload";
import { hasMatchingSNPs } from "@/lib/snp-utils";

type UserStudyResult = {
  hasMatch: boolean;
  userGenotype?: string;
  riskAllele?: string;
  effectSize?: string;
  riskScore?: number;
  riskLevel?: 'increased' | 'decreased' | 'neutral';
  matchedSnp?: string;
};

type StudyResultRevealProps = {
  studyId: number;
  snps: string | null;
};

export default function StudyResultReveal({ studyId, snps }: StudyResultRevealProps) {
  const { genotypeData, isUploaded } = useGenotype();
  const [result, setResult] = useState<UserStudyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isUploaded || !hasMatchingSNPs(genotypeData, snps)) {
    return null;
  }

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

  if (isRevealed && result) {
    if (!result.hasMatch) {
      return (
        <div className="user-result no-match">
          No genetic data match
        </div>
      );
    }

    return (
      <div className={`user-result has-match risk-${result.riskLevel}`}>
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

  return (
    <button 
      className="reveal-button" 
      onClick={analyzeStudy}
      disabled={isLoading}
    >
      {isLoading ? '...' : 'Your result'}
    </button>
  );
}
