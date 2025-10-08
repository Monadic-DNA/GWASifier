import { NextRequest, NextResponse } from 'next/server';
import { executeQuerySingle, getDbType } from '@/lib/db';
import { NilaiOpenAIClient } from '@nillion/nilai-ts';

export async function POST(request: NextRequest) {
  try {
    const { currentResult, allResults, studyId } = await request.json();

    // Check for NilAI API key
    const apiKey = process.env.NILLION_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'NilAI API key not configured. Please set NILLION_API_KEY in your environment variables.' },
        { status: 503 }
      );
    }

    // Fetch detailed study information from database if studyId is provided
    let studyDetails = '';
    if (studyId) {
      try {
        const dbType = getDbType();
        const idCondition = dbType === 'postgres'
          ? 'hashtext(COALESCE(study_accession, \'\') || COALESCE(snps, \'\') || COALESCE(strongest_snp_risk_allele, \'\') || COALESCE(p_value, \'\') || COALESCE(or_or_beta::text, \'\')) = ?'
          : 'rowid = ?';

        const query = `
          SELECT
            disease_trait,
            study_accession,
            pubmedid,
            first_author,
            date,
            journal,
            link,
            study,
            initial_sample_size,
            replication_sample_size,
            p_value,
            pvalue_mlog,
            context,
            intergenic,
            mapped_gene,
            upstream_gene_id,
            downstream_gene_id,
            reported_genes
          FROM gwas_catalog
          WHERE ${idCondition}
        `;

        const study = await executeQuerySingle<{
          disease_trait: string | null;
          study_accession: string | null;
          pubmedid: string | null;
          first_author: string | null;
          date: string | null;
          journal: string | null;
          link: string | null;
          study: string | null;
          initial_sample_size: string | null;
          replication_sample_size: string | null;
          p_value: string | null;
          pvalue_mlog: string | null;
          context: string | null;
          intergenic: string | null;
          mapped_gene: string | null;
          upstream_gene_id: string | null;
          downstream_gene_id: string | null;
          reported_genes: string | null;
        }>(query, [studyId]);

        if (study) {
          studyDetails = `\n\nDETAILED STUDY INFORMATION:
- Study Accession: ${study.study_accession || 'N/A'}
- Publication: ${study.first_author || 'N/A'} (${study.date || 'N/A'})
- Journal: ${study.journal || 'N/A'}
- PubMed ID: ${study.pubmedid || 'N/A'}
- Study Description: ${study.study || 'N/A'}
- Sample Sizes: Initial=${study.initial_sample_size || 'N/A'}, Replication=${study.replication_sample_size || 'N/A'}
- P-value: ${study.p_value || 'N/A'}
- Associated Genes: ${study.reported_genes || study.mapped_gene || 'N/A'}
- Genomic Context: ${study.context || 'N/A'}
${study.link ? `- Study Link: ${study.link}` : ''}`;
        }
      } catch (err) {
        console.error('Error fetching study details:', err);
        // Continue without study details if there's an error
      }
    }

    // Construct the prompt with all results context
    const contextResults = allResults
      .map((r: any, idx: number) =>
        `${idx + 1}. ${r.traitName} (${r.studyTitle}):
   - Your genotype: ${r.userGenotype}
   - Risk allele: ${r.riskAllele}
   - Effect size: ${r.effectSize}
   - Risk score: ${r.riskScore}x (${r.riskLevel})
   - Matched SNP: ${r.matchedSnp}`
      )
      .join('\n\n');

    const prompt = `You are a genetic counselor providing educational commentary on GWAS (Genome-Wide Association Study) results.

IMPORTANT DISCLAIMERS TO INCLUDE:
1. This is for educational and entertainment purposes only
2. This is NOT medical advice and should not be used for medical decisions
3. GWAS results show statistical associations, not deterministic outcomes
4. Genetic risk is just one factor among many (lifestyle, environment, other genes)
5. Always consult healthcare professionals for medical interpretation
6. These results come from research studies and may not be clinically validated

CURRENT RESULT TO ANALYZE:
Trait: ${currentResult.traitName}
Study: ${currentResult.studyTitle}
Your genotype: ${currentResult.userGenotype}
Risk allele: ${currentResult.riskAllele}
Effect size: ${currentResult.effectSize}
Risk score: ${currentResult.riskScore}x (${currentResult.riskLevel})
Matched SNP: ${currentResult.matchedSnp}
Study date: ${currentResult.analysisDate}

ALL YOUR SAVED RESULTS FOR CONTEXT:
${contextResults}
${studyDetails}

Please provide:
1. A brief, plain-language summary of what this research study found (what scientists were investigating and what they discovered)
2. A clear explanation of what this result means for the user specifically
3. Context about the trait/condition in terms anyone can understand
4. Interpretation of the risk level in practical terms
5. How this relates to any other results they have (if applicable)
6. Appropriate disclaimers and next steps

Keep your response concise (400-600 words), educational, and reassuring where appropriate. Use clear, accessible language suitable for someone with no scientific background. Avoid jargon, and when technical terms are necessary, explain them simply.`;

    // Initialize NilAI client
    const client = new NilaiOpenAIClient({
      baseURL: 'https://nilai-a779.nillion.network/v1/',
      apiKey: apiKey,
    });

    // Make request to NilAI
    console.log('Sending request to NilAI API...');
    const response = await client.chat.completions.create({
      model: 'google/gemma-3-27b-it',
      messages: [
        {
          role: 'system',
          content: 'You are a knowledgeable genetic counselor who explains GWAS results clearly and responsibly, always emphasizing appropriate disclaimers and limitations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const commentary = response.choices?.[0]?.message?.content;

    if (!commentary) {
      return NextResponse.json(
        { error: 'No commentary generated from LLM' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      commentary,
      model: 'google/gemma-3-27b-it',
    });

  } catch (error) {
    console.error('Error generating commentary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate commentary' },
      { status: 500 }
    );
  }
}
