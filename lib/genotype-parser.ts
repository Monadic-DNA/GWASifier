export type GenotypeData = {
  rsid: string;
  chromosome: string;
  position: number;
  genotype: string;
};

export type ParseResult = {
  success: boolean;
  data?: GenotypeData[];
  error?: string;
  totalVariants?: number;
  validVariants?: number;
};

export function parse23andMeFile(content: string): ParseResult {
  try {
    const lines = content.split('\n');
    const genotypeData: GenotypeData[] = [];
    let totalVariants = 0;
    let validVariants = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      totalVariants++;
      const parts = trimmedLine.split(/\s+/);

      // Expected format: rsid chromosome position genotype
      if (parts.length !== 4) {
        continue;
      }

      const [rsid, chromosome, positionStr, genotype] = parts;

      // Validate rsid format (should start with rs)
      if (!rsid.startsWith('rs')) {
        continue;
      }

      // Validate chromosome (1-22, X, Y, MT)
      const validChromosomes = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
        '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', 'X', 'Y', 'MT']);
      if (!validChromosomes.has(chromosome)) {
        continue;
      }

      // Validate position (should be a positive integer)
      const position = parseInt(positionStr, 10);
      if (!Number.isInteger(position) || position <= 0) {
        continue;
      }

      // Validate genotype (should be 2 characters, A, T, G, C, I, D, or --)
      const validBases = new Set(['A', 'T', 'G', 'C', 'I', 'D', '-']);
      if (genotype.length !== 2 ||
          !validBases.has(genotype[0]) ||
          !validBases.has(genotype[1])) {
        continue;
      }

      genotypeData.push({
        rsid,
        chromosome,
        position,
        genotype,
      });

      validVariants++;
    }

    if (validVariants === 0) {
      return {
        success: false,
        error: 'No valid genotype data found in file. Please ensure the file is in 23andMe format.',
      };
    }

    return {
      success: true,
      data: genotypeData,
      totalVariants,
      validVariants,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function validateFileSize(file: File, maxSizeMB: number = 50): boolean {
  return file.size <= maxSizeMB * 1024 * 1024;
}

export function validateFileFormat(file: File): boolean {
  const validExtensions = ['.txt', '.tsv'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some(ext => fileName.endsWith(ext));
}
