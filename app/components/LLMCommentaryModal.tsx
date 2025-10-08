"use client";

import { useEffect, useState } from "react";
import { SavedResult } from "@/lib/results-manager";
import { NilaiOpenAIClient, AuthType } from "@nillion/nilai-ts";

type LLMCommentaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentResult: SavedResult;
  allResults: SavedResult[];
};

export default function LLMCommentaryModal({
  isOpen,
  onClose,
  currentResult,
  allResults,
}: LLMCommentaryModalProps) {
  const [commentary, setCommentary] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delegationStatus, setDelegationStatus] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      fetchCommentary();
    }
  }, [isOpen]);

  const fetchCommentary = async () => {
    setIsLoading(true);
    setError(null);
    setCommentary("");
    setDelegationStatus("");

    try {
      // Initialize NilAI client with delegation token authentication
      const client = new NilaiOpenAIClient({
        baseURL: "https://nilai-a779.nillion.network/v1/",
        authType: AuthType.DELEGATION_TOKEN,
      });

      // Get delegation request from client
      const delegationRequest = client.getDelegationRequest();

      setDelegationStatus("Requesting secure token...");

      // Request delegation token from server
      const tokenResponse = await fetch("/api/nilai-delegation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ delegationRequest }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || "Failed to get delegation token");
      }

      const { delegationToken } = await tokenResponse.json();

      // Update client with delegation token
      client.updateDelegation(delegationToken);

      setDelegationStatus("✓ Secure token ready — connecting directly to private AI");

      // Construct the prompt with all results context
      const contextResults = allResults
        .map((r: SavedResult, idx: number) =>
          `${idx + 1}. ${r.traitName} (${r.studyTitle}):
   - Your genotype: ${r.userGenotype}
   - Risk allele: ${r.riskAllele}
   - Effect size: ${r.effectSize}
   - Risk score: ${r.riskScore}x (${r.riskLevel})
   - Matched SNP: ${r.matchedSnp}`
        )
        .join('\n\n');

      const prompt = `You are a genetic counselor providing educational commentary on GWAS (Genome-Wide Association Study) results.

IMPORTANT DISCLAIMERS TO INCLUDE:
1. This is for educational and entertainment purposes only
2. This is NOT medical advice and should not be used for medical decisions
3. GWAS results show statistical associations, not deterministic outcomes
4. Genetic risk is just one factor among many (lifestyle, environment, other genes)
5. Always consult healthcare professionals for medical interpretation
6. These results come from research studies and may not be clinically validated

CURRENT RESULT TO ANALYZE:
Trait: ${currentResult.traitName}
Study: ${currentResult.studyTitle}
Your genotype: ${currentResult.userGenotype}
Risk allele: ${currentResult.riskAllele}
Effect size: ${currentResult.effectSize}
Risk score: ${currentResult.riskScore}x (${currentResult.riskLevel})
Matched SNP: ${currentResult.matchedSnp}
Study date: ${currentResult.analysisDate}

ALL YOUR SAVED RESULTS FOR CONTEXT:
${contextResults}

Please provide:
1. A brief, plain-language summary of what this research study found (what scientists were investigating and what they discovered)
2. A clear explanation of what this result means for the user specifically
3. Context about the trait/condition in terms anyone can understand
4. Interpretation of the risk level in practical terms
5. How this relates to any other results they have (if applicable)
6. Appropriate disclaimers and next steps

Keep your response concise (400-600 words), educational, and reassuring where appropriate. Use clear, accessible language suitable for someone with no scientific background. Avoid jargon, and when technical terms are necessary, explain them simply.`;

      // Make request directly to NilAI (data never touches our server!)
      const response = await client.chat.completions.create({
        model: "google/gemma-3-27b-it",
        messages: [
          {
            role: "system",
            content: "You are a knowledgeable genetic counselor who explains GWAS results clearly and responsibly, always emphasizing appropriate disclaimers and limitations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.7,
      });

      const commentaryText = response.choices?.[0]?.message?.content;

      if (!commentaryText) {
        throw new Error("No commentary generated from LLM");
      }

      setCommentary(commentaryText);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate commentary";
      setError(errorMessage);

      // Check if it's a configuration error
      if (errorMessage.includes("API key not configured")) {
        setError("LLM commentary is not configured. The NILLION_API_KEY environment variable needs to be set.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    fetchCommentary();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog commentary-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <h2>🤖 AI Commentary on Your Result</h2>

          <div className="commentary-powered-by-header">
            <p className="powered-by">
              🔒 Powered by <a href="https://nillion.com" target="_blank" rel="noopener noreferrer">Nillion nilAI</a> -
              Privacy-preserving AI in a Trusted Execution Environment
            </p>
          </div>

          <div className="commentary-result-summary">
            <h3>{currentResult.traitName}</h3>
            <p className="commentary-study-title">{currentResult.studyTitle}</p>
            <div className="commentary-result-details">
              <span>
                <strong>Your genotype:</strong> {currentResult.userGenotype}
              </span>
              <span>
                <strong>Risk score:</strong> {currentResult.riskScore}x ({currentResult.riskLevel})
              </span>
            </div>
          </div>

          <div className="commentary-text">
            {isLoading && (
              <div className="commentary-loading">
                <div className="loading-spinner"></div>
                <p>Generating personalized commentary with private AI...</p>
                {delegationStatus && (
                  <p className="loading-subtext delegation-status">
                    {delegationStatus}
                  </p>
                )}
                {!delegationStatus && (
                  <p className="loading-subtext">
                    Your data is processed securely in a Trusted Execution Environment
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="commentary-error">
                <p className="error-message">❌ {error}</p>
                <button className="retry-button" onClick={handleRetry}>
                  Try Again
                </button>
              </div>
            )}

            {!isLoading && !error && commentary && (
              <div className="commentary-content">
                <div className="commentary-body">
                  {commentary.split('\n\n').map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="disclaimer-button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
