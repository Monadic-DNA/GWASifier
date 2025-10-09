import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates that requests come from allowed origins
 * - In development (localhost): allows all localhost ports
 * - In production: only allows same-domain requests
 */
export function validateOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  // Check if request is from localhost (development)
  const isLocalhost = origin?.includes('localhost') ||
                      origin?.includes('127.0.0.1') ||
                      referer?.includes('localhost') ||
                      referer?.includes('127.0.0.1');

  if (isLocalhost) {
    // Allow all localhost requests in development
    return null;
  }

  // In production, only allow requests from the same domain
  const requestOrigin = origin || (referer ? new URL(referer).origin : null);
  const expectedOrigin = host ? `https://${host}` : null;

  if (!requestOrigin || !expectedOrigin || !requestOrigin.startsWith(expectedOrigin.replace(/:\d+$/, ''))) {
    console.warn(`Unauthorized origin: ${requestOrigin || 'none'}, expected: ${expectedOrigin}`);
    return NextResponse.json(
      { error: 'Unauthorized origin' },
      { status: 403 }
    );
  }

  // Origin is valid
  return null;
}
