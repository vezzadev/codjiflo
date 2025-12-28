/**
 * Cookie utilities for cross-subdomain OAuth flow
 * Uses cookies with base domain to enable PR preview authentication
 */

/**
 * Known base domain for production deployment.
 * Hardcoded to avoid security issues with multi-level TLDs (e.g., .co.uk).
 */
export const KNOWN_BASE_DOMAIN = '.vza.net';

/**
 * Cookie names for OAuth flow
 */
export const OAUTH_COOKIE_KEYS = {
  CODE_VERIFIER: 'oauth_code_verifier',
  STATE: 'oauth_state',
  RETURN_ORIGIN: 'oauth_return_origin',
  TOKEN_TRANSFER: 'oauth_token_transfer',
} as const;

/**
 * Gets the base domain for cookie sharing across subdomains.
 * Returns the hardcoded KNOWN_BASE_DOMAIN for production hosts,
 * or undefined for localhost (no domain attribute needed).
 */
export function getBaseDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const hostname = window.location.hostname;

  // Localhost - no domain needed
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return undefined;
  }

  // Use hardcoded base domain for known production hosts
  if (hostname.endsWith(KNOWN_BASE_DOMAIN.slice(1))) {
    return KNOWN_BASE_DOMAIN;
  }

  // Unknown domain - don't set domain attribute (cookie will be host-only)
  return undefined;
}

/**
 * Validates that a return origin is safe to redirect to.
 * Only allows localhost or subdomains of the known base domain.
 */
export function isValidReturnOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    // Allow localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    // Allow exact match of base domain (without leading dot)
    const baseDomainWithoutDot = KNOWN_BASE_DOMAIN.slice(1); // "vza.net"
    if (hostname === baseDomainWithoutDot) {
      return true;
    }

    // Allow subdomains of known base domain (must have dot before base domain)
    if (hostname.endsWith(KNOWN_BASE_DOMAIN)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Sets a cookie with optional domain for cross-subdomain access
 */
export function setCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    path?: string;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    domain?: string;
  } = {}
): void {
  const {
    maxAge = 600, // 10 minutes default
    path = '/',
    secure = window.location.protocol === 'https:',
    sameSite = 'Lax',
    domain = getBaseDomain(),
  } = options;

  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  cookie += `; path=${path}`;
  cookie += `; max-age=${String(maxAge)}`;
  cookie += `; samesite=${sameSite}`;

  if (secure) {
    cookie += '; secure';
  }

  if (domain) {
    cookie += `; domain=${domain}`;
  }

  document.cookie = cookie;
}

/**
 * Gets a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  const encodedName = encodeURIComponent(name);

  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === encodedName) {
      return decodeURIComponent(cookieValue ?? '');
    }
  }

  return null;
}

/**
 * Deletes a cookie by setting its expiry in the past
 */
export function deleteCookie(name: string, domain?: string): void {
  const baseDomain = domain ?? getBaseDomain();
  let cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`;

  if (baseDomain) {
    cookie += `; domain=${baseDomain}`;
  }

  document.cookie = cookie;

  // Also try without domain in case it was set without one
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`;
}

/**
 * Stores OAuth state in cookies for cross-subdomain access
 */
export function storeOAuthStateCookie(codeVerifier: string, state: string): void {
  setCookie(OAUTH_COOKIE_KEYS.CODE_VERIFIER, codeVerifier);
  setCookie(OAUTH_COOKIE_KEYS.STATE, state);
}

/**
 * Stores the return origin for post-auth redirect
 */
export function storeReturnOrigin(origin: string): void {
  setCookie(OAUTH_COOKIE_KEYS.RETURN_ORIGIN, origin);
}

/**
 * Retrieves and clears OAuth state from cookies
 */
export function retrieveOAuthStateCookie(): { codeVerifier: string; state: string } | null {
  const codeVerifier = getCookie(OAUTH_COOKIE_KEYS.CODE_VERIFIER);
  const state = getCookie(OAUTH_COOKIE_KEYS.STATE);

  if (!codeVerifier || !state) {
    return null;
  }

  // Clear the stored state
  deleteCookie(OAUTH_COOKIE_KEYS.CODE_VERIFIER);
  deleteCookie(OAUTH_COOKIE_KEYS.STATE);

  return { codeVerifier, state };
}

/**
 * Retrieves and clears the return origin
 */
export function retrieveReturnOrigin(): string | null {
  const origin = getCookie(OAUTH_COOKIE_KEYS.RETURN_ORIGIN);

  if (origin) {
    deleteCookie(OAUTH_COOKIE_KEYS.RETURN_ORIGIN);
  }

  return origin;
}

/**
 * Token transfer data structure for cross-subdomain token passing
 */
export interface TokenTransferData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Stores tokens in a cookie for cross-subdomain transfer.
 *
 * The token data is JSON-encoded and then base64-encoded to ensure it is
 * safely serializable for cookie transport. This base64 step is for
 * encoding/transport only and does NOT provide encryption or additional
 * confidentiality. Anyone with access to the cookie can decode it.
 *
 * Security mitigations:
 * - 1-minute TTL limits exposure window
 * - Cookie is cleared immediately after retrieval
 */
export function storeTokenTransfer(data: TokenTransferData): void {
  const encoded = btoa(JSON.stringify(data));
  setCookie(OAUTH_COOKIE_KEYS.TOKEN_TRANSFER, encoded, {
    maxAge: 60, // 1 minute - short-lived for security
  });
}

/**
 * Retrieves and clears the token transfer data
 */
export function retrieveTokenTransfer(): TokenTransferData | null {
  const encoded = getCookie(OAUTH_COOKIE_KEYS.TOKEN_TRANSFER);

  if (!encoded) {
    return null;
  }

  deleteCookie(OAUTH_COOKIE_KEYS.TOKEN_TRANSFER);

  try {
    const decoded = atob(encoded);
    return JSON.parse(decoded) as TokenTransferData;
  } catch {
    console.error('Failed to decode token transfer data');
    return null;
  }
}
