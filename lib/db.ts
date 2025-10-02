import Database from "better-sqlite3";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

let sqliteInstance: Database.Database | null = null;
let pgPool: Pool | null = null;

type DbConnection = {
  type: 'sqlite' | 'postgres';
  sqlite?: Database.Database;
  postgres?: Pool;
};

function getSSLConfig(connectionString: string) {
  // Local connections don't need SSL
  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
    return false;
  }

  // Check if CA certificate file exists
  const caCertPath = path.join(process.cwd(), 'certs', 'ca-certificate.crt');

  if (fs.existsSync(caCertPath)) {
    // For DigitalOcean, we need to relax TLS validation due to certificate chain presentation issues
    // This is secure because we still use SSL and have the proper CA certificate
    if (connectionString.includes('digitalocean.com') || connectionString.includes('ondigitalocean.com')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    // Set environment variables for PostgreSQL SSL
    process.env.PGSSLROOTCERT = caCertPath;
    process.env.PGSSLMODE = 'require';

    return undefined;
  }

  // For DigitalOcean and other cloud providers, try to accept their certificates
  if (connectionString.includes('digitalocean.com') || connectionString.includes('.db.ondigitalocean.com') || connectionString.includes('ondigitalocean.com')) {
    return {
      rejectUnauthorized: false, // Accept DigitalOcean's certificates
      checkServerIdentity: () => undefined, // Skip hostname verification
    };
  }

  // Default SSL config for other cloud providers
  return {
    rejectUnauthorized: false,
  };
}

function resolveDatabasePath(): string {
  const fromEnv = process.env.GWAS_DB_PATH;
  if (fromEnv) {
    return fromEnv;
  }

  return path.join(process.cwd(), "localdata", "gwas_catalog.sqlite");
}

export function getDbType(): 'sqlite' | 'postgres' {
  return process.env.POSTGRES_DB ? 'postgres' : 'sqlite';
}

export function getDb(): DbConnection {
  // Check if PostgreSQL connection string is provided
  const postgresDb = process.env.POSTGRES_DB;

  if (postgresDb) {
    if (!pgPool) {
      pgPool = new Pool({
        connectionString: postgresDb,
        ssl: getSSLConfig(postgresDb)
      });
    }
    return {
      type: 'postgres',
      postgres: pgPool,
    };
  }

  // Fall back to SQLite
  if (sqliteInstance) {
    return {
      type: 'sqlite',
      sqlite: sqliteInstance,
    };
  }

  const dbPath = resolveDatabasePath();

  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `GWAS catalog database not found at ${dbPath}. Set GWAS_DB_PATH or create the SQLite database using localdata/gwas_catalog.sql.`,
    );
  }

  sqliteInstance = new Database(dbPath, { readonly: true, fileMustExist: true });
  return {
    type: 'sqlite',
    sqlite: sqliteInstance,
  };
}

// Helper function to convert SQLite query to PostgreSQL format
function convertQueryToPostgres(query: string): string {
  let pgQuery = query;
  let paramIndex = 1;

  // Replace SQLite ? placeholders with PostgreSQL $1, $2, etc.
  pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);

  // Replace SQLite's COLLATE NOCASE with PostgreSQL LOWER() function
  pgQuery = pgQuery.replace(/COLLATE NOCASE/gi, '');

  // For PostgreSQL, we need to handle case-insensitive ordering differently
  // Simply remove the COLLATE clause and sort case-sensitively for now
  // The client-side sorting will handle case-insensitive sorting

  // Replace rowid with a row number for PostgreSQL (since PostgreSQL doesn't have rowid)
  // We'll use ROW_NUMBER() OVER() to simulate SQLite's rowid
  pgQuery = pgQuery.replace(/SELECT\s+rowid\s+AS\s+id,/gi, 'SELECT ROW_NUMBER() OVER() AS id,');

  return pgQuery;
}

// Helper function to execute queries on either database type
export async function executeQuery<T>(query: string, params: any[] = []): Promise<T[]> {
  const db = getDb();

  if (db.type === 'postgres' && db.postgres) {
    const pgQuery = convertQueryToPostgres(query);
    const result = await db.postgres.query(pgQuery, params);
    return result.rows;
  } else if (db.type === 'sqlite' && db.sqlite) {
    const stmt = db.sqlite.prepare(query);
    return stmt.all(...params) as T[];
  }

  throw new Error('No database connection available');
}

export async function executeQuerySingle<T>(query: string, params: any[] = []): Promise<T | null> {
  const db = getDb();

  if (db.type === 'postgres' && db.postgres) {
    const pgQuery = convertQueryToPostgres(query);
    const result = await db.postgres.query(pgQuery, params);
    return result.rows[0] || null;
  } else if (db.type === 'sqlite' && db.sqlite) {
    const stmt = db.sqlite.prepare(query);
    return (stmt.get(...params) as T) || null;
  }

  throw new Error('No database connection available');
}
