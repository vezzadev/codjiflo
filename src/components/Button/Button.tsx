import { Button as RAButton, type ButtonProps as RAButtonProps } from 'react-aria-components';

export interface ButtonProps extends Omit<RAButtonProps, 'className' | 'style'> {
  variant?: 'primary' | 'secondary';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
}

export function Button({
  variant = 'primary',
  size = 'default',
  className,
  children,
  ...rest
}: ButtonProps) {
  const variantClass = variant === 'primary' ? 'btn-colorful' : 'btn';
  const sizeClass = size === 'icon' ? 'btn-icon' : '';
  const classes = [variantClass, sizeClass, className].filter(Boolean).join(' ');

  return (
    <RAButton className={classes} {...rest}>
      {children}
    </RAButton>
  );
}
