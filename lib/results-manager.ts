export type SavedResult = {
  studyId: number;
  traitName: string;
  studyTitle: string;
  userGenotype: string;
  riskAllele: string;
  effectSize: string;
  riskScore: number;
  riskLevel: 'increased' | 'decreased' | 'neutral';
  matchedSnp: string;
  analysisDate: string;
};

export type SavedSession = {
  fileName: string;
  createdDate: string;
  totalVariants: number;
  results: SavedResult[];
};

export class ResultsManager {
  private static STORAGE_KEY = 'gwasifier_results';

  static saveResultsToFile(session: SavedSession): void {
    const dataStr = JSON.stringify(session, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `gwasifier_results_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(link.href);
  }

  static loadResultsFromFile(): Promise<SavedSession> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            const session = JSON.parse(content) as SavedSession;
            
            // Validate the structure
            if (!session.results || !Array.isArray(session.results)) {
              throw new Error('Invalid file format');
            }
            
            resolve(session);
          } catch (error) {
            reject(new Error('Failed to parse file: ' + (error as Error).message));
          }
        };
        
        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };
        
        reader.readAsText(file);
      };
      
      input.click();
    });
  }

  static saveToLocalStorage(results: SavedResult[]): void {
    const session: SavedSession = {
      fileName: 'local_session',
      createdDate: new Date().toISOString(),
      totalVariants: 0, // Will be updated from context
      results
    };
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
  }

  static loadFromLocalStorage(): SavedSession | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as SavedSession;
    } catch {
      return null;
    }
  }

  static clearLocalStorage(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
