import { NextRequest, NextResponse } from 'next/server';
import { DelegationTokenServer, NilAuthInstance } from '@nillion/nilai-ts';

export async function POST(request: NextRequest) {
  try {
    const { delegationRequest } = await request.json();

    if (!delegationRequest) {
      return NextResponse.json(
        { error: 'Delegation request is required' },
        { status: 400 }
      );
    }

    // Check for NilAI API key
    const apiKey = process.env.NILLION_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'NilAI API key not configured. Please set NILLION_API_KEY in your environment variables.' },
        { status: 503 }
      );
    }

    // Create delegation token server
    const server = new DelegationTokenServer(apiKey, {
      nilauthInstance: NilAuthInstance.SANDBOX,
      expirationTime: 600, // 10 minutes validity
      tokenMaxUses: 1 // Single use for privacy
    });

    // Generate delegation token
    const delegationToken = await server.createDelegationToken(delegationRequest);

    return NextResponse.json({
      success: true,
      delegationToken,
    });

  } catch (error) {
    console.error('Error creating delegation token:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create delegation token' },
      { status: 500 }
    );
  }
}
