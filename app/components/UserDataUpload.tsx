"use client";

import { useState, useRef, createContext, useContext } from "react";
import { GenotypeData, detectAndParseGenotypeFile, validateFileSize, validateFileFormat } from "@/lib/genotype-parser";
import { calculateFileHash } from "@/lib/file-hash";

type GenotypeContextType = {
  genotypeData: Map<string, string> | null;
  uploadGenotype: (file: File) => Promise<void>;
  clearGenotype: () => void;
  isUploaded: boolean;
  isLoading: boolean;
  error: string | null;
  setOnDataLoadedCallback: (callback: (() => void) | null) => void;
  fileHash: string | null;
  originalFileName: string | null;
};

const GenotypeContext = createContext<GenotypeContextType | null>(null);

export function GenotypeProvider({ children }: { children: React.ReactNode }) {
  const [genotypeData, setGenotypeData] = useState<Map<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onDataLoaded, setOnDataLoaded] = useState<(() => void) | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);

  const uploadGenotype = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate file size (50MB limit)
      if (!validateFileSize(file, 50)) {
        throw new Error('File too large. Maximum size is 50MB.');
      }

      // Validate file format
      if (!validateFileFormat(file)) {
        throw new Error('Invalid file format. Please upload a .txt, .tsv, or .csv file from 23andMe or Monadic DNA.');
      }

      // Read and parse file entirely client-side
      const fileContent = await file.text();
      const hash = calculateFileHash(fileContent);

      // Parse the genotype file client-side
      const parseResult = detectAndParseGenotypeFile(fileContent);

      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Failed to parse genotype data');
      }

      // Create a map for quick SNP lookup
      const genotypeMap = new Map<string, string>();
      parseResult.data!.forEach((variant: GenotypeData) => {
        genotypeMap.set(variant.rsid, variant.genotype);
      });

      setGenotypeData(genotypeMap);
      setFileHash(hash);
      setOriginalFileName(file.name);

      // Call the callback if it exists
      if (onDataLoaded) {
        onDataLoaded();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  const clearGenotype = () => {
    setGenotypeData(null);
    setError(null);
    setFileHash(null);
    setOriginalFileName(null);
  };

  return (
    <GenotypeContext.Provider value={{
      genotypeData,
      uploadGenotype,
      clearGenotype,
      isUploaded: !!genotypeData,
      isLoading,
      error,
      setOnDataLoadedCallback: setOnDataLoaded,
      fileHash,
      originalFileName,
    }}>
      {children}
    </GenotypeContext.Provider>
  );
}

export function useGenotype() {
  const context = useContext(GenotypeContext);
  if (!context) {
    throw new Error('useGenotype must be used within GenotypeProvider');
  }
  return context;
}

export default function UserDataUpload() {
  const { uploadGenotype, clearGenotype, isUploaded, isLoading, error } = useGenotype();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.txt') && !fileName.endsWith('.tsv') && !fileName.endsWith('.csv')) {
      return;
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      return;
    }

    // Automatically upload the file
    await uploadGenotype(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (isUploaded) {
    return (
      <div className="genotype-status">
        <span className="genotype-indicator">
          ✓ Personal data loaded
        </span>
        <button 
          className="genotype-clear" 
          onClick={clearGenotype}
          title="Clear your personal data"
        >
          Clear
        </button>
      </div>
    );
  }

  return (
    <div className="genotype-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.tsv,.csv"
        onChange={handleFileSelect}
        className="genotype-file-input"
        id="genotype-upload"
        disabled={isLoading}
      />
      <label htmlFor="genotype-upload" className={`genotype-upload-label ${isLoading ? 'loading' : ''}`}>
        {isLoading ? 'Loading...' : 'Load genetic data'}
      </label>
      {error && (
        <div className="genotype-error" title={error}>
          Upload failed
        </div>
      )}
    </div>
  );
}
