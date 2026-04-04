import { Button as AriaButton, type PressEvent } from 'react-aria-components';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: ((e: PressEvent) => void) | undefined;
  variant?: "primary" | "secondary";
  isDisabled?: boolean;
  type?: "button" | "submit" | "reset";
  size?: "default" | "sm" | "icon";
  className?: string;
  'aria-label'?: string;
}

export function Button({
  children,
  onPress,
  variant = "primary",
  isDisabled = false,
  type = "button",
  size = "default",
  className,
  ...props
}: ButtonProps) {
  const variantClass = variant === "primary" ? "btn-colorful" : "btn";
  const sizeClass = size === "icon" ? "btn-icon" : "";

  const classes = [variantClass, sizeClass, className].filter(Boolean).join(" ");

  return (
    <AriaButton
      type={type}
      {...(onPress ? { onPress } : {})}
      isDisabled={isDisabled}
      className={classes}
      {...props}
    >
      {children}
    </AriaButton>
  );
}
