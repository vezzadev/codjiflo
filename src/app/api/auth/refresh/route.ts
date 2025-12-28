import { NextResponse } from 'next/server';

interface RefreshRequest {
  refresh_token: string;
}

interface GitHubTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * POST /api/auth/refresh
 * Refreshes an expired access token using a refresh token
 * This endpoint proxies the request to GitHub to keep the client secret secure
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as Partial<RefreshRequest>;
    const refresh_token = body.refresh_token;

    if (typeof refresh_token !== 'string' || refresh_token.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid parameter: refresh_token must be a non-empty string' },
        { status: 400 }
      );
    }

    const clientId = process.env.GITHUB_APP_CLIENT_ID;
    const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      const missing = [];
      if (!clientId) missing.push('GITHUB_APP_CLIENT_ID');
      if (!clientSecret) missing.push('GITHUB_APP_CLIENT_SECRET');
      console.error(`Missing GitHub App credentials: ${missing.join(', ')}`);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token,
      }),
    });

    if (!response.ok) {
      let errorBody: string | undefined;
      try {
        errorBody = await response.text();
      } catch {
        // Ignore body parsing errors for logging purposes
      }
      console.error(
        'GitHub token refresh endpoint returned non-OK status:',
        response.status,
        response.statusText,
        errorBody
      );
      return NextResponse.json(
        { error: 'Failed to refresh token with GitHub' },
        { status: 502 }
      );
    }

    const data = await response.json() as GitHubTokenResponse;

    if (data.error) {
      return NextResponse.json(
        { error: data.error, error_description: data.error_description },
        { status: 400 }
      );
    }

    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      refresh_token_expires_in: data.refresh_token_expires_in,
      token_type: data.token_type,
      scope: data.scope,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
