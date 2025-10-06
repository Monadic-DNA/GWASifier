"use client";

import { useState, useEffect } from "react";
import UserDataUpload, { useGenotype } from "./UserDataUpload";
import { useResults } from "./ResultsContext";

export default function MenuBar() {
  const { isUploaded, genotypeData, fileHash } = useGenotype();
  const { savedResults, saveToFile, loadFromFile, clearResults } = useResults();
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    // Detect system preference on mount
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = isDark ? "dark" : "light";
    setTheme(initialTheme);

    // Apply initial theme
    document.documentElement.setAttribute("data-theme", initialTheme);
    document.documentElement.style.colorScheme = initialTheme;
  }, []);

  useEffect(() => {
    // Apply theme changes
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

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
          <a
            href="https://monadicdna.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="monadic-link"
          >
            Monadic DNA
          </a>{" "}
          Explorer
        </h1>
        <span className="app-subtitle">Explore GWAS Catalog Studies</span>
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
          <>
            <div className="menu-separator" />
            <div className="results-controls">
            <button
              className="control-button save"
              onClick={() => saveToFile(genotypeData?.size, fileHash || undefined)}
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
          </>
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

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </div>
  );
}
