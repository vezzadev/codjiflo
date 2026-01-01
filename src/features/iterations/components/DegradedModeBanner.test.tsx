import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { DegradedModeBanner } from './DegradedModeBanner';
import { useIterationStore } from '../stores';

// Mock the store
vi.mock('../stores', () => ({
  useIterationStore: vi.fn(),
}));

describe('DegradedModeBanner', () => {
  const mockUseIterationStore = vi.mocked(useIterationStore);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('does not render when isLoading is true', () => {
    mockUseIterationStore.mockReturnValue({
      isLoading: true,
      isDegraded: true,
    } as ReturnType<typeof useIterationStore>);

    const { container } = render(<DegradedModeBanner />);

    expect(container.firstChild).toBeNull();
  });

  it('does not render when isDegraded is false', () => {
    mockUseIterationStore.mockReturnValue({
      isLoading: false,
      isDegraded: false,
    } as ReturnType<typeof useIterationStore>);

    const { container } = render(<DegradedModeBanner />);

    expect(container.firstChild).toBeNull();
  });

  it('renders banner when isDegraded is true and not loading', () => {
    mockUseIterationStore.mockReturnValue({
      isLoading: false,
      isDegraded: true,
    } as ReturnType<typeof useIterationStore>);

    render(<DegradedModeBanner />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Iteration tracking unavailable')).toBeInTheDocument();
  });

  it('displays informative message about missing GitHub Action', () => {
    mockUseIterationStore.mockReturnValue({
      isLoading: false,
      isDegraded: true,
    } as ReturnType<typeof useIterationStore>);

    render(<DegradedModeBanner />);

    expect(screen.getByText(/doesn't have the CodjiFlo GitHub Action installed/i)).toBeInTheDocument();
    expect(screen.getByText(/force-push history and iteration tracking are not available/i)).toBeInTheDocument();
  });

  it('displays link to installation instructions', () => {
    mockUseIterationStore.mockReturnValue({
      isLoading: false,
      isDegraded: true,
    } as ReturnType<typeof useIterationStore>);

    render(<DegradedModeBanner />);

    const link = screen.getByRole('link', { name: /Learn how to enable iteration tracking/i });
    expect(link).toHaveAttribute('href', 'https://github.com/codjiflo/action#installation');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('applies custom className', () => {
    mockUseIterationStore.mockReturnValue({
      isLoading: false,
      isDegraded: true,
    } as ReturnType<typeof useIterationStore>);

    render(<DegradedModeBanner className="custom-banner-class" />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveClass('degraded-banner');
    expect(banner).toHaveClass('custom-banner-class');
  });

  it('has aria-live polite attribute for screen readers', () => {
    mockUseIterationStore.mockReturnValue({
      isLoading: false,
      isDegraded: true,
    } as ReturnType<typeof useIterationStore>);

    render(<DegradedModeBanner />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });
});
