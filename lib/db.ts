import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

let instance: Database.Database | null = null;

function resolveDatabasePath(): string {
  const fromEnv = process.env.GWAS_DB_PATH;
  if (fromEnv) {
    return fromEnv;
  }

  return path.join(process.cwd(), "localdata", "gwas_catalog.sqlite");
}

export function getDb(): Database.Database {
  if (instance) {
    return instance;
  }

  const dbPath = resolveDatabasePath();

  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `GWAS catalog database not found at ${dbPath}. Set GWAS_DB_PATH or create the SQLite database using localdata/gwas_catalog.sql.`,
    );
  }

  instance = new Database(dbPath, { readonly: true, fileMustExist: true });
  return instance;
}
