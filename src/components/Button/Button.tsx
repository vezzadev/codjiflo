import { Button as RAButton, type ButtonProps as RAButtonProps } from 'react-aria-components';

export interface ButtonProps extends Omit<RAButtonProps, 'className' | 'title'> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  title?: string | undefined;
}

export function Button({
  variant = 'primary',
  size = 'default',
  className,
  children,
  ...rest
}: ButtonProps) {
  let variantClass = '';
  if (variant === 'primary') variantClass = 'btn-colorful';
  else if (variant === 'secondary') variantClass = 'btn';
  const sizeClass = size === 'icon' ? 'btn-icon' : '';
  const classes = [variantClass, sizeClass, className].filter(Boolean).join(' ');

  return (
    <RAButton className={classes} {...rest}>
      {children}
    </RAButton>
  );
}
