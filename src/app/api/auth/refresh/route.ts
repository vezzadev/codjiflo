import { NextResponse } from 'next/server';
import {
  validateClientCredentials,
  isValidCredentials,
  refreshAccessToken,
} from '../utils';

interface RefreshRequest {
  refresh_token: string;
}

/**
 * POST /api/auth/refresh
 * Refreshes an expired access token using a refresh token
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
      typeof (rawBody as { [key: string]: unknown }).refresh_token !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid parameter: refresh_token must be a non-empty string' },
        { status: 400 }
      );
    }

    const { refresh_token } = rawBody as RefreshRequest;

    if (refresh_token.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid parameter: refresh_token must be a non-empty string' },
        { status: 400 }
      );
    }

    const credentials = validateClientCredentials();
    if (!isValidCredentials(credentials)) {
      return credentials;
    }

    return await refreshAccessToken({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      refreshToken: refresh_token,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
