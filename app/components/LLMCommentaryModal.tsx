"use client";

import { useEffect, useState } from "react";
import { SavedResult } from "@/lib/results-manager";

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

  useEffect(() => {
    if (isOpen) {
      fetchCommentary();
    }
  }, [isOpen]);

  const fetchCommentary = async () => {
    setIsLoading(true);
    setError(null);
    setCommentary("");

    try {
      const response = await fetch("/api/llm-commentary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentResult,
          allResults,
          studyId: currentResult.studyId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate commentary");
      }

      setCommentary(data.commentary);
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
                <p className="loading-subtext">
                  Your data is processed securely in a Trusted Execution Environment
                </p>
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
