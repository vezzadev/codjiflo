import { NextResponse } from 'next/server';
import type { GitHubTokenResponse } from '@/features/auth/types';

const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';

interface ClientCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Resolves the GitHub App client secret — the app's only runtime secret.
 *
 * In production (Cloudflare Worker) the secret lives in a bound Cloudflare
 * Secret Store and is read through the binding; its value is never present in
 * `process.env` and never leaves the store. Locally and in CI the secret is a
 * plain `process.env` value (off-band `.env.local`, or `GITHUB_TOKEN`-style
 * injection). We therefore check `process.env` first, then fall back to the
 * Secret Store binding via the OpenNext Cloudflare context.
 */
async function resolveClientSecret(): Promise<string | undefined> {
  const fromEnv = process.env.GITHUB_APP_CLIENT_SECRET;
  if (fromEnv) {
    return fromEnv;
  }

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const env = getCloudflareContext().env as { [key: string]: unknown };
    // Secret Store bindings expose an async `.get()` accessor.
    const binding = env.GITHUB_APP_CLIENT_SECRET as { get?: () => Promise<string> } | undefined;
    if (binding?.get) {
      return await binding.get();
    }
  } catch {
    // Not running inside a Cloudflare Worker context (local dev / tests).
  }

  return undefined;
}

/**
 * Validates that required GitHub App client credentials are configured.
 * Returns credentials if valid, or an error response if not.
 */
export async function validateClientCredentials(): Promise<ClientCredentials | NextResponse> {
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = await resolveClientSecret();

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

  return { clientId, clientSecret };
}

/**
 * Type guard to check if the result is valid credentials.
 */
export function isValidCredentials(result: ClientCredentials | NextResponse): result is ClientCredentials {
  return 'clientId' in result && 'clientSecret' in result;
}

interface TokenExchangeParams {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
}

interface TokenRefreshParams {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Exchanges an authorization code for tokens with GitHub's OAuth endpoint.
 */
export async function exchangeCodeForToken(params: TokenExchangeParams): Promise<NextResponse> {
  const { clientId, clientSecret, code, codeVerifier } = params;

  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: codeVerifier,
  };

  return callGitHubTokenEndpoint(body, 'Token exchange');
}

/**
 * Refreshes an expired access token using a refresh token.
 */
export async function refreshAccessToken(params: TokenRefreshParams): Promise<NextResponse> {
  const { clientId, clientSecret, refreshToken } = params;

  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };

  return callGitHubTokenEndpoint(body, 'Token refresh');
}

/**
 * Internal helper to call GitHub's token endpoint with consistent error handling.
 */
async function callGitHubTokenEndpoint(
  body: { [key: string]: string },
  operationName: string
): Promise<NextResponse> {
  const response = await fetch(GITHUB_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorBody: string | undefined;
    try {
      errorBody = await response.text();
    } catch {
      // Ignore body parsing errors for logging purposes
    }
    console.error(
      `GitHub ${operationName.toLowerCase()} endpoint returned non-OK status:`,
      response.status,
      response.statusText,
      errorBody
    );
    return NextResponse.json(
      { error: `Failed to ${operationName.toLowerCase()} with GitHub` },
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
}
