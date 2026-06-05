import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatelessModeIndicator } from './StatelessModeIndicator';
import { useIterationStore } from '../stores';

const mockInitiateOAuth = vi.fn();
vi.mock('@/features/auth/hooks', () => ({
  useOAuthFlow: () => ({
    initiateOAuth: mockInitiateOAuth,
    isInitiating: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

function setMode(
  mode: 'stateful' | 'stateless',
  statelessReason: 'unauthenticated' | 'no-artifact' | null,
) {
  useIterationStore.setState({ mode, statelessReason });
}

describe('StatelessModeIndicator', () => {
  beforeEach(() => {
    mockInitiateOAuth.mockClear();
    useIterationStore.getState().reset();
  });

  it('renders nothing in stateful mode', () => {
    setMode('stateful', null);
    const { container } = render(<StatelessModeIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a neutral info pill when the repo has no artifact', () => {
    setMode('stateless', 'no-artifact');
    render(<StatelessModeIndicator />);
    const pill = screen.getByTestId('stateless-indicator');
    expect(pill).toHaveTextContent(/stateless/i);
    expect(pill).toHaveClass('stateless-indicator--info');
  });

  it('renders a sign-in action pill when unauthenticated', () => {
    setMode('stateless', 'unauthenticated');
    render(<StatelessModeIndicator />);
    const pill = screen.getByTestId('stateless-indicator');
    expect(pill).toHaveTextContent(/sign in/i);
    expect(pill).toHaveClass('stateless-indicator--action');
  });

  it('initiates OAuth when the sign-in pill is pressed', async () => {
    setMode('stateless', 'unauthenticated');
    render(<StatelessModeIndicator />);
    await userEvent.click(screen.getByTestId('stateless-indicator'));
    expect(mockInitiateOAuth).toHaveBeenCalledOnce();
  });
});
