import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { currentResult, allResults } = await request.json();

    // Check for API key
    const apiKey = process.env.NILLION_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Nillion API key not configured. Please set NILLION_API_KEY in your environment variables.' },
        { status: 503 }
      );
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

Please provide:
1. A clear explanation of what this result means
2. Context about the trait/condition
3. Interpretation of the risk level in practical terms
4. How this relates to any other results they have (if applicable)
5. Appropriate disclaimers and next steps

Keep your response concise (300-500 words), educational, and reassuring where appropriate. Use clear, accessible language.`;

    // Make request to Nillion's nilAI
    const nilaiResponse = await fetch('https://nilai.nillion.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.1-8B-Instruct',
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
      }),
    });

    if (!nilaiResponse.ok) {
      const errorText = await nilaiResponse.text();
      console.error('Nillion API error:', errorText);
      return NextResponse.json(
        { error: `Nillion API error: ${nilaiResponse.status} - ${errorText}` },
        { status: nilaiResponse.status }
      );
    }

    const data = await nilaiResponse.json();
    const commentary = data.choices?.[0]?.message?.content;

    if (!commentary) {
      return NextResponse.json(
        { error: 'No commentary generated from LLM' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      commentary,
      model: 'meta-llama/Llama-3.1-8B-Instruct',
    });

  } catch (error) {
    console.error('Error generating commentary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate commentary' },
      { status: 500 }
    );
  }
}
