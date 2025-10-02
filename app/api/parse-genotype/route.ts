import { NextRequest, NextResponse } from "next/server";
import { detectAndParseGenotypeFile } from "@/lib/genotype-parser";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('genotype') as File;

    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: 'No genotype file provided' 
      }, { status: 400 });
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ 
        success: false, 
        error: 'File too large. Maximum size is 50MB.' 
      }, { status: 400 });
    }

    // Validate file format
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.txt') && !fileName.endsWith('.tsv') && !fileName.endsWith('.csv')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid file format. Please upload a .txt, .tsv, or .csv file from 23andMe or Monadic DNA.'
      }, { status: 400 });
    }

    // Parse the genotype file with auto-detection
    const fileContent = await file.text();
    const parseResult = detectAndParseGenotypeFile(fileContent);

    if (!parseResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: parseResult.error 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: parseResult.data,
      totalVariants: parseResult.totalVariants,
      validVariants: parseResult.validVariants,
      detectedFormat: parseResult.detectedFormat,
    });

  } catch (error) {
    console.error('Genotype parse error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error during parsing' 
    }, { status: 500 });
  }
}
