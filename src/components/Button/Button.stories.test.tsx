import { describe, it, expect, vi } from 'vitest';
import { render } from '@/tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button Stories', () => {
  it('renders primary button variant', () => {
    const { getByRole } = render(<Button variant="primary">Primary Button</Button>);
    expect(getByRole('button')).toHaveClass('btn-colorful');
  });

  it('renders secondary button variant', () => {
    const { getByRole } = render(<Button variant="secondary">Secondary Button</Button>);
    expect(getByRole('button')).toHaveClass('btn');
  });

  it('renders disabled variant with the disabled attribute', () => {
    const { getByRole } = render(<Button isDisabled>Disabled Button</Button>);
    expect(getByRole('button')).toBeDisabled();
  });

  it('icon-only variant exposes accessible name via aria-label', () => {
    const { getByRole } = render(
      <Button size="icon" aria-label="Close">
        ×
      </Button>
    );
    expect(getByRole('button')).toHaveAccessibleName('Close');
    expect(getByRole('button')).toHaveClass('btn-icon');
  });

  it('Enter activates onPress', async () => {
    const handler = vi.fn();
    const user = userEvent.setup();
    const { getByRole } = render(<Button onPress={handler}>Activate</Button>);
    getByRole('button').focus();
    await user.keyboard('{Enter}');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
