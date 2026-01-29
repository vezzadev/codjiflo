import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { oauthConfig } from '../config';
import type { RateLimitInfo } from '../types';

export type { RateLimitInfo };

type AuthMethod = 'oauth' | 'pat' | null;

interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
}

interface AuthState {
    token: string | null;
    refreshToken: string | null;
    tokenExpiresAt: number | null;
    authMethod: AuthMethod;
    isAuthenticated: boolean;
    error: string | null;
    isValidating: boolean;
    hasHydrated: boolean;
    rateLimitRemaining: number | null;
    rateLimitReset: Date | null;
    rateLimitLimit: number | null;
    setToken: (token: string) => void;
    logout: () => void;
    validateToken: (token: string) => Promise<boolean>;
    clearError: () => void;
    handleOAuthCallback: (code: string, codeVerifier: string) => Promise<boolean>;
    refreshAccessToken: () => Promise<boolean>;
    isTokenExpiringSoon: () => boolean;
    setHasHydrated: (hasHydrated: boolean) => void;
    updateRateLimit: (info: RateLimitInfo) => void;
}

/**
 * Validates GitHub Personal Access Token format
 * Valid formats: ghp_* or github_pat_*
 */
export function isValidTokenFormat(token: string): boolean {
    return token.startsWith('ghp_') || token.startsWith('github_pat_');
}

/**
 * Validates token by making a test request to GitHub API
 */
async function validateGitHubToken(token: string): Promise<boolean> {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Module-level variable to deduplicate concurrent refresh calls.
 * When a refresh is in-flight, subsequent callers await the same promise.
 */
let pendingRefreshPromise: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            refreshToken: null,
            tokenExpiresAt: null,
            authMethod: null,
            isAuthenticated: false,
            error: null,
            isValidating: false,
            hasHydrated: false,
            rateLimitRemaining: null,
            rateLimitReset: null,
            rateLimitLimit: null,

            setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),

            updateRateLimit: (info: RateLimitInfo) => set({
                rateLimitRemaining: info.remaining,
                rateLimitReset: info.reset,
                rateLimitLimit: info.limit,
            }),

            setToken: (token: string) => set({
                token,
                isAuthenticated: true,
                error: null,
                authMethod: 'pat',
            }),

            logout: () => set({
                token: null,
                refreshToken: null,
                tokenExpiresAt: null,
                authMethod: null,
                isAuthenticated: false,
                error: null,
            }),

            clearError: () => set({ error: null }),

            validateToken: async (token: string): Promise<boolean> => {
                set({ error: null, isValidating: true });

                if (!isValidTokenFormat(token)) {
                    set({
                        error: 'Invalid token format. Token must start with "ghp_" or "github_pat_"',
                        isValidating: false,
                    });
                    return false;
                }

                const isValid = await validateGitHubToken(token);

                if (isValid) {
                    set({
                        token,
                        isAuthenticated: true,
                        error: null,
                        isValidating: false,
                        authMethod: 'pat',
                    });
                    return true;
                } else {
                    set({
                        error: 'Authentication failed. Please check your token.',
                        isValidating: false,
                    });
                    return false;
                }
            },

            handleOAuthCallback: async (code: string, codeVerifier: string): Promise<boolean> => {
                set({ error: null, isValidating: true });

                try {
                    const response = await fetch('/api/auth/token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            code,
                            code_verifier: codeVerifier,
                        }),
                    });

                    const data = await response.json() as TokenResponse;

                    if (data.error) {
                        set({
                            error: data.error_description ?? data.error,
                            isValidating: false,
                        });
                        return false;
                    }

                    if (!data.access_token) {
                        set({
                            error: 'No access token received',
                            isValidating: false,
                        });
                        return false;
                    }

                    const expiresIn = data.expires_in ?? oauthConfig.defaultTokenExpirySeconds;
                    const tokenExpiresAt = Date.now() + expiresIn * 1000;

                    set({
                        token: data.access_token,
                        refreshToken: data.refresh_token ?? null,
                        tokenExpiresAt,
                        authMethod: 'oauth',
                        isAuthenticated: true,
                        error: null,
                        isValidating: false,
                    });

                    return true;
                } catch (err) {
                    console.error('OAuth callback error:', err);
                    set({
                        error: 'Failed to complete authentication',
                        isValidating: false,
                    });
                    return false;
                }
            },

            refreshAccessToken: async (): Promise<boolean> => {
                const { refreshToken, authMethod } = get();

                if (authMethod !== 'oauth' || !refreshToken) {
                    return false;
                }

                // If a refresh is already in-flight, return the same promise
                // to avoid concurrent refresh API calls
                if (pendingRefreshPromise) {
                    return pendingRefreshPromise;
                }

                const doRefresh = async (): Promise<boolean> => {
                    try {
                        const response = await fetch('/api/auth/refresh', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                refresh_token: refreshToken,
                            }),
                        });

                        const data = await response.json() as TokenResponse;

                        if (data.error || !data.access_token) {
                            // Refresh failed, user needs to re-authenticate
                            get().logout();
                            return false;
                        }

                        const expiresIn = data.expires_in ?? oauthConfig.defaultTokenExpirySeconds;
                        const tokenExpiresAt = Date.now() + expiresIn * 1000;

                        set({
                            token: data.access_token,
                            refreshToken: data.refresh_token ?? refreshToken,
                            tokenExpiresAt,
                        });

                        return true;
                    } catch (err) {
                        console.error('Token refresh error:', err);
                        get().logout();
                        return false;
                    } finally {
                        pendingRefreshPromise = null;
                    }
                };

                pendingRefreshPromise = doRefresh();
                return pendingRefreshPromise;
            },

            isTokenExpiringSoon: (): boolean => {
                const { tokenExpiresAt, authMethod } = get();

                if (authMethod !== 'oauth' || !tokenExpiresAt) {
                    return false;
                }

                return Date.now() >= tokenExpiresAt - oauthConfig.refreshThresholdMs;
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                token: state.token,
                refreshToken: state.refreshToken,
                tokenExpiresAt: state.tokenExpiresAt,
                authMethod: state.authMethod,
                isAuthenticated: state.isAuthenticated,
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);
