interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

/**
 * Skeleton loading placeholder with pulse animation
 */
export function Skeleton({ className, width, height }: SkeletonProps) {
  const classes = ["skeleton", className].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      style={{ width, height }}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * Text-line skeleton for loading states
 */
export function SkeletonText({ className, lines = 1 }: { className?: string; lines?: number }) {
  const wrapperClasses = ["skeleton-text-wrapper", className].filter(Boolean).join(" ");

  return (
    <div className={wrapperClasses} role="status" aria-label="Loading content">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-text"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}
