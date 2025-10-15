"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SavedResult, SavedSession, ResultsManager } from "@/lib/results-manager";

type ResultsContextType = {
  savedResults: SavedResult[];
  addResult: (result: SavedResult) => void;
  addResultsBatch: (results: SavedResult[]) => void;
  removeResult: (studyId: number) => void;
  clearResults: () => void;
  saveToFile: (genotypeSize?: number, genotypeHash?: string) => void;
  loadFromFile: (currentFileHash?: string | null) => Promise<void>;
  hasResult: (studyId: number) => boolean;
  getResult: (studyId: number) => SavedResult | undefined;
  setOnResultsLoadedCallback: (callback: () => void) => void;
};

const ResultsContext = createContext<ResultsContextType | null>(null);

export function ResultsProvider({ children }: { children: ReactNode }) {
  // SECURITY: Results stored in memory only, cleared on session end
  const [savedResults, setSavedResults] = useState<SavedResult[]>([]);
  const [onResultsLoaded, setOnResultsLoaded] = useState<(() => void) | undefined>();

  // No localStorage loading - data is memory-only

  const addResult = (result: SavedResult) => {
    setSavedResults(prev => {
      const filtered = prev.filter(r => r.studyId !== result.studyId);
      return [...filtered, result];
    });
  };

  const addResultsBatch = (results: SavedResult[]) => {
    setSavedResults(prev => {
      // Create a map of existing results by studyId for O(1) lookup
      const existingMap = new Map(prev.map(r => [r.studyId, r]));

      // Add/update with new results
      for (const result of results) {
        existingMap.set(result.studyId, result);
      }

      return Array.from(existingMap.values());
    });
  };

  const removeResult = (studyId: number) => {
    setSavedResults(prev => prev.filter(r => r.studyId !== studyId));
  };

  const clearResults = () => {
    setSavedResults([]);
  };

  const saveToFile = (genotypeSize?: number, genotypeHash?: string) => {
    const session: SavedSession = {
      fileName: `monadic_dna_explorer_results_${new Date().toISOString().split('T')[0]}`,
      createdDate: new Date().toISOString(),
      totalVariants: genotypeSize || 0,
      genotypeFileHash: genotypeHash,
      results: savedResults
    };

    ResultsManager.saveResultsToFile(session);
  };

  const loadFromFile = async (currentFileHash?: string | null) => {
    try {
      const session = await ResultsManager.loadResultsFromFile();

      // Validate that results file matches current DNA file
      if (currentFileHash && session.genotypeFileHash && session.genotypeFileHash !== currentFileHash) {
        const proceed = window.confirm(
          '⚠️ Warning: This results file appears to be from a different DNA file.\n\n' +
          'Loading these results may show incorrect genetic information.\n\n' +
          'Do you want to continue anyway?'
        );

        if (!proceed) {
          throw new Error('Results file does not match current DNA file');
        }
      }

      setSavedResults(session.results);
      // SECURITY: No longer saving to localStorage

      // Call the callback if it exists
      if (onResultsLoaded) {
        onResultsLoaded();
      }
    } catch (error) {
      console.error('Failed to load results:', error);
      throw error;
    }
  };

  const hasResult = (studyId: number) => {
    return savedResults.some(r => r.studyId === studyId);
  };

  const getResult = (studyId: number) => {
    return savedResults.find(r => r.studyId === studyId);
  };

  return (
    <ResultsContext.Provider value={{
      savedResults,
      addResult,
      addResultsBatch,
      removeResult,
      clearResults,
      saveToFile,
      loadFromFile,
      hasResult,
      getResult,
      setOnResultsLoadedCallback: (callback: () => void) => setOnResultsLoaded(() => callback)
    }}>
      {children}
    </ResultsContext.Provider>
  );
}

export function useResults() {
  const context = useContext(ResultsContext);
  if (!context) {
    throw new Error('useResults must be used within ResultsProvider');
  }
  return context;
}
