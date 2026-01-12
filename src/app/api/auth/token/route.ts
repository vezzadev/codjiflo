import { NextResponse } from 'next/server';
import { getPostHogClient } from '@/lib/posthog-server';

interface TokenRequest {
  code: string;
  code_verifier: string;
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
      typeof (rawBody as Record<string, unknown>).code !== 'string' ||
      typeof (rawBody as Record<string, unknown>).code_verifier !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid or missing parameters: code and code_verifier must be strings' },
        { status: 400 }
      );
    }

    const { code, code_verifier } = rawBody as TokenRequest;

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
        code,
        code_verifier,
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
        'GitHub token endpoint returned non-OK status:',
        response.status,
        response.statusText,
        errorBody
      );
      return NextResponse.json(
        { error: 'Failed to exchange token with GitHub' },
        { status: 502 }
      );
    }

    const data = await response.json() as GitHubTokenResponse;

    if (data.error) {
      // PostHog: Track server-side OAuth token exchange failure
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: 'anonymous',
        event: 'server_oauth_token_exchange_failed',
        properties: {
          error: data.error,
          error_description: data.error_description,
        },
      });

      return NextResponse.json(
        { error: data.error, error_description: data.error_description },
        { status: 400 }
      );
    }

    // PostHog: Track server-side OAuth token exchange success
    // Note: We don't have user ID at this point, but we track the event for analytics
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: 'oauth_exchange', // Generic ID since we don't know the user yet
      event: 'server_oauth_token_exchanged',
      properties: {
        has_refresh_token: !!data.refresh_token,
        token_type: data.token_type,
        scope: data.scope,
      },
    });

    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      refresh_token_expires_in: data.refresh_token_expires_in,
      token_type: data.token_type,
      scope: data.scope,
    });
  } catch (error) {
    console.error('Token exchange error:', error);

    // PostHog: Track server-side OAuth token exchange exception
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: 'anonymous',
      event: 'server_oauth_token_exchange_failed',
      properties: {
        error: 'exception',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
