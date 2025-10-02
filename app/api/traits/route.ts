import { NextResponse } from "next/server";

import { executeQuery } from "@/lib/db";

export async function GET() {
  try {
    const rows = await executeQuery<{ trait: string | null }>(
      `SELECT DISTINCT COALESCE(NULLIF(TRIM(mapped_trait), ''), NULLIF(TRIM(disease_trait), '')) AS trait
       FROM gwas_catalog
       WHERE COALESCE(NULLIF(TRIM(mapped_trait), ''), NULLIF(TRIM(disease_trait), '')) IS NOT NULL
       ORDER BY COALESCE(NULLIF(TRIM(mapped_trait), ''), NULLIF(TRIM(disease_trait), '')) COLLATE NOCASE`
    );

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
