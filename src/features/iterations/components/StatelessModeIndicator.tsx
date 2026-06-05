import { Zap, LogIn } from 'lucide-react';
import { Button } from '@/components';
import { TooltipTrigger, Tooltip } from '@/components/ui';
import { useOAuthFlow } from '@/features/auth/hooks';
import { useIterationStore } from '../stores';

const NO_ARTIFACT_TOOLTIP =
  'No CodjiFlo artifact found. This repo may not have the CodjiFlo GitHub Action installed. Iteration tracking is limited.';
const UNAUTHENTICATED_TOOLTIP =
  'CodjiFlo data is available for this PR. Sign in to enable full iteration tracking.';

/**
 * Compact pill shown next to the iteration tabs when iteration data is in
 * stateless mode. Renders nothing in stateful mode, a neutral info pill when
 * the repo has no CodjiFlo artifact, or an actionable sign-in pill when the
 * cause is an anonymous session.
 */
export function StatelessModeIndicator() {
  const mode = useIterationStore((s) => s.mode);
  const statelessReason = useIterationStore((s) => s.statelessReason);
  const { initiateOAuth } = useOAuthFlow();

  if (mode === 'stateful') {
    return null;
  }

  if (statelessReason === 'unauthenticated') {
    return (
      <TooltipTrigger>
        <Button
          className="stateless-indicator stateless-indicator--action"
          data-testid="stateless-indicator"
          onPress={() => { initiateOAuth(); }}
          aria-label="Stateless mode — sign in to enable full iteration tracking"
        >
          <LogIn size={12} aria-hidden="true" />
          <span>Sign in for full tracking</span>
        </Button>
        <Tooltip className="stateless-indicator-tooltip">{UNAUTHENTICATED_TOOLTIP}</Tooltip>
      </TooltipTrigger>
    );
  }

  // statelessReason === 'no-artifact' (and any future stateless reason): neutral info pill.
  // The Button has no onPress — it is a focusable tooltip trigger only; the
  // aria-label carries the meaning so state is not conveyed by colour alone.
  return (
    <TooltipTrigger>
      <Button
        className="stateless-indicator stateless-indicator--info"
        data-testid="stateless-indicator"
        aria-label="Stateless mode — iteration tracking is limited"
      >
        <Zap size={12} aria-hidden="true" />
        <span>Stateless</span>
      </Button>
      <Tooltip className="stateless-indicator-tooltip">{NO_ARTIFACT_TOOLTIP}</Tooltip>
    </TooltipTrigger>
  );
}
