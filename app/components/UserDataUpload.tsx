"use client";

import { useState, useRef, createContext, useContext } from "react";
import { GenotypeData } from "@/lib/genotype-parser";
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
      // Read file content to calculate hash
      const fileContent = await file.text();
      const hash = calculateFileHash(fileContent);

      const formData = new FormData();
      formData.append('genotype', file);

      const response = await fetch('/api/parse-genotype', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse genotype data');
      }

      // Create a map for quick SNP lookup
      const genotypeMap = new Map<string, string>();
      data.data.forEach((variant: GenotypeData) => {
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.txt') && !file.name.toLowerCase().endsWith('.tsv')) {
      return;
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    await uploadGenotype(selectedFile);
    setSelectedFile(null);
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
      {!selectedFile ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.tsv"
            onChange={handleFileSelect}
            className="genotype-file-input"
            id="genotype-upload"
          />
          <label htmlFor="genotype-upload" className="genotype-upload-label">
            Load 23andMe data
          </label>
        </>
      ) : (
        <div className="genotype-file-selected">
          <span>{selectedFile.name}</span>
          <button 
            className="genotype-upload-button" 
            onClick={handleUpload}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load'}
          </button>
        </div>
      )}
      {error && (
        <div className="genotype-error" title={error}>
          Upload failed
        </div>
      )}
    </div>
  );
}
