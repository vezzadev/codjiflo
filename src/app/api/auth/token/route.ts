import { NextResponse } from 'next/server';
import {
  validateClientCredentials,
  isValidCredentials,
  exchangeCodeForToken,
} from '../utils';

interface TokenRequest {
  code: string;
  code_verifier: string;
}

/**
 * POST /api/auth/token
 * Exchanges an authorization code for access and refresh tokens
 * This endpoint proxies the request to GitHub to keep the client secret secure
 */
export async function POST(req: Request): Promise<Response> {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (
      !rawBody ||
      typeof rawBody !== 'object' ||
      typeof (rawBody as { [key: string]: unknown }).code !== 'string' ||
      typeof (rawBody as { [key: string]: unknown }).code_verifier !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid or missing parameters: code and code_verifier must be strings' },
        { status: 400 }
      );
    }

    const { code, code_verifier } = rawBody as TokenRequest;

    const credentials = await validateClientCredentials();
    if (!isValidCredentials(credentials)) {
      return credentials;
    }

    return await exchangeCodeForToken({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      code,
      codeVerifier: code_verifier,
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
