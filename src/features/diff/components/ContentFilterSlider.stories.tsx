import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within, userEvent } from 'storybook/test';
import { useState } from 'react';
import { ContentFilterSlider } from './ContentFilterSlider';
import type { ContentFilter } from '../types';

function ControlledSlider({ initial = 'both' }: { initial?: ContentFilter }) {
  const [value, setValue] = useState<ContentFilter>(initial);
  return (
    <div style={{ padding: '16px', background: 'var(--diff-area-bg)' }}>
      <ContentFilterSlider value={value} onChange={setValue} />
      <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--main-fg)' }}>
        Selected: <strong>{value}</strong>
      </p>
    </div>
  );
}

const meta = {
  title: 'Diff/ContentFilterSlider',
  component: ContentFilterSlider,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof ContentFilterSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ShowBoth: Story = {
  args: { value: 'both', onChange: () => undefined },
  render: () => <ControlledSlider initial="both" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bothRadio = canvas.getByRole('radio', { name: 'Show Both' });
    await expect(bothRadio).toBeChecked();
    const bothLabel = canvasElement.querySelector('.content-filter-option-both');
    await expect(bothLabel).toHaveAttribute('data-selected', 'true');
    const thumb = bothLabel?.querySelector('.content-filter-thumb');
    await expect(thumb).toBeVisible();
  },
};

export const LeftOnly: Story = {
  args: { value: 'left', onChange: () => undefined },
  render: () => <ControlledSlider initial="left" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leftRadio = canvas.getByRole('radio', { name: 'Left Only' });
    await expect(leftRadio).toBeChecked();
    const leftLabel = canvasElement.querySelector('.content-filter-option-left');
    await expect(leftLabel).toHaveAttribute('data-selected', 'true');
    const thumb = leftLabel?.querySelector('.content-filter-thumb');
    await expect(thumb).toBeVisible();
  },
};

export const RightOnly: Story = {
  args: { value: 'right', onChange: () => undefined },
  render: () => <ControlledSlider initial="right" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rightRadio = canvas.getByRole('radio', { name: 'Right Only' });
    await expect(rightRadio).toBeChecked();
    const rightLabel = canvasElement.querySelector('.content-filter-option-right');
    await expect(rightLabel).toHaveAttribute('data-selected', 'true');
    const thumb = rightLabel?.querySelector('.content-filter-thumb');
    await expect(thumb).toBeVisible();
  },
};

export const ClickTogglesThumb: Story = {
  args: { value: 'both', onChange: () => undefined },
  render: () => <ControlledSlider initial="both" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const slider = canvasElement.querySelector('.content-filter-slider');
    if (!slider) throw new Error('content-filter-slider not found');

    const both = slider.querySelector('.content-filter-option-both');
    const left = slider.querySelector('.content-filter-option-left');
    const right = slider.querySelector('.content-filter-option-right');
    await expect(both).toHaveAttribute('data-selected', 'true');

    await userEvent.click(canvas.getByRole('radio', { name: 'Left Only' }));
    await expect(left).toHaveAttribute('data-selected', 'true');
    await expect(both).not.toHaveAttribute('data-selected');
    const leftThumb = left?.querySelector('.content-filter-thumb');
    await expect(leftThumb).toBeVisible();

    await userEvent.click(canvas.getByRole('radio', { name: 'Right Only' }));
    await expect(right).toHaveAttribute('data-selected', 'true');
    const rightThumb = right?.querySelector('.content-filter-thumb');
    await expect(rightThumb).toBeVisible();
  },
};
