import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { Button } from './Button';

describe('Button', () => {
  it('renders children as accessible name', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onPress when activated by mouse', async () => {
    const handler = vi.fn();
    const user = userEvent.setup();
    render(<Button onPress={handler}>Click me</Button>);
    await user.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires onPress on Enter', async () => {
    const handler = vi.fn();
    const user = userEvent.setup();
    render(<Button onPress={handler}>Press</Button>);
    screen.getByRole('button').focus();
    await user.keyboard('{Enter}');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires onPress on Space', async () => {
    const handler = vi.fn();
    const user = userEvent.setup();
    render(<Button onPress={handler}>Press</Button>);
    screen.getByRole('button').focus();
    await user.keyboard(' ');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when isDisabled', async () => {
    const handler = vi.fn();
    const user = userEvent.setup();
    render(<Button onPress={handler} isDisabled>Disabled</Button>);
    await user.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('exposes isDisabled via data-disabled and the native disabled attribute', () => {
    render(<Button isDisabled>X</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-disabled');
    expect(btn).toBeDisabled();
  });

  it('applies btn-colorful for primary variant (default)', () => {
    render(<Button>Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-colorful');
  });

  it('applies btn for secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn');
  });

  it('applies btn-icon for icon size', () => {
    render(<Button size="icon" aria-label="Icon button">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-icon');
  });

  it('does not apply btn-icon for default size', () => {
    render(<Button size="default">Default</Button>);
    expect(screen.getByRole('button')).not.toHaveClass('btn-icon');
  });

  it('applies additional className via prop', () => {
    render(<Button className="my-custom">X</Button>);
    expect(screen.getByRole('button')).toHaveClass('my-custom');
  });

  it('exposes aria-label on the rendered button', () => {
    render(<Button aria-label="Close dialog">X</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Close dialog');
  });

  it('renders with type="submit" when specified', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('renders with type="button" by default', () => {
    render(<Button>X</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('has no serious or critical axe violations', async () => {
    const { container } = render(<Button>Accessible button</Button>);
    const results = await axe.run(container);
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious).toEqual([]);
  });

  it('icon-only button with aria-label has no serious axe violations', async () => {
    const { container } = render(
      <Button size="icon" aria-label="Close">
        <span aria-hidden="true">×</span>
      </Button>
    );
    const results = await axe.run(container);
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious).toEqual([]);
  });
});
