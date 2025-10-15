// In-memory SQL database for genetic analysis results
// Optimized for complex queries, filtering, and analytical operations on 100k+ results

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import type { SavedResult } from './results-manager';

let SQL: SqlJsStatic | null = null;

async function initSQL() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    });
  }
  return SQL;
}

export class ResultsDatabase {
  private db: Database | null = null;
  private sqlJs: SqlJsStatic | null = null;

  async initialize(): Promise<void> {
    this.sqlJs = await initSQL();
    this.db = new this.sqlJs.Database();

    // Create optimized schema with indexes
    this.db.run(`
      CREATE TABLE IF NOT EXISTS results (
        studyId INTEGER PRIMARY KEY,
        gwasId TEXT,
        traitName TEXT NOT NULL,
        studyTitle TEXT NOT NULL,
        userGenotype TEXT NOT NULL,
        riskAllele TEXT NOT NULL,
        effectSize TEXT NOT NULL,
        riskScore REAL NOT NULL,
        riskLevel TEXT NOT NULL,
        matchedSnp TEXT NOT NULL,
        analysisDate TEXT NOT NULL
      );
    `);

    // Create indexes for common query patterns
    this.db.run('CREATE INDEX IF NOT EXISTS idx_gwasId ON results(gwasId);');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_traitName ON results(traitName);');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_riskLevel ON results(riskLevel);');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_riskScore ON results(riskScore);');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_matchedSnp ON results(matchedSnp);');

    console.log('ResultsDatabase initialized with indexed schema');
  }

  async insertResult(result: SavedResult): Promise<void> {
    if (!this.db) await this.initialize();

    this.db!.run(`
      INSERT OR REPLACE INTO results (
        studyId, gwasId, traitName, studyTitle, userGenotype,
        riskAllele, effectSize, riskScore, riskLevel, matchedSnp, analysisDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      result.studyId,
      result.gwasId || null,
      result.traitName,
      result.studyTitle,
      result.userGenotype,
      result.riskAllele,
      result.effectSize,
      result.riskScore,
      result.riskLevel,
      result.matchedSnp,
      result.analysisDate
    ]);
  }

  async insertResultsBatch(results: SavedResult[]): Promise<void> {
    if (!this.db) await this.initialize();

    // Use transaction for batch insert (much faster)
    this.db!.run('BEGIN TRANSACTION;');

    try {
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO results (
          studyId, gwasId, traitName, studyTitle, userGenotype,
          riskAllele, effectSize, riskScore, riskLevel, matchedSnp, analysisDate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const result of results) {
        stmt.run([
          result.studyId,
          result.gwasId || null,
          result.traitName,
          result.studyTitle,
          result.userGenotype,
          result.riskAllele,
          result.effectSize,
          result.riskScore,
          result.riskLevel,
          result.matchedSnp,
          result.analysisDate
        ]);
      }

      stmt.free();
      this.db!.run('COMMIT;');
      console.log(`Batch inserted ${results.length} results`);
    } catch (error) {
      this.db!.run('ROLLBACK;');
      console.error('Batch insert failed:', error);
      throw error;
    }
  }

  async getResult(studyId: number): Promise<SavedResult | null> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`
      SELECT * FROM results WHERE studyId = ?
    `, [studyId]);

    if (!result.length || !result[0].values.length) return null;

    return this.rowToResult(result[0].columns, result[0].values[0]);
  }

  async getResultByGwasId(gwasId: string): Promise<SavedResult | null> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`
      SELECT * FROM results WHERE gwasId = ?
    `, [gwasId]);

    if (!result.length || !result[0].values.length) return null;

    return this.rowToResult(result[0].columns, result[0].values[0]);
  }

  async hasResult(studyId: number): Promise<boolean> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`
      SELECT 1 FROM results WHERE studyId = ? LIMIT 1
    `, [studyId]);

    return result.length > 0 && result[0].values.length > 0;
  }

  async getAllResults(): Promise<SavedResult[]> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`SELECT * FROM results`);

    if (!result.length) return [];

    return result[0].values.map(row =>
      this.rowToResult(result[0].columns, row)
    );
  }

  async getCount(): Promise<number> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`SELECT COUNT(*) as count FROM results`);

    if (!result.length || !result[0].values.length) return 0;

    return result[0].values[0][0] as number;
  }

  async removeResult(studyId: number): Promise<void> {
    if (!this.db) await this.initialize();

    this.db!.run(`DELETE FROM results WHERE studyId = ?`, [studyId]);
  }

  async clear(): Promise<void> {
    if (!this.db) await this.initialize();

    this.db!.run(`DELETE FROM results`);
  }

  // Advanced query methods for LLM analysis

  async queryByRiskLevel(riskLevel: 'increased' | 'decreased' | 'neutral'): Promise<SavedResult[]> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`
      SELECT * FROM results WHERE riskLevel = ?
    `, [riskLevel]);

    if (!result.length) return [];

    return result[0].values.map(row => this.rowToResult(result[0].columns, row));
  }

  async queryByTraitPattern(pattern: string): Promise<SavedResult[]> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`
      SELECT * FROM results WHERE traitName LIKE ?
    `, [`%${pattern}%`]);

    if (!result.length) return [];

    return result[0].values.map(row => this.rowToResult(result[0].columns, row));
  }

  async queryByRiskScoreRange(minScore: number, maxScore: number): Promise<SavedResult[]> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`
      SELECT * FROM results
      WHERE riskScore >= ? AND riskScore <= ?
      ORDER BY riskScore DESC
    `, [minScore, maxScore]);

    if (!result.length) return [];

    return result[0].values.map(row => this.rowToResult(result[0].columns, row));
  }

  async getTopRisks(limit: number = 10): Promise<SavedResult[]> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`
      SELECT * FROM results
      WHERE riskLevel = 'increased'
      ORDER BY riskScore DESC
      LIMIT ?
    `, [limit]);

    if (!result.length) return [];

    return result[0].values.map(row => this.rowToResult(result[0].columns, row));
  }

  async getProtectiveVariants(limit: number = 10): Promise<SavedResult[]> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`
      SELECT * FROM results
      WHERE riskLevel = 'decreased'
      ORDER BY riskScore ASC
      LIMIT ?
    `, [limit]);

    if (!result.length) return [];

    return result[0].values.map(row => this.rowToResult(result[0].columns, row));
  }

  // Optimized method for LLM context: Get top N results by effect size, excluding specific gwasId
  async getTopResultsByEffect(limit: number, excludeGwasId?: string): Promise<SavedResult[]> {
    if (!this.db) await this.initialize();

    // Order by absolute distance from 1.0 (neutral risk score)
    // This gives us the most significant results regardless of direction
    const result = this.db!.exec(`
      SELECT * FROM results
      WHERE gwasId IS NOT NULL ${excludeGwasId ? 'AND gwasId != ?' : ''}
      ORDER BY ABS(riskScore - 1.0) DESC
      LIMIT ?
    `, excludeGwasId ? [excludeGwasId, limit] : [limit]);

    if (!result.length) return [];

    return result[0].values.map(row => this.rowToResult(result[0].columns, row));
  }

  async getTraitCategories(): Promise<Array<{ trait: string; count: number }>> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`
      SELECT traitName as trait, COUNT(*) as count
      FROM results
      GROUP BY traitName
      ORDER BY count DESC
    `);

    if (!result.length) return [];

    return result[0].values.map(row => ({
      trait: row[0] as string,
      count: row[1] as number
    }));
  }

  async getRiskStatistics(): Promise<{
    totalResults: number;
    increasedRisk: number;
    decreasedRisk: number;
    neutral: number;
    avgRiskScore: number;
  }> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN riskLevel = 'increased' THEN 1 ELSE 0 END) as increased,
        SUM(CASE WHEN riskLevel = 'decreased' THEN 1 ELSE 0 END) as decreased,
        SUM(CASE WHEN riskLevel = 'neutral' THEN 1 ELSE 0 END) as neutral,
        AVG(riskScore) as avgScore
      FROM results
    `);

    if (!result.length || !result[0].values.length) {
      return { totalResults: 0, increasedRisk: 0, decreasedRisk: 0, neutral: 0, avgRiskScore: 0 };
    }

    const row = result[0].values[0];
    return {
      totalResults: row[0] as number,
      increasedRisk: row[1] as number,
      decreasedRisk: row[2] as number,
      neutral: row[3] as number,
      avgRiskScore: row[4] as number
    };
  }

  // Custom SQL query for advanced analysis
  async executeQuery(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) await this.initialize();

    const result = this.db!.exec(sql, params);

    if (!result.length) return [];

    return result[0].values.map(row => {
      const obj: any = {};
      result[0].columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }

  private rowToResult(columns: string[], row: any[]): SavedResult {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });

    return {
      studyId: obj.studyId,
      gwasId: obj.gwasId,
      traitName: obj.traitName,
      studyTitle: obj.studyTitle,
      userGenotype: obj.userGenotype,
      riskAllele: obj.riskAllele,
      effectSize: obj.effectSize,
      riskScore: obj.riskScore,
      riskLevel: obj.riskLevel,
      matchedSnp: obj.matchedSnp,
      analysisDate: obj.analysisDate
    };
  }

  // Export database state (for debugging)
  async exportToArray(): Promise<Uint8Array | null> {
    if (!this.db) return null;
    return this.db.export();
  }

  // Import database state
  async importFromArray(data: Uint8Array): Promise<void> {
    this.sqlJs = await initSQL();
    this.db = new this.sqlJs.Database(data);
  }
}

export const resultsDB = new ResultsDatabase();
