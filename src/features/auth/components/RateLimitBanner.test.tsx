import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/tests/helpers';
import { RateLimitBanner } from './RateLimitBanner';
import { useRateLimitWarning } from '../hooks/useRateLimitWarning';
import { useAuthStore } from '../stores/useAuthStore';

vi.mock('../hooks/useRateLimitWarning', () => ({
  useRateLimitWarning: vi.fn(),
}));

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}));

function mockWarning(state: {
  shouldWarn: boolean;
  remaining: number | null;
  resetTime?: Date | null;
  isExhausted?: boolean;
}) {
  vi.mocked(useRateLimitWarning).mockReturnValue({
    shouldWarn: state.shouldWarn,
    remaining: state.remaining,
    resetTime: state.resetTime ?? null,
    isExhausted: state.isExhausted ?? false,
  });
}

function mockAuth(isAuthenticated: boolean) {
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    <T,>(selector: (s: { isAuthenticated: boolean }) => T) =>
      selector({ isAuthenticated })
  );
}

describe('RateLimitBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when shouldWarn is false', () => {
    mockWarning({ shouldWarn: false, remaining: 50 });
    mockAuth(false);

    const { container } = render(<RateLimitBanner />);

    expect(container.firstChild).toBeNull();
  });

  it('renders warning with remaining count for unauthenticated users', () => {
    mockWarning({ shouldWarn: true, remaining: 8 });
    mockAuth(false);

    render(<RateLimitBanner />);

    expect(screen.getByText(/8 requests remaining/)).toBeInTheDocument();
    expect(screen.getByText(/Sign in/)).toBeInTheDocument();
    expect(screen.getByText(/5,000 requests\/hour/)).toBeInTheDocument();
  });

  it('renders warning without login CTA for authenticated users', () => {
    mockWarning({ shouldWarn: true, remaining: 200 });
    mockAuth(true);

    render(<RateLimitBanner />);

    expect(screen.getByText(/200 API requests remaining/)).toBeInTheDocument();
    expect(screen.queryByText(/Sign in/)).not.toBeInTheDocument();
  });

  it('has role="alert" and aria-live="polite" when not exhausted', () => {
    mockWarning({ shouldWarn: true, remaining: 8 });
    mockAuth(false);

    render(<RateLimitBanner />);

    const banner = screen.getByRole('alert');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('has aria-live="assertive" when exhausted', () => {
    const resetTime = new Date(Date.now() + 30 * 60 * 1000);
    mockWarning({ shouldWarn: true, remaining: 0, isExhausted: true, resetTime });
    mockAuth(false);

    render(<RateLimitBanner />);

    const banner = screen.getByRole('alert');
    expect(banner).toHaveAttribute('aria-live', 'assertive');
  });

  it('shows exhausted message with reset time', () => {
    const resetTime = new Date(Date.now() + 34 * 60 * 1000);
    mockWarning({ shouldWarn: true, remaining: 0, isExhausted: true, resetTime });
    mockAuth(false);

    render(<RateLimitBanner />);

    expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument();
    expect(screen.getByText(/Resets in \d+ minutes/)).toBeInTheDocument();
  });

  it('is not dismissible when exhausted', () => {
    const resetTime = new Date(Date.now() + 30 * 60 * 1000);
    mockWarning({ shouldWarn: true, remaining: 0, isExhausted: true, resetTime });
    mockAuth(false);

    render(<RateLimitBanner />);

    expect(screen.queryByLabelText('Dismiss rate limit warning')).not.toBeInTheDocument();
  });

  it('can be dismissed when not exhausted', () => {
    mockWarning({ shouldWarn: true, remaining: 8 });
    mockAuth(false);

    render(<RateLimitBanner />);

    const dismissBtn = screen.getByLabelText('Dismiss rate limit warning');
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/requests remaining/)).not.toBeInTheDocument();
  });

  it('reappears after dismiss when remaining drops 5 below dismissed value', () => {
    // Start at 8
    mockWarning({ shouldWarn: true, remaining: 8 });
    mockAuth(false);

    const { rerender } = render(<RateLimitBanner />);
    fireEvent.click(screen.getByLabelText('Dismiss rate limit warning'));
    expect(screen.queryByText(/requests remaining/)).not.toBeInTheDocument();

    // Drop to 4 (8 - 5 = 3, 4 > 3, still hidden)
    mockWarning({ shouldWarn: true, remaining: 4 });
    rerender(<RateLimitBanner />);
    expect(screen.queryByText(/requests remaining/)).not.toBeInTheDocument();

    // Drop to 2 (8 - 5 = 3, 2 < 3, reappears)
    mockWarning({ shouldWarn: true, remaining: 2 });
    rerender(<RateLimitBanner />);
    expect(screen.getByText(/2 requests remaining/)).toBeInTheDocument();
  });

  it('shows Sign in link pointing to /login for unauthenticated exhausted state', () => {
    const resetTime = new Date(Date.now() + 30 * 60 * 1000);
    mockWarning({ shouldWarn: true, remaining: 0, isExhausted: true, resetTime });
    mockAuth(false);

    render(<RateLimitBanner />);

    const link = screen.getByText('Sign in');
    expect(link).toHaveAttribute('href', '/login');
  });

  it('does not show Sign in link for authenticated exhausted state', () => {
    const resetTime = new Date(Date.now() + 30 * 60 * 1000);
    mockWarning({ shouldWarn: true, remaining: 0, isExhausted: true, resetTime });
    mockAuth(true);

    render(<RateLimitBanner />);

    expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
  });
});
