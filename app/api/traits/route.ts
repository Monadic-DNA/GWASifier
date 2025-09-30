import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT DISTINCT COALESCE(NULLIF(TRIM(mapped_trait), ''), NULLIF(TRIM(disease_trait), '')) AS trait
         FROM gwas_catalog
         WHERE COALESCE(NULLIF(TRIM(mapped_trait), ''), NULLIF(TRIM(disease_trait), '')) IS NOT NULL
         ORDER BY trait COLLATE NOCASE`,
      )
      .all() as { trait: string | null }[];

    const traits = rows
      .map((row) => row.trait)
      .filter((trait): trait is string => Boolean(trait))
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ traits });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch traits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
