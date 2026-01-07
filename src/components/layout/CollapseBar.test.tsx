import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollapseBar } from './CollapseBar';

describe('CollapseBar', () => {
  it('renders horizontal collapse bar with correct aria-label', () => {
    render(<CollapseBar direction="horizontal" onExpand={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /expand left pane/i })
    ).toBeInTheDocument();
  });

  it('renders vertical collapse bar with correct aria-label', () => {
    render(<CollapseBar direction="vertical" onExpand={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /expand bottom pane/i })
    ).toBeInTheDocument();
  });

  it('calls onExpand when clicked', async () => {
    const onExpand = vi.fn();
    const user = userEvent.setup();
    render(<CollapseBar direction="horizontal" onExpand={onExpand} />);

    await user.click(screen.getByRole('button'));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard activation with Enter', async () => {
    const onExpand = vi.fn();
    const user = userEvent.setup();
    render(<CollapseBar direction="horizontal" onExpand={onExpand} />);

    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard('{Enter}');
    expect(onExpand).toHaveBeenCalled();
  });

  it('supports keyboard activation with Space', async () => {
    const onExpand = vi.fn();
    const user = userEvent.setup();
    render(<CollapseBar direction="horizontal" onExpand={onExpand} />);

    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard(' ');
    expect(onExpand).toHaveBeenCalled();
  });

  it('applies correct CSS class for horizontal direction', () => {
    render(<CollapseBar direction="horizontal" onExpand={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('collapse-bar-left');
  });

  it('applies correct CSS class for vertical direction', () => {
    render(<CollapseBar direction="vertical" onExpand={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('collapse-bar-bottom');
  });

  it('supports custom aria-label', () => {
    render(
      <CollapseBar
        direction="horizontal"
        onExpand={vi.fn()}
        aria-label="Custom label"
      />
    );
    expect(
      screen.getByRole('button', { name: 'Custom label' })
    ).toBeInTheDocument();
  });
});
