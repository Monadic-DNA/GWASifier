export type SavedResult = {
  studyId: number;
  gwasId?: string; // GWAS study accession ID
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
  genotypeFileHash?: string; // Hash of the original genotype file
  results: SavedResult[];
};

export class ResultsManager {
  // SECURITY: localStorage removed to prevent cleartext genetic data persistence
  // All results are now stored in memory only and cleared on session end

  static saveResultsToFile(session: SavedSession): void {
    // Convert to TSV format (tab-separated to handle commas in data)
    const headers = [
      'Study ID',
      'GWAS ID',
      'Trait Name',
      'Study Title',
      'Your Genotype',
      'Risk Allele',
      'Effect Size',
      'Risk Score',
      'Risk Level',
      'Matched SNP',
      'Analysis Date'
    ];

    const tsvRows = [headers.join('\t')];

    for (const result of session.results) {
      const row = [
        result.studyId,
        result.gwasId || '',
        (result.traitName || '').replace(/\t/g, ' '), // Replace tabs with spaces
        (result.studyTitle || '').replace(/\t/g, ' '),
        result.userGenotype || '',
        result.riskAllele || '',
        result.effectSize || '',
        result.riskScore,
        result.riskLevel || '',
        result.matchedSnp || '',
        result.analysisDate || ''
      ];
      tsvRows.push(row.join('\t'));
    }

    const tsvContent = tsvRows.join('\n');
    const dataBlob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `monadic_dna_explorer_results_${new Date().toISOString().split('T')[0]}.tsv`;
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
}
