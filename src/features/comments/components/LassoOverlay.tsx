/**
 * Lasso Overlay Component
 *
 * SVG layer that draws bezier curve connectors between code and comment bubbles.
 * Part of S-5.3: Lasso Connectors
 */

import { useCallback, useMemo } from 'react';
import type { ConnectorData } from '../layout-engine';

export interface LassoOverlayProps {
  /** Array of connector data to render */
  connectors: ConnectorData[];
  /** Thread ID currently highlighted (hovered) */
  highlightedThreadId: string | null;
  /** Handler for hover events on connectors */
  onHover?: (threadId: string | null) => void;
}

/**
 * Calculate a bezier curve path between two points
 * Uses horizontal control points for a smooth S-curve
 */
function calculateBezierPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  const dx = endX - startX;

  // Control point offset based on distance
  const controlOffset = Math.min(Math.abs(dx) * 0.4, 60);

  // Control points for smooth curve
  const cp1x = startX + controlOffset;
  const cp1y = startY;
  const cp2x = endX - controlOffset;
  const cp2y = endY;

  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}

/**
 * Individual connector path with hover handling
 */
interface ConnectorPathProps {
  connector: ConnectorData;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function ConnectorPath({
  connector,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
}: ConnectorPathProps) {
  const path = useMemo(
    () =>
      calculateBezierPath(
        connector.startX,
        connector.startY,
        connector.endX,
        connector.endY
      ),
    [connector.startX, connector.startY, connector.endX, connector.endY]
  );

  const pathClasses = [
    'lasso-connector',
    isHighlighted && 'lasso-connector--highlighted',
    connector.isDisplaced && 'lasso-connector--displaced',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <g className="lasso-connector-group" data-thread-id={connector.threadId}>
      {/* Invisible hover area */}
      <path
        className="lasso-connector-hover"
        d={path}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        aria-hidden="true"
      />
      {/* Visible connector line */}
      <path className={pathClasses} d={path} aria-hidden="true" />
      {/* Anchor dot at code side */}
      <circle
        className={`lasso-anchor ${isHighlighted ? 'lasso-anchor--highlighted' : ''}`}
        cx={connector.startX}
        cy={connector.startY}
        aria-hidden="true"
      />
    </g>
  );
}

/**
 * SVG overlay for drawing connector lines between code and bubbles
 */
export function LassoOverlay({
  connectors,
  highlightedThreadId,
  onHover,
}: LassoOverlayProps) {
  const handleMouseEnter = useCallback(
    (threadId: string) => {
      onHover?.(threadId);
    },
    [onHover]
  );

  const handleMouseLeave = useCallback(() => {
    onHover?.(null);
  }, [onHover]);

  if (connectors.length === 0) {
    return null;
  }

  return (
    <svg
      className="lasso-overlay"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {connectors.map((connector) => (
        <ConnectorPath
          key={connector.threadId}
          connector={connector}
          isHighlighted={connector.threadId === highlightedThreadId}
          onMouseEnter={() => handleMouseEnter(connector.threadId)}
          onMouseLeave={handleMouseLeave}
        />
      ))}
    </svg>
  );
}
