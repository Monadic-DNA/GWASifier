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
  detectedFormat?: 'monadic' | '23andme';
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
      detectedFormat: '23andme',
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function parseMonadicDNAFile(content: string): ParseResult {
  try {
    const lines = content.split('\n');
    const genotypeData: GenotypeData[] = [];
    let totalVariants = 0;
    let validVariants = 0;
    let headerFound = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) {
        continue;
      }

      // Check for header line
      if (trimmedLine.toUpperCase().startsWith('RSID,CHROMOSOME,POSITION,RESULT')) {
        headerFound = true;
        continue;
      }

      // Skip if we haven't found the header yet
      if (!headerFound) {
        continue;
      }

      totalVariants++;
      const parts = trimmedLine.split(',');

      // Expected format: RSID,CHROMOSOME,POSITION,RESULT
      if (parts.length !== 4) {
        continue;
      }

      const [rsid, chromosome, positionStr, genotype] = parts;

      // Skip entries without valid rsid (must start with rs)
      // GSA- and -Y- entries are internal IDs, not standard rsids
      if (!rsid.startsWith('rs')) {
        continue;
      }

      // Parse position (can be 0 for Monadic DNA files)
      const position = parseInt(positionStr, 10);
      if (!Number.isInteger(position) || position < 0) {
        continue;
      }

      // Validate genotype (should be 2 characters: AA, TT, GG, CC, or --)
      if (genotype.length !== 2) {
        continue;
      }

      const validBases = new Set(['A', 'T', 'G', 'C', '-']);
      if (!validBases.has(genotype[0]) || !validBases.has(genotype[1])) {
        continue;
      }

      // Store the entry (chromosome can be '0' for Monadic DNA files)
      genotypeData.push({
        rsid,
        chromosome: chromosome === '0' ? '0' : chromosome,
        position,
        genotype,
      });

      validVariants++;
    }

    if (!headerFound) {
      return {
        success: false,
        error: 'No valid Monadic DNA header found. Expected: RSID,CHROMOSOME,POSITION,RESULT',
      };
    }

    if (validVariants === 0) {
      return {
        success: false,
        error: 'No valid genotype data found in file. Please ensure the file is in Monadic DNA format.',
      };
    }

    return {
      success: true,
      data: genotypeData,
      totalVariants,
      validVariants,
      detectedFormat: 'monadic',
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function detectAndParseGenotypeFile(content: string): ParseResult {
  // Try to detect format by looking at first few non-comment lines
  const lines = content.split('\n').slice(0, 20);

  // Check for Monadic DNA format (CSV with header)
  const hasMonadicHeader = lines.some(line =>
    line.trim().toUpperCase().startsWith('RSID,CHROMOSOME,POSITION,RESULT')
  );

  if (hasMonadicHeader) {
    return parseMonadicDNAFile(content);
  }

  // Check for 23andMe format (comment lines starting with #)
  const has23andMeComments = lines.some(line => line.trim().startsWith('#'));

  if (has23andMeComments) {
    return parse23andMeFile(content);
  }

  // Default to 23andMe format if ambiguous
  const result23andMe = parse23andMeFile(content);
  if (result23andMe.success) {
    return result23andMe;
  }

  // Try Monadic DNA as fallback
  const resultMonadic = parseMonadicDNAFile(content);
  if (resultMonadic.success) {
    return resultMonadic;
  }

  // If both fail, return the 23andMe error (more common format)
  return {
    success: false,
    error: 'Unable to detect file format. Supported formats: 23andMe (.txt) or Monadic DNA (.csv)',
  };
}

export function validateFileSize(file: File, maxSizeMB: number = 50): boolean {
  return file.size <= maxSizeMB * 1024 * 1024;
}

export function validateFileFormat(file: File): boolean {
  const validExtensions = ['.txt', '.tsv', '.csv'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some(ext => fileName.endsWith(ext));
}
