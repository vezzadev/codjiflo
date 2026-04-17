import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore, isValidTokenFormat } from './useAuthStore';

// Mock fetch
global.fetch = vi.fn();

describe('isValidTokenFormat', () => {
    it('should return true for ghp_ prefix', () => {
        expect(isValidTokenFormat('ghp_1234567890')).toBe(true);
    });

    it('should return true for github_pat_ prefix', () => {
        expect(isValidTokenFormat('github_pat_1234567890')).toBe(true);
    });

    it('should return true for gho_ prefix (OAuth token)', () => {
        expect(isValidTokenFormat('gho_1234567890')).toBe(true);
    });

    it('should return true for ghs_ prefix (GitHub App installation token)', () => {
        expect(isValidTokenFormat('ghs_1234567890')).toBe(true);
    });

    it('should return false for invalid prefix', () => {
        expect(isValidTokenFormat('invalid_token')).toBe(false);
        expect(isValidTokenFormat('')).toBe(false);
    });
});

describe('useAuthStore', () => {
    beforeEach(() => {
        useAuthStore.setState({ 
            token: null, 
            isAuthenticated: false,
            error: null,
            isValidating: false
        });
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('should have initial state', () => {
        const state = useAuthStore.getState();
        expect(state.token).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.error).toBeNull();
        expect(state.isValidating).toBe(false);
    });

    it('setToken should update token and isAuthenticated', () => {
        useAuthStore.getState().setToken('test-token');

        const state = useAuthStore.getState();
        expect(state.token).toBe('test-token');
        expect(state.isAuthenticated).toBe(true);
        expect(state.error).toBeNull();
    });

    it('logout should clear token and isAuthenticated', () => {
        useAuthStore.setState({ token: 'test-token', isAuthenticated: true });

        useAuthStore.getState().logout();

        const state = useAuthStore.getState();
        expect(state.token).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.error).toBeNull();
    });

    it('clearError should clear error state', () => {
        useAuthStore.setState({ error: 'Test error' });
        
        useAuthStore.getState().clearError();
        
        expect(useAuthStore.getState().error).toBeNull();
    });

    it('should persist token and isAuthenticated to localStorage', () => {
        useAuthStore.getState().setToken('persisted-token');

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const storageValue = JSON.parse(localStorage.getItem('auth-storage') ?? '{}');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(storageValue.state.token).toBe('persisted-token');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(storageValue.state.isAuthenticated).toBe(true);
    });

    it('validateToken should reject invalid format', async () => {
        const result = await useAuthStore.getState().validateToken('invalid_token');
        
        expect(result).toBe(false);
        const state = useAuthStore.getState();
        expect(state.error).toBe('Invalid token format. Token must start with "ghp_" or "github_pat_"');
        expect(state.isValidating).toBe(false);
        expect(state.isAuthenticated).toBe(false);
    });

    it('validateToken should accept valid format and successful API response', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
        } as Response);

        const result = await useAuthStore.getState().validateToken('ghp_validtoken123');
        
        expect(result).toBe(true);
        const state = useAuthStore.getState();
        expect(state.token).toBe('ghp_validtoken123');
        expect(state.isAuthenticated).toBe(true);
        expect(state.error).toBeNull();
        expect(state.isValidating).toBe(false);
    });

    it('validateToken should reject valid format but failed API response', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
        } as Response);

        const result = await useAuthStore.getState().validateToken('ghp_invalidtoken123');
        
        expect(result).toBe(false);
        const state = useAuthStore.getState();
        expect(state.error).toBe('Authentication failed. Please check your token.');
        expect(state.isValidating).toBe(false);
        expect(state.isAuthenticated).toBe(false);
    });

    it('validateToken should handle network errors', async () => {
        vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

        const result = await useAuthStore.getState().validateToken('ghp_validtoken123');

        expect(result).toBe(false);
        const state = useAuthStore.getState();
        expect(state.error).toBe('Authentication failed. Please check your token.');
        expect(state.isValidating).toBe(false);
    });
});

describe('useAuthStore OAuth methods', () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            refreshToken: null,
            tokenExpiresAt: null,
            authMethod: null,
            isAuthenticated: false,
            error: null,
            isValidating: false,
        });
        localStorage.clear();
        vi.clearAllMocks();
    });

    describe('handleOAuthCallback', () => {
        it('should exchange code for tokens successfully', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                json: () => Promise.resolve({
                    access_token: 'test_access_token',
                    refresh_token: 'test_refresh_token',
                    expires_in: 28800,
                }),
            } as Response);

            const result = await useAuthStore.getState().handleOAuthCallback('auth_code', 'code_verifier');

            expect(result).toBe(true);
            const state = useAuthStore.getState();
            expect(state.token).toBe('test_access_token');
            expect(state.refreshToken).toBe('test_refresh_token');
            expect(state.authMethod).toBe('oauth');
            expect(state.isAuthenticated).toBe(true);
            expect(state.tokenExpiresAt).toBeGreaterThan(Date.now());
        });

        it('should handle OAuth error response', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                json: () => Promise.resolve({
                    error: 'bad_verification_code',
                    error_description: 'The code passed is incorrect or expired.',
                }),
            } as Response);

            const result = await useAuthStore.getState().handleOAuthCallback('bad_code', 'verifier');

            expect(result).toBe(false);
            const state = useAuthStore.getState();
            expect(state.error).toBe('The code passed is incorrect or expired.');
            expect(state.isAuthenticated).toBe(false);
        });

        it('should handle missing access token', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                json: () => Promise.resolve({}),
            } as Response);

            const result = await useAuthStore.getState().handleOAuthCallback('code', 'verifier');

            expect(result).toBe(false);
            expect(useAuthStore.getState().error).toBe('No access token received');
        });

        it('should handle network errors', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

            const result = await useAuthStore.getState().handleOAuthCallback('code', 'verifier');

            expect(result).toBe(false);
            expect(useAuthStore.getState().error).toBe('Failed to complete authentication');
            consoleSpy.mockRestore();
        });
    });

    describe('refreshAccessToken', () => {
        it('should refresh token successfully', async () => {
            useAuthStore.setState({
                token: 'old_token',
                refreshToken: 'refresh_token',
                authMethod: 'oauth',
                isAuthenticated: true,
            });

            vi.mocked(global.fetch).mockResolvedValueOnce({
                json: () => Promise.resolve({
                    access_token: 'new_access_token',
                    refresh_token: 'new_refresh_token',
                    expires_in: 28800,
                }),
            } as Response);

            const result = await useAuthStore.getState().refreshAccessToken();

            expect(result).toBe(true);
            const state = useAuthStore.getState();
            expect(state.token).toBe('new_access_token');
            expect(state.refreshToken).toBe('new_refresh_token');
        });

        it('should return false for non-oauth auth method', async () => {
            useAuthStore.setState({
                token: 'pat_token',
                authMethod: 'pat',
                isAuthenticated: true,
            });

            const result = await useAuthStore.getState().refreshAccessToken();

            expect(result).toBe(false);
        });

        it('should return false when no refresh token', async () => {
            useAuthStore.setState({
                token: 'token',
                refreshToken: null,
                authMethod: 'oauth',
                isAuthenticated: true,
            });

            const result = await useAuthStore.getState().refreshAccessToken();

            expect(result).toBe(false);
        });

        it('should logout on refresh failure', async () => {
            useAuthStore.setState({
                token: 'old_token',
                refreshToken: 'expired_refresh_token',
                authMethod: 'oauth',
                isAuthenticated: true,
            });

            vi.mocked(global.fetch).mockResolvedValueOnce({
                json: () => Promise.resolve({
                    error: 'invalid_grant',
                }),
            } as Response);

            const result = await useAuthStore.getState().refreshAccessToken();

            expect(result).toBe(false);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
            expect(useAuthStore.getState().token).toBeNull();
        });
    });

    describe('isTokenExpiringSoon', () => {
        it('should return false for non-oauth auth', () => {
            useAuthStore.setState({
                authMethod: 'pat',
                tokenExpiresAt: Date.now() + 1000,
            });

            expect(useAuthStore.getState().isTokenExpiringSoon()).toBe(false);
        });

        it('should return false when no expiry time', () => {
            useAuthStore.setState({
                authMethod: 'oauth',
                tokenExpiresAt: null,
            });

            expect(useAuthStore.getState().isTokenExpiringSoon()).toBe(false);
        });

        it('should return true when token expires within threshold', () => {
            // Token expires in 2 minutes (threshold is 5 minutes)
            useAuthStore.setState({
                authMethod: 'oauth',
                tokenExpiresAt: Date.now() + 2 * 60 * 1000,
            });

            expect(useAuthStore.getState().isTokenExpiringSoon()).toBe(true);
        });

        it('should return false when token has plenty of time', () => {
            // Token expires in 1 hour
            useAuthStore.setState({
                authMethod: 'oauth',
                tokenExpiresAt: Date.now() + 60 * 60 * 1000,
            });

            expect(useAuthStore.getState().isTokenExpiringSoon()).toBe(false);
        });
    });

    describe('updateRateLimit', () => {
        it('should update rate limit state', () => {
            const resetDate = new Date('2026-01-28T00:00:00Z');
            useAuthStore.getState().updateRateLimit({
                remaining: 42,
                reset: resetDate,
                limit: 60,
            });

            const state = useAuthStore.getState();
            expect(state.rateLimitRemaining).toBe(42);
            expect(state.rateLimitReset).toEqual(resetDate);
            expect(state.rateLimitLimit).toBe(60);
        });

        it('should not persist rate limit state', () => {
            const resetDate = new Date('2026-01-28T00:00:00Z');
            useAuthStore.getState().updateRateLimit({
                remaining: 10,
                reset: resetDate,
                limit: 60,
            });

            const storageValue = JSON.parse(localStorage.getItem('auth-storage') ?? '{}') as { [key: string]: unknown };
            const storedState = storageValue.state as { [key: string]: unknown };
            expect(storedState.rateLimitRemaining).toBeUndefined();
            expect(storedState.rateLimitReset).toBeUndefined();
            expect(storedState.rateLimitLimit).toBeUndefined();
        });

        it('should have null initial state for rate limit fields', () => {
            useAuthStore.setState({
                rateLimitRemaining: null,
                rateLimitReset: null,
                rateLimitLimit: null,
            });
            const state = useAuthStore.getState();
            expect(state.rateLimitRemaining).toBeNull();
            expect(state.rateLimitReset).toBeNull();
            expect(state.rateLimitLimit).toBeNull();
        });
    });

    describe('logout with OAuth', () => {
        it('should clear all OAuth state', () => {
            useAuthStore.setState({
                token: 'access_token',
                refreshToken: 'refresh_token',
                tokenExpiresAt: Date.now() + 3600000,
                authMethod: 'oauth',
                isAuthenticated: true,
            });

            useAuthStore.getState().logout();

            const state = useAuthStore.getState();
            expect(state.token).toBeNull();
            expect(state.refreshToken).toBeNull();
            expect(state.tokenExpiresAt).toBeNull();
            expect(state.authMethod).toBeNull();
            expect(state.isAuthenticated).toBe(false);
        });
    });
});
