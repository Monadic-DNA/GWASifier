"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SavedResult, SavedSession, ResultsManager } from "@/lib/results-manager";

type ResultsContextType = {
  savedResults: SavedResult[];
  addResult: (result: SavedResult) => void;
  removeResult: (studyId: number) => void;
  clearResults: () => void;
  saveToFile: (genotypeSize?: number, genotypeHash?: string) => void;
  loadFromFile: () => Promise<void>;
  hasResult: (studyId: number) => boolean;
  getResult: (studyId: number) => SavedResult | undefined;
  setOnResultsLoadedCallback: (callback: () => void) => void;
};

const ResultsContext = createContext<ResultsContextType | null>(null);

export function ResultsProvider({ children }: { children: ReactNode }) {
  const [savedResults, setSavedResults] = useState<SavedResult[]>([]);
  const [onResultsLoaded, setOnResultsLoaded] = useState<(() => void) | undefined>();

  // Load results from localStorage on mount
  useEffect(() => {
    const stored = ResultsManager.loadFromLocalStorage();
    if (stored && stored.length > 0) {
      setSavedResults(stored);
    }
  }, []);

  const addResult = (result: SavedResult) => {
    setSavedResults(prev => {
      const filtered = prev.filter(r => r.studyId !== result.studyId);
      const updated = [...filtered, result];
      ResultsManager.saveToLocalStorage(updated);
      return updated;
    });
  };

  const removeResult = (studyId: number) => {
    setSavedResults(prev => {
      const filtered = prev.filter(r => r.studyId !== studyId);
      ResultsManager.saveToLocalStorage(filtered);
      return filtered;
    });
  };

  const clearResults = () => {
    setSavedResults([]);
    ResultsManager.clearLocalStorage();
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

  const loadFromFile = async () => {
    try {
      const session = await ResultsManager.loadResultsFromFile();
      setSavedResults(session.results);
      ResultsManager.saveToLocalStorage(session.results);

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
