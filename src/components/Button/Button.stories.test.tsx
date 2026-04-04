import { describe, it, expect } from 'vitest';
import { render } from '@/tests/helpers/render';
import { Button } from './Button';

describe('Button Stories', () => {
  it('should render primary button variant', () => {
    const { getByRole } = render(
      <Button variant="primary">Primary Button</Button>
    );
    expect(getByRole('button')).toBeInTheDocument();
  });

  it('should render secondary button variant', () => {
    const { getByRole } = render(
      <Button variant="secondary">Secondary Button</Button>
    );
    expect(getByRole('button')).toBeInTheDocument();
  });
});
