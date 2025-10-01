"use client";

import { useState } from "react";
import UserDataUpload, { useGenotype } from "./UserDataUpload";
import { useResults } from "./ResultsContext";

export default function MenuBar() {
  const { isUploaded, genotypeData } = useGenotype();
  const { savedResults, saveToFile, loadFromFile, clearResults } = useResults();
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const handleLoadFromFile = async () => {
    setIsLoadingFile(true);
    try {
      await loadFromFile();
    } catch (error) {
      alert('Failed to load results file: ' + (error as Error).message);
    } finally {
      setIsLoadingFile(false);
    }
  };

  return (
    <div className="menu-bar">
      <div className="menu-left">
        <h1 className="app-title">
          GWASifier by{" "}
          <a 
            href="https://monadicdna.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="monadic-link"
          >
            Monadic DNA
          </a>
        </h1>
        <span className="app-subtitle">GWAS Catalog Explorer</span>
      </div>
      
      <div className="menu-right">
        <div className="status-section">
          {isUploaded && genotypeData && (
            <div className="genotype-stats">
              <span className="stat-item">
                {genotypeData.size.toLocaleString()} variants loaded
              </span>
              {savedResults.length > 0 && (
                <span className="stat-item">
                  {savedResults.length} results saved
                </span>
              )}
            </div>
          )}
          <UserDataUpload />
        </div>
        
        {savedResults.length > 0 && (
          <div className="results-controls">
            <button 
              className="control-button save" 
              onClick={saveToFile}
              title="Save your results to a file"
            >
              💾 Save
            </button>
            <button 
              className="control-button clear" 
              onClick={clearResults}
              title="Clear all saved results"
            >
              🗑️ Clear
            </button>
          </div>
        )}
        
        <div className="file-controls">
          <button 
            className="control-button load" 
            onClick={handleLoadFromFile}
            disabled={isLoadingFile}
            title="Load results from a file"
          >
            {isLoadingFile ? '⏳ Loading...' : '📁 Load Results'}
          </button>
        </div>
      </div>
    </div>
  );
}
