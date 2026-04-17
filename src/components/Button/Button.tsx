interface ButtonProps {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  size?: "default" | "sm" | "icon";
  className?: string;
  ariaLabel?: string;
}

export function Button({
  label,
  onClick,
  variant = "primary",
  disabled = false,
  type = "button",
  size = "default",
  className,
  ariaLabel,
}: ButtonProps) {
  // Map variants to CSS classes from spec
  const variantClass = variant === "primary" ? "btn-colorful" : "btn";
  const sizeClass = size === "icon" ? "btn-icon" : "";

  const classes = [variantClass, sizeClass, className].filter(Boolean).join(" ");

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}
