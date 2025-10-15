/**
 * Example queries for analyzing genetic results using the SQL-backed ResultsDatabase
 *
 * These examples show how to use the advanced query methods exposed through useResults()
 * for LLM-based analysis, data visualization, and complex filtering.
 */

import { useResults } from '@/app/components/ResultsContext';

// Example 1: Get all results with increased risk
export async function getIncreasedRiskResults() {
  const { queryByRiskLevel } = useResults();
  const increasedRisks = await queryByRiskLevel('increased');

  console.log(`Found ${increasedRisks.length} variants with increased risk`);
  return increasedRisks;
}

// Example 2: Find all heart-related conditions
export async function getHeartRelatedTraits() {
  const { queryByTraitPattern } = useResults();
  const heartTraits = await queryByTraitPattern('heart');

  console.log(`Found ${heartTraits.length} heart-related genetic associations`);
  return heartTraits;
}

// Example 3: Get high-risk variants (risk score > 1.5)
export async function getHighRiskVariants() {
  const { queryByRiskScoreRange } = useResults();
  const highRisks = await queryByRiskScoreRange(1.5, 10);

  console.log(`Found ${highRisks.length} high-risk variants (>1.5x)`);
  return highRisks;
}

// Example 4: Get summary statistics for LLM analysis
export async function getSummaryForLLM() {
  const { getRiskStatistics, getTraitCategories, getTopRisks, getProtectiveVariants } = useResults();

  const [stats, categories, topRisks, protective] = await Promise.all([
    getRiskStatistics(),
    getTraitCategories(),
    getTopRisks(5),
    getProtectiveVariants(5)
  ]);

  return {
    stats,
    topCategories: categories.slice(0, 10),
    topRisks,
    protective
  };
}

// Example 5: Custom SQL query for complex analysis
export async function getComplexQuery() {
  const { executeQuery } = useResults();

  // Example: Find all results where user has 2 copies of risk allele
  const results = await executeQuery(`
    SELECT traitName, riskScore, userGenotype, riskAllele
    FROM results
    WHERE riskLevel = 'increased'
      AND riskScore > 1.2
    ORDER BY riskScore DESC
    LIMIT 20
  `);

  return results;
}

// Example 6: Analyze trait distribution
export async function analyzeTraitDistribution() {
  const { executeQuery } = useResults();

  const distribution = await executeQuery(`
    SELECT
      riskLevel,
      COUNT(*) as count,
      AVG(riskScore) as avgScore,
      MIN(riskScore) as minScore,
      MAX(riskScore) as maxScore
    FROM results
    GROUP BY riskLevel
  `);

  return distribution;
}

// Example 7: Find variants with similar risk profiles
export async function findSimilarRiskProfiles(targetRiskScore: number, tolerance: number = 0.1) {
  const { executeQuery } = useResults();

  const similar = await executeQuery(`
    SELECT *
    FROM results
    WHERE riskScore BETWEEN ? AND ?
    ORDER BY ABS(riskScore - ?) ASC
    LIMIT 10
  `, [
    targetRiskScore - tolerance,
    targetRiskScore + tolerance,
    targetRiskScore
  ]);

  return similar;
}

// Example 8: Get all results for a specific SNP
export async function getResultsBySnp(snpId: string) {
  const { executeQuery } = useResults();

  const results = await executeQuery(`
    SELECT *
    FROM results
    WHERE matchedSnp = ?
  `, [snpId]);

  return results;
}

// Example 9: LLM-friendly summary for specific traits
export async function getTraitSummaryForLLM(traitKeyword: string) {
  const { executeQuery } = useResults();

  const summary = await executeQuery(`
    SELECT
      traitName,
      COUNT(*) as variantCount,
      AVG(riskScore) as avgRiskScore,
      SUM(CASE WHEN riskLevel = 'increased' THEN 1 ELSE 0 END) as increasedCount,
      SUM(CASE WHEN riskLevel = 'decreased' THEN 1 ELSE 0 END) as decreasedCount
    FROM results
    WHERE traitName LIKE ?
    GROUP BY traitName
    ORDER BY variantCount DESC
  `, [`%${traitKeyword}%`]);

  return summary;
}

// Example 10: Prepare data for LLM analysis - top concerns
export async function prepareTopConcernsForLLM() {
  const { executeQuery } = useResults();

  // Get variants with significant risk increase (>30% or <0.7)
  const concerns = await executeQuery(`
    SELECT
      traitName,
      studyTitle,
      userGenotype,
      riskAllele,
      effectSize,
      riskScore,
      riskLevel,
      matchedSnp
    FROM results
    WHERE (riskLevel = 'increased' AND riskScore > 1.3)
       OR (riskLevel = 'decreased' AND riskScore < 0.7)
    ORDER BY
      CASE
        WHEN riskLevel = 'increased' THEN riskScore
        ELSE 1.0 / riskScore
      END DESC
    LIMIT 15
  `);

  return concerns;
}

/**
 * Usage in a React component:
 *
 * ```typescript
 * function MyAnalysisComponent() {
 *   const results = useResults();
 *   const [summary, setSummary] = useState(null);
 *
 *   useEffect(() => {
 *     async function analyze() {
 *       // Get top 10 highest risk variants
 *       const topRisks = await results.getTopRisks(10);
 *
 *       // Get all diabetes-related results
 *       const diabetesResults = await results.queryByTraitPattern('diabetes');
 *
 *       // Get overall statistics
 *       const stats = await results.getRiskStatistics();
 *
 *       setSummary({ topRisks, diabetesResults, stats });
 *     }
 *
 *     analyze();
 *   }, []);
 *
 *   // Render...
 * }
 * ```
 */
