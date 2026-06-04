import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatelessModeIndicator } from './StatelessModeIndicator';
import { useIterationStore } from '../stores';

// useOAuthFlow is an external dependency (it redirects the browser to GitHub),
// not the system under test. Stub it so the action pill can mount without a real
// redirect, while keeping a stable spy so we can assert the login flow is
// initiated by a real user press. The hoisted spy survives re-renders (an inline
// vi.fn() in the factory would be recreated each render and lose call history).
const mockInitiateOAuth = vi.hoisted(() => vi.fn());
vi.mock('@/features/auth/hooks', () => ({
  useOAuthFlow: () => ({
    initiateOAuth: mockInitiateOAuth,
    isInitiating: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

/**
 * Drive the REAL store the same way loadIterations does in production:
 * by setting `mode` + `statelessReason`. The rendered pill is then asserted
 * as a user would see it. No module-level store mock, no test-only backdoor.
 */
function setStoreMode(
  mode: 'stateful' | 'stateless',
  statelessReason: 'unauthenticated' | 'no-artifact' | null,
) {
  act(() => {
    useIterationStore.setState({ mode, statelessReason });
  });
}

describe('StatelessModeIndicator (integration)', () => {
  beforeEach(() => {
    mockInitiateOAuth.mockClear();
    act(() => {
      useIterationStore.getState().reset();
    });
  });

  it('shows nothing initially (default stateful store), then appears and disappears as the live store mode changes', () => {
    // Initial state from reset() is stateful -> nothing rendered.
    render(<StatelessModeIndicator />);
    expect(screen.queryByTestId('stateless-indicator')).toBeNull();

    // Production transition into stateless/no-artifact: pill must appear via a
    // live store subscription (NOT a rerender prop) with the info variant.
    setStoreMode('stateless', 'no-artifact');
    const infoPill = screen.getByTestId('stateless-indicator');
    expect(infoPill).toHaveTextContent(/stateless/i);
    expect(infoPill).toHaveClass('stateless-indicator--info');
    expect(infoPill).not.toHaveClass('stateless-indicator--action');

    // Transition back to stateful: the pill must UNMOUNT, not linger.
    // Catches an impl that renders once and never reacts to mode going back.
    setStoreMode('stateful', null);
    expect(screen.queryByTestId('stateless-indicator')).toBeNull();
  });

  it('switches between the info and action variants when only statelessReason changes', () => {
    render(<StatelessModeIndicator />);

    // no-artifact -> neutral info pill, text "Stateless", no sign-in copy.
    setStoreMode('stateless', 'no-artifact');
    const infoPill = screen.getByTestId('stateless-indicator');
    expect(infoPill).toHaveTextContent(/stateless/i);
    expect(infoPill).not.toHaveTextContent(/sign in/i);
    expect(infoPill).toHaveClass('stateless-indicator--info');

    // unauthenticated -> actionable sign-in pill. The variant (class + copy)
    // must flip purely from statelessReason while mode stays 'stateless'.
    // A lazy impl that branches only on `mode` would fail this.
    setStoreMode('stateless', 'unauthenticated');
    const actionPill = screen.getByTestId('stateless-indicator');
    expect(actionPill).toHaveTextContent(/sign in/i);
    expect(actionPill).toHaveClass('stateless-indicator--action');
    expect(actionPill).not.toHaveClass('stateless-indicator--info');
  });

  it('renders the action variant as an interactive element with an accessible name (not colour-only)', () => {
    setStoreMode('stateless', 'unauthenticated');
    render(<StatelessModeIndicator />);

    // State must be conveyed without relying on colour: the pill exposes an
    // accessible name. We assert a real accessible role/name, not just a div.
    const pill = screen.getByTestId('stateless-indicator');
    expect(pill).toHaveAccessibleName(/sign in|stateless/i);
  });

  it('initiates the OAuth login flow when the user presses the sign-in (unauthenticated) pill', async () => {
    const user = userEvent.setup();
    setStoreMode('stateless', 'unauthenticated');
    render(<StatelessModeIndicator />);

    await user.click(screen.getByTestId('stateless-indicator'));
    expect(mockInitiateOAuth).toHaveBeenCalledOnce();
  });

  it('does NOT initiate OAuth when the user presses the neutral no-artifact info pill', async () => {
    // Adversarial: a lazy impl that wires the same onPress on both variants
    // would wrongly trigger a login redirect from the informational pill.
    const user = userEvent.setup();
    setStoreMode('stateless', 'no-artifact');
    render(<StatelessModeIndicator />);

    await user.click(screen.getByTestId('stateless-indicator'));
    expect(mockInitiateOAuth).not.toHaveBeenCalled();
  });
});
