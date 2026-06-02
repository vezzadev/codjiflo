import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/tests/helpers';
import LoginPage from './page';

const validateToken = vi.fn();
const clearError = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    validateToken,
    error: null,
    isValidating: false,
    clearError,
  }),
}));

vi.mock('@/features/auth/hooks', () => ({
  useOAuthFlow: () => ({ initiateOAuth: vi.fn(), isInitiating: false }),
  useRedirectIfAuthenticated: () => ({ isAuthenticated: false }),
  // 'disabled' = not a local dev build → renders the normal OAuth/PAT UI.
  useDevAutoLogin: () => 'disabled',
}));

describe('LoginPage PAT gh-auth-token tip', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reveals an info tip pointing at `gh auth token` next to the PAT field', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /Personal Access Token/i }));

    const tip = screen.getByRole('button', {
      name: /Tip: paste the output of gh auth token/i,
    });
    expect(tip).toBeInTheDocument();

    await user.hover(tip);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(/gh auth token/i);
  });
});
